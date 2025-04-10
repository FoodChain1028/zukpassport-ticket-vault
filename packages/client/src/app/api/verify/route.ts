import { NextResponse } from 'next/server';
import { getUserIdentifier, SelfBackendVerifier, countryCodes } from '@selfxyz/core';
// import { kv } from '@vercel/kv';
// import { SelfApp } from '@selfxyz/qrcode';

export async function POST(request: Request) {
  try {
    const { proof, publicSignals } = await request.json();
    const endpoint = process.env.NEXT_PUBLIC_NGROK_ENDPOINT;
    if (!endpoint) {
      return NextResponse.json({ message: 'Missing NGROK_ENDPOINT in ENV' }, { status: 500 });
    }

    console.log('Received Proof:', proof);
    console.log('Received Public Signals:', publicSignals);

    if (!proof || !publicSignals) {
      return NextResponse.json(
        { message: 'Proof and publicSignals are required' },
        { status: 400 },
      );
    }

    const userId = await getUserIdentifier(publicSignals);
    console.log('Extracted userId from verification result:', userId);

    // Default options
    const minimumAge = 18;
    const excludedCountryList: string[] = [];
    const enableOfac = false;
    const enabledDisclosures = {
      issuing_state: false,
      name: false,
      nationality: false,
      date_of_birth: false,
      passport_number: false,
      gender: false,
      expiry_date: false,
    };

    const configuredVerifier = new SelfBackendVerifier('self-playground', endpoint, 'uuid', false);

    if (minimumAge !== undefined) {
      configuredVerifier.setMinimumAge(minimumAge);
    }

    if (excludedCountryList.length > 0) {
      configuredVerifier.excludeCountries(
        ...(excludedCountryList as (keyof typeof countryCodes)[]),
      );
    }

    if (enableOfac) {
      configuredVerifier.enableNameAndDobOfacCheck();
    }

    const result = await configuredVerifier.verify(proof, publicSignals);
    console.log('Verification result:', result);

    if (result.isValid) {
      const filteredSubject = { ...result.credentialSubject };

      if (!enabledDisclosures.issuing_state && filteredSubject) {
        filteredSubject.issuing_state = 'Not disclosed';
      }
      if (!enabledDisclosures.name && filteredSubject) {
        filteredSubject.name = 'Not disclosed';
      }
      if (!enabledDisclosures.nationality && filteredSubject) {
        filteredSubject.nationality = 'Not disclosed';
      }
      if (!enabledDisclosures.date_of_birth && filteredSubject) {
        filteredSubject.date_of_birth = 'Not disclosed';
      }
      if (!enabledDisclosures.passport_number && filteredSubject) {
        filteredSubject.passport_number = 'Not disclosed';
      }
      if (!enabledDisclosures.gender && filteredSubject) {
        filteredSubject.gender = 'Not disclosed';
      }
      if (!enabledDisclosures.expiry_date && filteredSubject) {
        filteredSubject.expiry_date = 'Not disclosed';
      }

      return NextResponse.json({
        status: 'success',
        result: result.isValid,
        credentialSubject: filteredSubject,
        verificationOptions: {
          minimumAge,
          ofac: enableOfac,
          excludedCountries: excludedCountryList.map((countryName) => {
            const entry = Object.entries(countryCodes).find(([, name]) => name === countryName);
            return entry ? entry[0] : countryName;
          }),
        },
      });
    } else {
      return NextResponse.json(
        {
          status: 'error',
          result: result.isValid,
          message: 'Verification failed',
          details: result,
        },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error('Error verifying proof:', error);
    return NextResponse.json(
      {
        message: 'Error verifying proof',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
