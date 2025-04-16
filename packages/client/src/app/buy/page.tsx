'use client';

import { useEffect, useState, useRef } from 'react';
import { useZupassPopupMessages } from '@pcd/passport-interface';
import { getPCDFromZupass, storePCDDataAndRedirect } from '../utils';
import { PODPCDPackage } from '@pcd/pod-pcd';

export default function Buy() {
  const [message, setMessage] = useState('Choose your action');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasProcessedUrl, setHasProcessedUrl] = useState(false);
  const [receivedData, setReceivedData] = useState<string | null>(null);
  const [formattedData, setFormattedData] = useState<any>(null);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [isSending, setIsSending] = useState(false);

  const handleDataReceived = (data: string) => {
    setReceivedData(data);
    setIsLoading(false);

    try {
      // Try to parse and format the nested JSON data
      const parsed = JSON.parse(data);
      console.log('Parsed data type:', typeof parsed);

      // Handle the case where we have a nested PCD string that needs further parsing
      if (parsed.type === 'pod-pcd' && typeof parsed.pcd === 'string') {
        try {
          // Parse the inner PCD JSON string
          const pcdData = JSON.parse(parsed.pcd);

          // Extract and process proof fields into an array
          const proof: {
            a?: string[];
            b?: string[][];
            c?: string[];
            protocol?: string;
            curve?: string;
          } = {};
          const publicSignalArray: string[] = [];

          if (pcdData.jsonPOD?.entries) {
            const entries = pcdData.jsonPOD.entries;

            // Process all proof fields and organize them
            const proofA = [entries.proof_a_0, entries.proof_a_1].filter(Boolean);
            const proofB = [
              [entries.proof_b_0_0, entries.proof_b_0_1].filter(Boolean),
              [entries.proof_b_1_0, entries.proof_b_1_1].filter(Boolean),
            ].filter((arr) => arr.length > 0);
            const proofC = [entries.proof_c_0, entries.proof_c_1].filter(Boolean);

            // Process all public signal fields
            // Find all entries that start with public_signal_ and sort them numerically

            const publicSignalKeys = Object.keys(entries)
              .filter((key) => key.startsWith('public_signal_'))
              .sort((a, b) => {
                // sort them numerically
                const numA = parseInt(a.replace('public_signal_', ''), 10);
                const numB = parseInt(b.replace('public_signal_', ''), 10);
                return numA - numB;
              });

            // Extract the values in proper order
            publicSignalKeys.forEach((key) => {
              if (entries[key]) {
                publicSignalArray.push(entries[key]);
              }
            });

            // Add the proof details to the proof array if they exist
            if (proofA.length > 0) proof.a = proofA;
            if (proofB.length > 0) proof.b = proofB;
            if (proofC.length > 0) proof.c = proofC;
            if (entries.proof_protocol) proof.protocol = entries.proof_protocol;
            if (entries.proof_curve) proof.curve = entries.proof_curve;
          }

          // Create a clean formatted object with better structure
          const formatted = {
            type: parsed.type,
            // Extract relevant fields from the passport data
            passport: {
              nationality: pcdData.jsonPOD?.entries?.disclosure_nationality || 'Unknown',
              name: pcdData.jsonPOD?.entries?.disclosure_name || 'Unknown',
              older_than: pcdData.jsonPOD?.entries?.disclosure_older_than || 'Unknown',
              proof: proof,
              publicSignal: publicSignalArray,
            },
            // Include the full data for reference
            fullData: pcdData,
          };

          setFormattedData(formatted);
        } catch (innerError) {
          console.error('Error parsing inner PCD data:', innerError);
          // If inner parsing fails, use the original parsed data
          setFormattedData(parsed);
        }
      } else {
        // If it's not the expected structure, just use the parsed data as is
        setFormattedData(parsed);
      }

      setMessage('Data received and formatted. Ready to submit to API.');
    } catch (e) {
      console.error('Error formatting data:', e);
      setError(`Failed to format data: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // Use the official hook to receive messages from Zupass popup
  const [zupassPCDStr] = useZupassPopupMessages();
  const popupWindowRef = useRef<Window | null>(null);

  // Process URL parameters
  const processUrlParams = () => {
    if (typeof window === 'undefined') return false;

    try {
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

  // Setup a backup event listener
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleWindowMessage = (event: MessageEvent) => {
      console.log('👂 Received window message:', event.data);

      if (typeof event.data === 'string' || (event.data && event.data.pcd)) {
        const data = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
        console.log('💾 Processing data received from window.message');
        setIsLoading(false);

        try {
          localStorage.setItem('zupass_pcd_data', data);
          handleDataReceived(data);
        } catch (e) {
          console.error('Error processing window.message message:', e);
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
      console.log('📦 Found existing Zupass data in localStorage');
      handleDataReceived(savedData);
    }
  }, [receivedData]);

  // Check URL parameters on page load
  useEffect(() => {
    if (!hasProcessedUrl) {
      const hasData = processUrlParams();
      setHasProcessedUrl(true);

      if (!hasData) {
        setMessage('Please select an option below');
      }
    }
  }, [hasProcessedUrl]);

  // Function to open Zupass popup
  const openZupassPopup = () => {
    setIsLoading(true);
    setMessage('Opening Zupass popup...');
    setError(null);
    setApiResponse(null);

    try {
      // Record current page as redirect target
      localStorage.setItem('zupass_redirect_path', window.location.pathname);

      // Open the Zupass popup
      const popupWindow = getPCDFromZupass(PODPCDPackage.name);

      if (!popupWindow) {
        throw new Error('Popup was blocked by the browser');
      }

      popupWindowRef.current = popupWindow;
      setMessage('Zupass popup opened. Please select data in the popup');

      // Monitor popup status
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
          setMessage('Operation timed out. Please try again');
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

  // Function to send data to API
  const sendToApi = async () => {
    if (!formattedData) {
      setError('No formatted data available to send');
      return;
    }

    setIsSending(true);
    setMessage('Sending data to API...');

    try {
      // This is a mock API call - replace with your actual API endpoint
      // For now, we'll simulate a delay and response
      console.log('📤 Sending data to API:', formattedData);

      await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate API call delay

      // Mock API response
      const mockResponse = {
        success: true,
        transactionId: `tx-${Math.random().toString(36).substring(2, 10)}`,
        timestamp: new Date().toISOString(),
        message: 'Transaction processed successfully',
      };

      console.log('📥 Received API response:', mockResponse);
      setApiResponse(mockResponse);
      setMessage('Transaction completed successfully!');
    } catch (e) {
      console.error('Error sending data to API:', e);
      setError(`API call failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSending(false);
    }
  };

  // Clear all data and reset the form
  const clearAll = () => {
    setReceivedData(null);
    setFormattedData(null);
    setApiResponse(null);
    localStorage.removeItem('zupass_pcd_data');
    setMessage('Data cleared. Ready for a new transaction.');
    console.log('🗑️ Cleared all data');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-gray-900 p-6 rounded-lg shadow-md max-w-lg w-full text-center">
        <h1 className="text-xl font-bold mb-4 text-white">Zupass Buy Transaction</h1>

        {!error ? (
          <div className="flex flex-col items-center w-full">
            {isLoading && (
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
            )}

            <p className="text-gray-300 mb-4">{message}</p>

            {/* Show received and formatted data */}
            {receivedData && formattedData && !apiResponse ? (
              <div className="flex flex-col space-y-4 w-full">
                <div className="border rounded-lg p-4 bg-gray-800 w-full">
                  <h3 className="font-semibold text-left mb-2 text-white">
                    Formatted Transaction Data:
                  </h3>
                  <pre className="overflow-auto text-xs text-left max-h-40 bg-gray-800 p-2 rounded border text-white">
                    {JSON.stringify(formattedData, null, 2)}
                  </pre>
                </div>

                <div className="flex flex-col space-y-3 w-full">
                  <button
                    onClick={sendToApi}
                    disabled={isSending}
                    className={`px-4 py-2 ${isSending ? 'bg-blue-400' : 'bg-blue-600'} text-white rounded hover:bg-blue-700 transition-colors`}
                  >
                    {isSending ? 'Processing...' : 'Confirm and Submit Transaction'}
                  </button>

                  <button
                    onClick={clearAll}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                    disabled={isSending}
                  >
                    Cancel and Clear Data
                  </button>
                </div>
              </div>
            ) : apiResponse ? (
              <div className="flex flex-col space-y-4 w-full">
                <div className="border border-green-500 rounded-lg p-4 bg-gray-800 w-full">
                  <h3 className="font-semibold text-left mb-2 text-green-400">
                    Transaction Successful!
                  </h3>
                  <div className="text-left text-white">
                    <p>
                      <span className="text-gray-400">Transaction ID:</span>{' '}
                      {apiResponse.transactionId}
                    </p>
                    <p>
                      <span className="text-gray-400">Timestamp:</span> {apiResponse.timestamp}
                    </p>
                    <p>
                      <span className="text-gray-400">Status:</span>{' '}
                      <span className="text-green-400">Completed</span>
                    </p>
                  </div>
                  <pre className="overflow-auto text-xs text-left mt-4 max-h-40 bg-gray-700 p-2 rounded border text-white">
                    {JSON.stringify(apiResponse, null, 2)}
                  </pre>
                </div>

                <div className="flex flex-col space-y-3 w-full">
                  <button
                    onClick={clearAll}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Start New Transaction
                  </button>

                  <button
                    onClick={() => (window.location.href = '/')}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  >
                    Return to Home
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
                    Open Zupass to Verify Identity
                  </button>

                  <button
                    onClick={() => (window.location.href = '/')}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  >
                    Return to Home
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
                Retry with Zupass
              </button>

              <button
                onClick={clearAll}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Clear and Try Again
              </button>

              <button
                onClick={() => (window.location.href = '/')}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Return to Home
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
