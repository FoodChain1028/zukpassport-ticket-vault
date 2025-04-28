'use client';

import { useEffect, useState, useRef } from 'react';
import { useZupassPopupMessages } from '@pcd/passport-interface';
import { getPCDFromZupass } from '../utils';
import { PODPCDPackage } from '@pcd/pod-pcd';
import { useRouter } from 'next/navigation';

export default function SignIn() {
  const [message, setMessage] = useState('Sign in with Zupass');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasProcessedUrl, setHasProcessedUrl] = useState(false);
  const [receivedData, setReceivedData] = useState<string | null>(null);
  const [formattedData, setFormattedData] = useState<any>(null);
  const router = useRouter();

  const handleDataReceived = (data: string) => {
    setReceivedData(data);
    setIsLoading(false);

    try {
      // Parse the data received from Zupass
      const parsed = JSON.parse(data);
      console.log('Parsed data:', parsed);

      // Create a formatted user profile from the data
      let formattedUser = {
        type: parsed.type,
        isAuthenticated: true,
        profile: {
          name: 'Unknown',
          nationality: 'Unknown',
        }
      };

      // If we have a nested PCD, try to extract profile info
      if (parsed.type === 'pod-pcd' && typeof parsed.pcd === 'string') {
        try {
          const pcdData = JSON.parse(parsed.pcd);
          
          if (pcdData.jsonPOD?.entries) {
            const entries = pcdData.jsonPOD.entries;
            
            formattedUser = {
              ...formattedUser,
              profile: {
                name: entries.disclosure_name || 'Unknown',
                nationality: entries.disclosure_nationality || 'Unknown',
              }
            };
          }
        } catch (innerError) {
          console.error('Error parsing PCD data:', innerError);
        }
      }

      setFormattedData(formattedUser);
      
      // Store authentication in sessionStorage
      sessionStorage.setItem('userAuth', JSON.stringify({
        isAuthenticated: true,
        profile: formattedUser.profile,
        balance: 250, // Fixed balance of 250
        timestamp: new Date().toISOString()
      }));
      
      setMessage('Successfully signed in! Redirecting...');
      
      // Redirect after successful sign-in
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (e) {
      console.error('Error formatting data:', e);
      setError(`Failed to sign in: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // Use the official hook to receive messages from Zupass popup
  const [zupassPCDStr] = useZupassPopupMessages();
  const popupWindowRef = useRef<Window | null>(null);

  // Process URL parameters
  const processUrlParams = () => {
    if (typeof window === 'undefined') return false;

    try {
      const url = new URL(window.location.href);
      const params = new URLSearchParams(url.search);
      const hash = url.hash;

      const proof = params.get('proof');
      const hashProof =
        hash && hash.includes('proof=')
          ? decodeURIComponent(hash.split('proof=')[1].split('&')[0])
          : null;

      if (hash && hash.includes('error')) {
        const errorMsg = hash.includes('error=')
          ? decodeURIComponent(hash.split('error=')[1].split('&')[0])
          : 'Unknown error';
        setError(`Zupass returned error: ${errorMsg}`);
        return false;
      }

      if (proof || hashProof) {
        setIsLoading(true);
        setMessage('Processing sign-in...');

        const proofData = proof || hashProof;
        console.log('Data retrieved from URL:', proofData?.substring(0, 20) + '...');

        localStorage.setItem('zupass_pcd_data', proofData || '');
        handleDataReceived(proofData || '');
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error processing Zupass return data:', e);
      setError(`Error processing data: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  };

  // Handle messages from Zupass popup
  useEffect(() => {
    if (zupassPCDStr) {
      console.log('Received Zupass popup message');
      setIsLoading(false);

      try {
        localStorage.setItem('zupass_pcd_data', zupassPCDStr);
        handleDataReceived(zupassPCDStr);
      } catch (e) {
        console.error('Error processing Zupass message:', e);
        setError(`Failed to process Zupass data: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }, [zupassPCDStr]);

  // Setup event listener for window messages
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleWindowMessage = (event: MessageEvent) => {
      console.log('Received window message:', event.data);

      if (typeof event.data === 'string' || (event.data && event.data.pcd)) {
        const data = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
        setIsLoading(false);

        try {
          localStorage.setItem('zupass_pcd_data', data);
          handleDataReceived(data);
        } catch (e) {
          console.error('Error processing window message:', e);
          setError(`Failed to process message: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, []);

  // Check for existing data in localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedData = localStorage.getItem('zupass_pcd_data');
    if (savedData && !receivedData) {
      console.log('Found existing Zupass data in localStorage');
      handleDataReceived(savedData);
    }
  }, [receivedData]);

  // Check URL parameters on page load
  useEffect(() => {
    if (!hasProcessedUrl) {
      const hasData = processUrlParams();
      setHasProcessedUrl(true);

      if (!hasData) {
        setMessage('Please sign in with Zupass');
      }
    }
  }, [hasProcessedUrl]);

  // Function to open Zupass popup
  const openZupassPopup = () => {
    setIsLoading(true);
    setMessage('Opening Zupass...');
    setError(null);

    try {
      // Record current page as redirect target
      localStorage.setItem('zupass_redirect_path', window.location.pathname);

      // Open the Zupass popup
      const popupWindow = getPCDFromZupass(PODPCDPackage.name);

      if (!popupWindow) {
        throw new Error('Popup was blocked by the browser');
      }

      popupWindowRef.current = popupWindow;
      setMessage('Zupass opened. Please select your data');

      // Monitor popup status
      const checkPopupInterval = setInterval(() => {
        if (popupWindowRef.current && popupWindowRef.current.closed) {
          clearInterval(checkPopupInterval);
          if (!receivedData) {
            setIsLoading(false);
            setMessage('Sign in was cancelled');
          }
        }
      }, 500);
    } catch (e) {
      console.error('Error opening Zupass:', e);
      setError(`Failed to open Zupass: ${e instanceof Error ? e.message : String(e)}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-gray-900 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg p-8 rounded-2xl shadow-2xl border border-white/10">
        <h1 className="text-3xl font-bold mb-6 text-center">Sign In</h1>
        
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
            {error}
          </div>
        )}
        
        {formattedData ? (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg">
            <p className="text-center text-green-200 font-medium">{message}</p>
            <div className="mt-4">
              <p><span className="opacity-70">Name:</span> {(formattedData.profile.name?.split(' ')[0] || 'Unknown').substring(2)}</p>
              <p><span className="opacity-70">Nationality:</span> {formattedData.profile.nationality}</p>
            </div>
          </div>
        ) : (
          <p className="text-center mb-8">{message}</p>
        )}
        
        <div className="space-y-4">
          <button
            onClick={openZupassPopup}
            disabled={isLoading}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg text-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Processing...' : 'Sign in with Zupass'}
          </button>
        </div>
        
        <div className="mt-6 text-center text-sm text-white/50">
          <p>
            Demo application for Zupass identity verification.
          </p>
        </div>
      </div>
    </div>
  );
} 