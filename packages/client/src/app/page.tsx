'use client';

import React, { useState, useEffect } from 'react';
import SelfQRcodeWrapper, { countries, SelfApp, SelfAppBuilder } from '@selfxyz/qrcode';
import { v4 as uuidv4 } from 'uuid';
import { logo } from '../../public/logo';

function Playground() {
  const [userId, setUserId] = useState<string | null>(null);
  const endpoint = process.env.NEXT_PUBLIC_NGROK_ENDPOINT;

  if (!endpoint) {
    console.error('Missing NGROK_ENDPOINT in ENV');
  }

  useEffect(() => {
    setUserId(uuidv4());
  }, []);

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

  if (!userId) return null;

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
        <div className="w-full max-w-6xl flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-1/2 flex flex-col items-center justify-center">
            <SelfQRcodeWrapper
              selfApp={selfApp}
              onSuccess={() => {
                console.log('Verification successful');
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

export default Playground;
