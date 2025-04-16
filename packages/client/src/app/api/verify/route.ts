import { NextResponse } from 'next/server';
import { SelfBackendVerifier, countryCodes, getUserIdentifier } from '@selfxyz/core';
import { addVerificationData } from '../../../utils/db';

export async function POST(request: Request) {
  try {
    const { proof, publicSignals } = await request.json();
    console.log('Received proof and public signals:', { proof, publicSignals });
    const endpoint = process.env.NEXT_PUBLIC_NGROK_ENDPOINT;
    if (!endpoint) {
      return NextResponse.json({ message: 'Missing NGROK_ENDPOINT in ENV' }, { status: 500 });
    }

    if (!proof || !publicSignals) {
      return NextResponse.json(
        { message: 'Proof and publicSignals are required' },
        { status: 400 },
      );
    }

    const userId = await getUserIdentifier(publicSignals);
    console.log('Extracted userId from verification result:', userId);

    // Default options
    const minimumAge = 14;
    const excludedCountryList: string[] = [];
    const enableOfac = false;

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
    const data = result.credentialSubject;

    if (result.isValid) {
      console.log('Verification successful');
      try {
        await addVerificationData(userId, proof, publicSignals, data);
        console.log(`Verification data stored for UID: ${userId}`);
      } catch (dbError) {
        console.error('Failed to store verification data:', dbError);
        return NextResponse.json({ message: 'Failed to store verification data' }, { status: 500 });
      }

      // try {
      //   const data = await getVerificationData(userId);
      //   console.log('Data:', data);
      // } catch (dbError) {
      //   console.error('Failed to retrieve verification data:', dbError);
      //   return NextResponse.json(
      //     { message: 'Failed to retrieve verification data' },
      //     { status: 500 },
      //   );
      // }

      return NextResponse.json({
        status: 'success',
        result: result.isValid,
        credentialSubject: data,
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
