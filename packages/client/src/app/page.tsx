'use client';

import React, { useState, useEffect } from 'react';
import SelfQRcodeWrapper, { countries, SelfApp, SelfAppBuilder } from '@selfxyz/qrcode';
import { v4 as uuidv4 } from 'uuid';
import { logo } from '../../public/logo';
import { useRouter } from 'next/navigation';

function SelfQrcodeScanner() {
  const [userId, setUserId] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    // Check if running in the browser
    if (typeof window !== 'undefined') {
      let storedUserId = sessionStorage.getItem('userId');
      if (!storedUserId) {
        storedUserId = uuidv4();
        sessionStorage.setItem('userId', storedUserId);
        console.log('Generated and stored new userId:', storedUserId);
      } else {
        console.log('Retrieved existing userId:', storedUserId);
      }
      setUserId(storedUserId);
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  const endpoint = process.env.NEXT_PUBLIC_NGROK_ENDPOINT;

  if (!endpoint) {
    console.error('Missing NGROK_ENDPOINT in ENV');
  }

  const disclosures = {
    // DG1 disclosures
    issuing_state: false,
    name: true,
    nationality: true,
    date_of_birth: false,
    passport_number: false,
    gender: false,
    expiry_date: false,
    // Custom checks
    minimumAge: 14,
    excludedCountries: [
      countries.IRAN,
      countries.IRAQ,
      countries.NORTH_KOREA,
      countries.RUSSIA,
      countries.SYRIAN_ARAB_REPUBLIC,
      countries.VENEZUELA,
    ],
    ofac: true,
  };

  if (!userId) {
    // Render nothing or a loading state until userId is set
    return <div>Loading...</div>;
  }

  const selfApp = new SelfAppBuilder({
    appName: 'Self Playground',
    scope: 'self-playground',
    // endpoint: "https://playground.self.xyz/api/verify",
    endpoint: endpoint + '/api/verify',
    endpointType: 'https',
    logoBase64: logo,
    userId,
    disclosures: {
      ...disclosures,
      minimumAge: disclosures.minimumAge > 0 ? disclosures.minimumAge : undefined,
    },
    devMode: false,
  } as Partial<SelfApp>).build();

  return (
    <div className="App flex flex-col min-h-screen bg-white text-black" suppressHydrationWarning>
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="flex flex-col items-center justify-center">
          <h1 className="text-2xl font-bold mb-8">Passport Verification</h1>
          <p className="text-sm text-gray-700 mb-8 max-w-xl text-center italic">
            Open Your Selfxyz App and scan the qrcode, by doing so, you prove you have a valid
            passport and agree to reveal your name and nationality to this app
          </p>
          <div className="flex flex-col items-center justify-center">
            <SelfQRcodeWrapper
              selfApp={selfApp}
              onSuccess={() => {
                console.log('Verification successful, navigating...');
                // wait for a few second for better UX
                setTimeout(() => {
                  router.push('/verified');
                }, 1500);
              }}
              darkMode={false}
            />
            <p className="mt-4 text-sm text-gray-700">User ID: {userId.substring(0, 8)}...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SelfQrcodeScanner;
