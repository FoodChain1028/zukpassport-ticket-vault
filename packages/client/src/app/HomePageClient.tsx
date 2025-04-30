'use client';

import React, { useState, useEffect } from 'react';
import SelfQRcodeWrapper, { countries, SelfApp, SelfAppBuilder } from '@selfxyz/qrcode';
import { v4 as uuidv4 } from 'uuid';
import { logo } from '../../public/logo';
import { useRouter } from 'next/navigation';
import { addPODPCD } from './utils';
import { convertProofForPOD } from './utils/podConverter';
import { VerificationData } from './types';

export default function HomePageClient() {
  const [userId, setUserId] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [showAuthModal, setShowAuthModal] = useState<'signin' | 'signup' | null>(null);
  const [signupStep, setSignupStep] = useState<'self' | 'zupass'>('self');
  const [userData, setUserData] = useState<VerificationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [podFolder, setPodFolder] = useState('Self Passport Data');
  const [podPrivateKey] = useState('AAECAwQFBgcICQABAgMEBQYHCAkAAQIDBAUGBwgJAAE=');
  const [userAuth, setUserAuth] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      let storedUserId = sessionStorage.getItem('userId');
      if (!storedUserId) {
        storedUserId = uuidv4();
        sessionStorage.setItem('userId', storedUserId);
      }
      setUserId(storedUserId);

      // Check if user is authenticated
      const authData = sessionStorage.getItem('userAuth');
      if (authData) {
        try {
          const parsedAuth = JSON.parse(authData);
          setUserAuth(parsedAuth);
        } catch (e) {
          console.error('Error parsing auth data:', e);
        }
      }
    }
  }, []);

  const endpoint = process.env.NEXT_PUBLIC_NGROK_ENDPOINT;

  if (!endpoint) {
    console.error('Missing NGROK_ENDPOINT in ENV');
  }

  const disclosures = {
    issuing_state: false,
    name: true,
    nationality: true,
    date_of_birth: false,
    passport_number: false,
    gender: false,
    expiry_date: false,
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
    return <div>Loading...</div>;
  }

  const selfApp = new SelfAppBuilder({
    appName: 'Self Playground',
    scope: 'self-playground',
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

  const handleRedirectToSignIn = () => {
    router.push('/signin');
  };

  const handleSignOut = () => {
    sessionStorage.removeItem('userAuth');
    setUserAuth(null);
  };

  const fetchVerificationData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/retrieve/${userId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setUserData(data);
      setSignupStep('zupass');
    } catch (e) {
      console.error('Failed to fetch verification data:', e);
      setError(e instanceof Error ? e.message : 'Failed to fetch verification data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleZupassStorage = async () => {
    if (!userData?.data) {
      setError('No verification data available');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      setMessage('Opening Zupass popup...');

      // Extract proof and public signals from userData
      const { proof, public_signals, disclosure_data } = userData.data;

      // Convert proof and public signals to POD format
      const podData = convertProofForPOD(proof, public_signals);

      // Add disclosure data to podData
      if (disclosure_data) {
        Object.entries(disclosure_data).forEach(([key, value]) => {
          if (typeof value === 'object' && value !== null) {
            podData[`disclosure_${key}`] = JSON.stringify(value);
          } else {
            podData[`disclosure_${key}`] = String(value);
          }
        });
      }

      // Convert to POD string
      const podString = JSON.stringify(podData);

      // Add to Zupass
      addPODPCD(podString, podPrivateKey, podFolder);

      // Monitor Zupass popup
      const checkPopupInterval = setInterval(() => {
        if (!document.querySelector('.zupass-popup-open')) {
          clearInterval(checkPopupInterval);
          setMessage('Zupass data added successfully. Redirecting to buy page...');
          setTimeout(() => {
            router.push('/buy');
          }, 1000);
        }
      }, 500);
    } catch (e) {
      console.error('Error adding to Zupass:', e);
      setError(e instanceof Error ? e.message : 'Failed to add data to Zupass');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-gray-900 text-white">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-xl font-bold">Z</span>
            </div>
            <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              ZukPassport
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 text-sm">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>Hylé Network</span>
            </div>
            
            {userAuth ? (
              <>
                <div className="px-4 py-2 text-sm font-medium bg-white/10 rounded-md flex items-center space-x-2">
                  <span role="img" aria-label="Verified user" className="text-green-400">✓</span>
                  <span>{(userAuth.profile?.name?.split(' ')[0] || 'User').substring(2)}</span>
                </div>
                <div className="px-4 py-2 text-sm font-medium bg-green-500/10 rounded-md flex items-center space-x-2">
                  <span className="text-green-400">${userAuth.balance?.toLocaleString() || '0'}</span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 text-sm font-medium text-white hover:text-blue-300 transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleRedirectToSignIn}
                  className="px-4 py-2 text-sm font-medium text-white hover:text-blue-300 transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => setShowAuthModal('signup')}
                  className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-blue-500 to-purple-500 rounded-md hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="container mx-auto px-6 py-20">
        <div className="flex flex-col lg:flex-row items-center justify-between">
          <div className="lg:w-1/2 mb-16 lg:mb-0">
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-500/20 rounded-full text-blue-300 text-sm mb-6">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>Regional Pricing Available</span>
            </div>
            <h1 className="text-6xl font-bold mb-6 leading-tight">
              Personalized{' '}
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Ticket Pricing
              </span>
            </h1>
            <p className="text-xl text-gray-300 mb-8 leading-relaxed">
              Get exclusive pricing based on your nationality. Up to 20% off for eligible countries, all secured by Hylé blockchain technology for trusted identity verification.
            </p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <button
                onClick={() => setShowAuthModal('signup')}
                className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg text-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg"
              >
                Get Started
              </button>
              <button className="px-8 py-4 border border-white/20 rounded-lg text-lg font-medium hover:bg-white/10 transition-all">
                Learn About Pricing
              </button>
            </div>
          </div>
          <div className="lg:w-1/2">
            <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl shadow-2xl border border-white/10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Featured Events</h2>
                <div className="flex items-center space-x-2 text-sm text-blue-300">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span>Regional Discounts Available</span>
                </div>
              </div>
              <div className="space-y-4">
                <div 
                  onClick={() => {
                    if (userAuth) {
                      const params = new URLSearchParams({
                        name: encodeURIComponent('Summer Music Festival'),
                        date: encodeURIComponent('July 15-17, 2024'),
                        price: encodeURIComponent('Starting at $100'),
                        type: encodeURIComponent('Early Bird'),
                        id: '0x1234...5678'
                      });
                      router.push(`/buy?${params.toString()}`);
                    } else {
                      setShowAuthModal('signin');
                    }
                  }}
                  className="bg-white/5 p-6 rounded-xl border border-white/10 hover:bg-white/10 transition-all cursor-pointer transform hover:scale-[1.02]"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-lg">Summer Music Festival</h3>
                      <p className="text-gray-400">July 15-17, 2024</p>
                    </div>
                    <div className="px-3 py-1 bg-blue-500/20 rounded-full text-blue-300 text-sm">
                      Early Bird
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-blue-400 font-medium">Starting at $100</p>
                    <div className="text-xs text-gray-400">Proof ID: 0x1234...5678</div>
                  </div>
                </div>
                <div 
                  onClick={() => {
                    if (userAuth) {
                      const params = new URLSearchParams({
                        name: encodeURIComponent('Tech Conference'),
                        date: encodeURIComponent('August 5-7, 2024'),
                        price: encodeURIComponent('Starting at $299'),
                        type: encodeURIComponent('VIP Access'),
                        id: '0x9abc...def0'
                      });
                      router.push(`/buy?${params.toString()}`);
                    } else {
                      setShowAuthModal('signin');
                    }
                  }}
                  className="bg-white/5 p-6 rounded-xl border border-white/10 hover:bg-white/10 transition-all cursor-pointer transform hover:scale-[1.02]"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-lg">Tech Conference</h3>
                      <p className="text-gray-400">August 5-7, 2024</p>
                    </div>
                    <div className="px-3 py-1 bg-purple-500/20 rounded-full text-purple-300 text-sm">
                      VIP Access
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-blue-400 font-medium">Starting at $299</p>
                    <div className="text-xs text-gray-400">Proof ID: 0x9abc...def0</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full border border-white/10">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {showAuthModal === 'signin' ? 'Sign In' : 'Sign Up'}
                </h2>
                <p className="text-sm text-gray-400 mt-1">Get personalized ticket pricing</p>
              </div>
              <button
                onClick={() => setShowAuthModal(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {showAuthModal === 'signup' ? (
              <div className="text-center">
                {signupStep === 'self' ? (
                  <>
                    <p className="text-gray-300 mb-6">Step 1: Verify your identity for personalized pricing</p>
                    <div className="flex justify-center">
                      <SelfQRcodeWrapper
                        selfApp={selfApp}
                        onSuccess={() => {
                          setTimeout(() => {
                            fetchVerificationData();
                          }, 1500);
                        }}
                        darkMode={false}
                      />
                    </div>
                    <p className="text-sm text-gray-400 mt-4">
                      Your nationality will be verified for regional pricing benefits
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-300 mb-6">Step 2: Store your verified identity securely</p>
                    {message && <div className="bg-blue-800 px-4 py-2 rounded mb-4 text-white">{message}</div>}
                    {error && <div className="text-red-400 text-sm text-center mb-4">{error}</div>}
                    <div className="flex flex-col items-center space-y-4">
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
                        onClick={handleZupassStorage}
                        disabled={isLoading}
                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg text-white font-medium hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoading ? 'Processing...' : 'Store in Zupass'}
                      </button>
                    </div>
                    <p className="text-sm text-gray-400 mt-4">
                      Your verified identity enables regional pricing and is securely stored in your Zupass wallet
                    </p>
                    <button
                      onClick={() => setSignupStep('self')}
                      className="mt-4 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      ← Back to Self verification
                    </button>
                  </>
                )}
              </div>
            ) : (
              <form className="space-y-4" onSubmit={(e) => {e.preventDefault(); handleRedirectToSignIn();}}>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your email"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 block w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your password"
                  />
                </div>
                {error && (
                  <div className="text-red-400 text-sm text-center">{error}</div>
                )}
                <button
                  type="submit"
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all transform hover:scale-105"
                >
                  Sign in
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 