'use client';

import { useEffect, useState, useRef } from 'react';
import { useZupassPopupMessages } from '@pcd/passport-interface';
import { getPCDFromZupass, storePCDDataAndRedirect } from '../utils';
import { PODPCDPackage } from '@pcd/pod-pcd';

/**
 * This page has three functions:
 * 1. Serve as a redirect target for Zupass and process the returned data
 * 2. Provide a button for users to manually open the Zupass popup
 * 3. Display the acquired data without automatic redirection
 */
export default function RetrieveZupass() {
  // State management
  const [message, setMessage] = useState('Choose your action');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasProcessedUrl, setHasProcessedUrl] = useState(false);
  const [receivedData, setReceivedData] = useState<string | null>(null);

  const handleDataReceived = (data: string) => {
    setReceivedData(data);
    setIsLoading(false);
  };

  const [zupassPCDStr] = useZupassPopupMessages();
  const popupWindowRef = useRef<Window | null>(null);

  // Check URL parameters and process data
  const processUrlParams = () => {
    if (typeof window === 'undefined') return false;

    try {
      // Check if in a popup window
      const isPopup = !!window.opener;
      console.log('Is in popup window:', isPopup);

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
        setMessage('Processing data...');

        const proofData = proof || hashProof;
        console.log('Data retrieved from URL:', proofData?.substring(0, 20) + '...');

        // Use utility function to process data and redirect
        storePCDDataAndRedirect(proofData);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error processing Zupass return data:', e);
      setError(`Error processing data: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  };

  useEffect(() => {
    if (zupassPCDStr) {
      console.log('💬 Received Zupass popup message:', zupassPCDStr.substring(0, 50) + '...');
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

  // Set up a manual event listener as a backup
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Listen for window message events
    const handleWindowMessage = (event: MessageEvent) => {
      console.log('👂 Received window message:', event.data);

      // Process if the message is a string or contains PCD data
      if (typeof event.data === 'string' || (event.data && event.data.pcd)) {
        const data = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
        console.log('💾 Processing data received from window.message');
        setIsLoading(false);

        try {
          // Save to localStorage
          localStorage.setItem('zupass_pcd_data', data);
          // Display on the page rather than redirecting
          handleDataReceived(data);
        } catch (e) {
          console.error('Error processing window.message message:', e);
          setError(`Failed to process message: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    };

    // Add event listener
    window.addEventListener('message', handleWindowMessage);

    // Cleanup function
    return () => window.removeEventListener('message', handleWindowMessage);
  }, []);

  // Check for existing data in localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Directly check if localStorage has data, without monitoring changes
    const savedData = localStorage.getItem('zupass_pcd_data');
    console.log(savedData);
    if (savedData && !receivedData) {
      console.log('📦 Found existing Zupass data in localStorage');
      handleDataReceived(savedData);
    }
  }, [receivedData]);

  // Redirect function to use after data processing is complete
  const redirectToOrigin = () => {
    const redirectPath = localStorage.getItem('zupass_redirect_path') || '/';
    window.location.href = redirectPath;
  };

  // Check parameters when page loads
  useEffect(() => {
    if (!hasProcessedUrl) {
      const hasData = processUrlParams();
      setHasProcessedUrl(true);

      // If no data found, show manual mode
      if (!hasData) {
        setMessage('Please select an option below');
      }
    }
  }, [hasProcessedUrl]);

  // Manually open Zupass popup
  const openZupassPopup = () => {
    setIsLoading(true);
    setMessage('Opening Zupass popup...');
    setError(null);

    try {
      // Record current page as redirect target
      localStorage.setItem('zupass_redirect_path', window.location.pathname);

      // Use the modified getPCDFromZupass function to open popup
      const popupWindow = getPCDFromZupass(PODPCDPackage.name);

      if (!popupWindow) {
        throw new Error('Popup was blocked by the browser');
      }

      // Save popup reference
      popupWindowRef.current = popupWindow;

      setMessage('Zupass popup opened. Please select data in the popup');

      // Monitor if popup is closed
      const checkPopupInterval = setInterval(() => {
        if (popupWindowRef.current && popupWindowRef.current.closed) {
          console.log('⚠️ Zupass popup was manually closed');
          clearInterval(checkPopupInterval);
          setIsLoading(false);
          setMessage('Popup closed. Please try again if no data was received');
        }
      }, 1000);

      // Set timeout
      setTimeout(() => {
        if (isLoading) {
          clearInterval(checkPopupInterval);
          setIsLoading(false);
          setMessage('Operation timed out. Please try again or return to main page');
        }
      }, 60000); // 1 minute timeout

      return () => clearInterval(checkPopupInterval);
    } catch (e) {
      console.error('Failed to open Zupass popup:', e);
      setError(`Failed to open popup: ${e instanceof Error ? e.message : String(e)}`);
      setIsLoading(false);
      setMessage('Please select an option below');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-gray-900 p-6 rounded-lg shadow-md max-w-lg w-full text-center">
        <h1 className="text-xl font-bold mb-4 text-white">Zupass Data Receiver</h1>

        {!error ? (
          <div className="flex flex-col items-center w-full">
            {isLoading && (
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
            )}

            <p className="text-gray-600 mb-4">{message}</p>

            {receivedData ? (
              <div className="flex flex-col space-y-4 w-full">
                <div className="border rounded-lg p-4 bg-gray-800 w-full">
                  <h3 className="font-semibold text-left mb-2 text-white">Received Zupass Data:</h3>
                  <pre className="overflow-auto text-xs text-left max-h-40 bg-gray-800 p-2 rounded border text-white">
                    {receivedData.substring(0, 500)}
                    {receivedData.length > 500 ? '...' : ''}
                  </pre>
                </div>

                <div className="flex flex-col space-y-3 w-full">
                  <button
                    onClick={redirectToOrigin}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Data Saved, Return to Home
                  </button>

                  <button
                    onClick={() => {
                      setReceivedData(null);
                      localStorage.removeItem('zupass_pcd_data');
                      console.log('🗑️ Cleared Zupass data from localStorage');
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                  >
                    Clear Data and Try Again
                  </button>
                </div>
              </div>
            ) : (
              !isLoading && (
                <div className="flex flex-col space-y-3 w-full">
                  <button
                    onClick={openZupassPopup}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Open Zupass Popup
                  </button>

                  <button
                    onClick={() => (window.location.href = '/example-page')}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  >
                    Return to Main Page
                  </button>
                </div>
              )
            )}
          </div>
        ) : (
          <div className="text-red-500 p-3 bg-red-50 rounded">
            <p className="font-medium">Error Occurred</p>
            <p className="text-sm mt-1 mb-3">{error}</p>

            <div className="flex flex-col space-y-3">
              <button
                onClick={openZupassPopup}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Retry Opening Zupass
              </button>

              <button
                onClick={() => (window.location.href = '/example-page')}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Return to Main Page
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
