'use client';

import React, { useState, useEffect } from 'react';
import { addPODPCD } from '../utils';
import { convertProofForPOD } from '../utils/podConverter';
import { VerificationData } from '../types';
import { useRouter } from 'next/navigation';

function VerifiedPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<VerificationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [podFolder, setPodFolder] = useState('Self Passport Data');
  const [podPrivateKey] = useState('AAECAwQFBgcICQABAgMEBQYHCAkAAQIDBAUGBwgJAAE='); // TODO: use stored pkey here, should change to user's pkey.

  useEffect(() => {
    // Ensure this runs only on the client
    if (typeof window !== 'undefined') {
      const storedUserId = sessionStorage.getItem('userId');
      setUserId(storedUserId);

      if (!storedUserId) {
        setError('User ID not found in session storage.');
        setIsLoading(false);
        return;
      }

      const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetch(`/api/retrieve/${storedUserId}`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          setUserData(data);
        } catch (e: unknown) {
          console.error('Failed to fetch verification data:', e);
          if (e instanceof Error) {
            setError(e.message);
          } else {
            setError('An unknown error occurred while fetching verification data.');
          }
        } finally {
          setIsLoading(false);
        }
      };

      fetchData();
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading data...</div>;
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen text-red-500">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-900 text-white">
      <h1 className="text-2xl font-bold mb-4 text-white">Verification Data</h1>
      <p className="text-sm text-gray-300 mb-8 max-w-xl text-center italic">
        This is your proof data from Self, these are not stored anyway else but in your zupass.
      </p>
      {message && <div className="bg-blue-800 px-4 py-2 rounded mb-4 text-white">{message}</div>}
      <p className="mb-4 text-sm text-gray-300">User ID: {userId?.substring(0, 8)}...</p>
      {userData ? (
        <div className="bg-gray-800 p-3 rounded shadow w-full max-w-2xl border border-gray-700">
          <pre className="text-sm overflow-x-auto text-green-300 max-h-60 overflow-y-auto">
            {JSON.stringify(userData, null, 2)}
          </pre>

          <div className="mt-4 flex flex-col items-center">
            <div className="mb-2 flex items-center">
              <label className="text-white text-xs mr-2">
                Folder name:
                <input
                  type="text"
                  value={podFolder}
                  onChange={(e) => setPodFolder(e.target.value)}
                  className="ml-2 p-1 border bg-gray-700 text-white text-xs rounded"
                />
              </label>
            </div>

            <button
              onClick={() => {
                if (!userData?.data) {
                  setError('No verification data available');
                  return;
                }

                try {
                  // Extract proof and public signals from userData
                  const { proof, public_signals, disclosure_data } = userData.data;

                  // Convert proof and public signals to POD format
                  const podData = convertProofForPOD(proof, public_signals);

                  // Add disclosure data to podData
                  if (disclosure_data) {
                    Object.entries(disclosure_data).forEach(([key, value]) => {
                      // Handle arrays and objects by stringifying them
                      if (typeof value === 'object' && value !== null) {
                        podData[`disclosure_${key}`] = JSON.stringify(value);
                      } else {
                        podData[`disclosure_${key}`] = String(value);
                      }
                    });
                  }

                  // Convert to POD string
                  const podString = JSON.stringify(podData);

                  // Add to Zupass - this will open a popup window
                  setMessage('Opening Zupass popup...');
                  addPODPCD(podString, podPrivateKey, podFolder);

                  // The global zupassPopupWindow variable is maintained in utils.ts
                  // We need to set up a check to monitor when that window closes
                  setMessage('Waiting for Zupass popup to close...');

                  // Set up an interval to check if popup is closed
                  const checkPopupInterval = setInterval(() => {
                    // Check if the global popup variable is null or closed
                    // This works because sendZupassRequest in utils.ts sets zupassPopupWindow to null when closed
                    if (!document.querySelector('.zupass-popup-open')) {
                      // Clear the interval
                      clearInterval(checkPopupInterval);

                      // Show message before redirecting
                      setMessage('Zupass data added successfully. Redirecting to buy page...');

                      // Short delay before redirecting
                      setTimeout(() => {
                        router.push('/buy');
                      }, 1000);
                    }
                  }, 500); // Check every 500ms
                } catch (e) {
                  console.error('Error adding to Zupass:', e);
                  setError(e instanceof Error ? e.message : 'Failed to add data to Zupass');
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
            >
              Store in Zupass
            </button>
          </div>
        </div>
      ) : (
        <p className="text-yellow-300">No data found for this user.</p>
      )}
    </div>
  );
}

export default VerifiedPage;
