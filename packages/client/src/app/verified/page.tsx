'use client';

import React, { useState, useEffect } from 'react';

function VerifiedPage() {
  const [userData, setUserData] = useState<unknown | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

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
      <p className="mb-4 text-sm text-gray-300">User ID: {userId?.substring(0, 8)}...</p>
      {userData ? (
        <div className="bg-gray-800 p-3 rounded shadow w-full max-w-2xl border border-gray-700">
          <pre className="text-sm overflow-x-auto text-green-300 max-h-120 overflow-y-auto">
            {JSON.stringify(userData, null, 2)}
          </pre>
        </div>
      ) : (
        <p className="text-yellow-300">No data found for this user.</p>
      )}
    </div>
  );
}

export default VerifiedPage;
