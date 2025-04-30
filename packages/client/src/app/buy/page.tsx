'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function Buy() {
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [accountBalance, setAccountBalance] = useState<number>(0);
  const [ticketInfo, setTicketInfo] = useState<{
    name: string;
    date: string;
    price: string;
    type: string;
    id: string;
    image?: string;
    location?: string;
  } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'balance' | 'card'>('balance');
  
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check if user is authenticated
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCheckingAuth(true);
      const authData = sessionStorage.getItem('userAuth');
      
      // Check for ticket info in URL params
      const ticketName = searchParams.get('name');
      const ticketDate = searchParams.get('date');
      const ticketPrice = searchParams.get('price');
      const ticketType = searchParams.get('type');
      const ticketId = searchParams.get('id');
      const ticketLocation = searchParams.get('location');
      
      if (ticketName && ticketDate && ticketPrice) {
        setTicketInfo({
          name: decodeURIComponent(ticketName),
          date: decodeURIComponent(ticketDate),
          price: decodeURIComponent(ticketPrice),
          type: ticketType ? decodeURIComponent(ticketType) : 'Standard',
          id: ticketId || '0x1234',
          location: ticketLocation ? decodeURIComponent(ticketLocation) : 'Various Venues',
          image: `/images/${ticketType?.toLowerCase().includes('vip') ? 'tech-conference.jpg' : 'music-festival.jpg'}`
        });
      }
      
      if (authData) {
        try {
          const parsedAuth = JSON.parse(authData);
          if (parsedAuth.isAuthenticated) {
            setIsAuthenticated(true);
            setUserProfile(parsedAuth.profile);
            setAccountBalance(parsedAuth.balance || 0);
            setCheckingAuth(false);
          } else {
            // Redirect to sign-in page if not authenticated
            router.push('/signin');
          }
        } catch (e) {
          console.error('Error parsing auth data:', e);
          router.push('/signin');
        }
      } else {
        // No auth data found, redirect to sign-in
        router.push('/signin');
      }
    }
  }, [router, searchParams]);

  // Calculate price
  const calculatePrice = (): number => {
    if (!ticketInfo) return 0;
    const basePrice = parseFloat(ticketInfo.price.replace(/[^0-9.-]+/g, ''));
    
    // Apply nationality-based discounts

    let discountedPrice = basePrice;
    if (userProfile && userProfile.nationality) {
      if (userProfile.nationality === 'FRA') {
        // 10% discount for French nationality
        discountedPrice = basePrice * 0.9;
      } else if (userProfile.nationality === 'TWN') {
        // 20% discount for Taiwanese nationality
        discountedPrice = basePrice * 0.8;
      }
    }
    
    return discountedPrice * quantity;
  };

  // Purchase ticket function
  const purchaseTicket = async () => {
    if (!ticketInfo) {
      setError('No ticket selected');
      return;
    }

    setIsLoading(true);
    setMessage('Processing your purchase...');
    setError(null);

    try {
      // Simulate multi-step purchase process
      setProcessingStep(1); // Verifying identity
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setProcessingStep(2); // Securing payment
      await new Promise(resolve => setTimeout(resolve, 900));
      
      setProcessingStep(3); // Finalizing transaction
      
      // Make the actual API call to buy the ticket
      const totalPrice = Math.round(calculatePrice() * 10);
      console.log(userProfile?.nationality)
      const response = await fetch('http://localhost:4000/api/buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user': 'faucet.hydentity',
          'x-session-key': 'your_session_key',
          'x-request-signature': 'your_signature'
        },
        body: JSON.stringify({
          nonce: 1,
          price: totalPrice,
          nationality: userProfile?.nationality || 'USA'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Purchase failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      const txHash = data || `tx-${Math.random().toString(36).substring(2, 10)}`;
      
      setTransactionId(txHash);
      setPurchaseComplete(true);
      setMessage('Your purchase was successful!');
      
      // Update balance in session storage (simulate)
      const authData = sessionStorage.getItem('userAuth');
      if (authData) {
        const parsedAuth = JSON.parse(authData);
        const ticketTotalPrice = calculatePrice();
        const newBalance = (parsedAuth.balance || 0) - ticketTotalPrice;
        
        sessionStorage.setItem('userAuth', JSON.stringify({
          ...parsedAuth,
          balance: newBalance
        }));
        
        setAccountBalance(newBalance);
      }
    } catch (e) {
      console.error('Error processing purchase:', e);
      setError(`Purchase failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
      setProcessingStep(0);
    }
  };

  // Handle quantity change
  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity < 1) return;
    if (newQuantity > 10) return;
    setQuantity(newQuantity);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-gray-900 text-white">
      <nav className="container mx-auto px-6 py-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => router.push('/')}>
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
            
            {isAuthenticated && (
              <div className="px-4 py-2 text-sm font-medium bg-green-500/10 rounded-md flex items-center space-x-2">
                <span className="text-green-400">${accountBalance?.toLocaleString() || '0'}</span>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-12 pb-24">
        {checkingAuth ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {!purchaseComplete ? (
              <>
                {ticketInfo ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {/* Ticket Information - Left Column */}
                    <div className="lg:col-span-2">
                      <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl shadow-2xl border border-white/10 mb-8">
                        {/* Breadcrumb */}
                        <div className="flex items-center text-sm mb-8 text-gray-400">
                          <button onClick={() => router.push('/')} className="hover:text-white transition-colors">Home</button>
                          <span className="mx-2">›</span>
                          <span className="text-white">Purchase Ticket</span>
                        </div>
                        
                        {/* Event Header */}
                        <div className="flex flex-col md:flex-row md:items-center gap-6 mb-8">
                          <div className="w-full md:w-1/3 aspect-video overflow-hidden rounded-xl border border-white/10">
                            <div className="w-full h-full bg-gradient-to-tr from-blue-500/30 to-purple-500/30 flex items-center justify-center">
                              <div className="text-5xl opacity-30">🎵</div>
                            </div>
                          </div>
                          <div className="flex-1">
                            <h1 className="text-3xl font-bold mb-2">{ticketInfo.name}</h1>
                            <div className="flex items-center space-x-2 text-gray-300 mb-4">
                              <span className="inline-block">
                                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                                {ticketInfo.date}
                              </span>
                              <span>•</span>
                              <span className="inline-block">
                                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                </svg>
                                {ticketInfo.location}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-4">
                              <div className="px-3 py-1 bg-blue-500/20 rounded-full text-blue-300 text-sm">
                                {ticketInfo.type}
                              </div>
                              <div className="px-3 py-1 bg-green-500/20 rounded-full text-green-300 text-sm">
                                Blockchain-Verified
                              </div>
                            </div>
                            <div className="text-2xl font-bold text-blue-400">
                              {ticketInfo.price}
                            </div>
                          </div>
                        </div>
                        
                        {/* Event Details Section */}
                        <div className="border-t border-white/10 pt-8 mb-8">
                          <h2 className="text-xl font-semibold mb-4">Event Details</h2>
                          <p className="text-gray-300 mb-6">
                            Join us for an unforgettable experience at {ticketInfo.name}. This event features the best 
                            entertainment, top-tier production, and an incredible atmosphere. Your ticket is blockchain-verified 
                            for maximum security and authenticity.
                          </p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                              <h3 className="font-medium mb-2">Ticket Benefits</h3>
                              <ul className="space-y-2 text-sm text-gray-300">
                                <li className="flex items-center">
                                  <svg className="w-4 h-4 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                  </svg>
                                  Entry to all {ticketInfo.name} venues
                                </li>
                                <li className="flex items-center">
                                  <svg className="w-4 h-4 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                  </svg>
                                  Blockchain-verified ticket
                                </li>
                                <li className="flex items-center">
                                  <svg className="w-4 h-4 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                  </svg>
                                  Digital collectible NFT
                                </li>
                                {ticketInfo.type.toLowerCase().includes('vip') && (
                                  <>
                                    <li className="flex items-center">
                                      <svg className="w-4 h-4 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                      </svg>
                                      VIP lounge access
                                    </li>
                                    <li className="flex items-center">
                                      <svg className="w-4 h-4 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                      </svg>
                                      Priority seating
                                    </li>
                                  </>
                                )}
                              </ul>
                            </div>
                            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                              <h3 className="font-medium mb-2">Additional Information</h3>
                              <ul className="space-y-2 text-sm text-gray-300">
                                <li className="flex items-start">
                                  <svg className="w-4 h-4 mr-2 mt-0.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                  </svg>
                                  Ticket is bought using the Hylé blockchain
                                </li>
                                <li className="flex items-start">
                                  <svg className="w-4 h-4 mr-2 mt-0.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                  </svg>
                                  Get a discount based on your nationality
                                  {userProfile && userProfile.nationality === 'FRA' && (
                                    <span className="ml-1 text-green-300 font-medium">(10% off for France!)</span>
                                  )}
                                  {userProfile && userProfile.nationality === 'TWN' && (
                                    <span className="ml-1 text-green-300 font-medium">(20% off for Taiwan!)</span>
                                  )}
                                </li>
                                
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Checkout Panel - Right Column */}
                    <div className="lg:col-span-1">
                      <div className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl shadow-2xl border border-white/10 sticky top-6">
                        <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
                        
                        {/* Quantity Selector */}
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-300 mb-2">Quantity</label>
                          <div className="flex">
                            <button 
                              onClick={() => handleQuantityChange(quantity - 1)}
                              disabled={quantity <= 1}
                              className="px-3 py-2 bg-white/5 border border-white/10 rounded-l-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              −
                            </button>
                            <div className="px-4 py-2 bg-white/5 border-t border-b border-white/10 flex items-center justify-center min-w-[3rem]">
                              {quantity}
                            </div>
                            <button 
                              onClick={() => handleQuantityChange(quantity + 1)}
                              disabled={quantity >= 10}
                              className="px-3 py-2 bg-white/5 border border-white/10 rounded-r-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        
                        {/* Payment Method */}
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-300 mb-2">Payment Method</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                              onClick={() => setPaymentMethod('balance')}
                              className={`p-3 border rounded-lg flex flex-col items-center justify-center text-sm ${
                                paymentMethod === 'balance' 
                                  ? 'border-blue-400 bg-blue-500/10' 
                                  : 'border-white/10 bg-white/5 hover:bg-white/10'
                              }`}
                            >
                              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                              </svg>
                              Hylé Balance
                            </button>
                            <button 
                              onClick={() => setPaymentMethod('card')}
                              className={`p-3 border rounded-lg flex flex-col items-center justify-center text-sm ${
                                paymentMethod === 'card' 
                                  ? 'border-blue-400 bg-blue-500/10' 
                                  : 'border-white/10 bg-white/5 hover:bg-white/10'
                              }`}
                            >
                              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
                              </svg>
                              Credit Card
                            </button>
                          </div>
                        </div>
                        
                        {/* Price Breakdown */}
                        <div className="border-t border-white/10 pt-4 mb-6">
                          <div className="flex justify-between mb-2">
                            <span className="text-gray-300">Ticket Price</span>
                            <span>${parseFloat(ticketInfo.price.replace(/[^0-9.-]+/g, '')).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between mb-2">
                            <span className="text-gray-300">Quantity</span>
                            <span>× {quantity}</span>
                          </div>
                          {userProfile && userProfile.nationality === 'FRA' && (
                            <div className="flex justify-between mb-2 text-green-300">
                              <span>Regional Pricing Discount</span>
                              <span>-10%</span>
                            </div>
                          )}
                          {userProfile && userProfile.nationality === 'TWN' && (
                            <div className="flex justify-between mb-2 text-green-300">
                              <span>Regional Pricing Discount</span>
                              <span>-20%</span>
                            </div>
                          )}
                          {paymentMethod === 'card' && (
                            <div className="flex justify-between mb-2 text-gray-300">
                              <span>Processing Fee</span>
                              <span>$2.99</span>
                            </div>
                          )}
                          <div className="flex justify-between font-bold text-lg mt-4 pt-4 border-t border-white/10">
                            <span>Total</span>
                            <span>
                              ${(calculatePrice() + (paymentMethod === 'card' ? 2.99 : 0)).toFixed(2)}
                            </span>
                          </div>
                        </div>
                        
                        {/* Balance Warning */}
                        {paymentMethod === 'balance' && calculatePrice() > accountBalance && (
                          <div className="mb-6 p-3 bg-red-500/20 text-red-300 rounded-lg text-sm">
                            Insufficient balance. Please add funds or choose another payment method.
                          </div>
                        )}
                        
                        {/* Purchase Button */}
                        <button
                          onClick={purchaseTicket}
                          disabled={isLoading || (paymentMethod === 'balance' && calculatePrice() > accountBalance)}
                          className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg text-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
                        >
                          {isLoading ? (
                            <div className="flex items-center justify-center">
                              <span className="flex items-center">
                                {processingStep === 1 && "Verifying identity..."}
                                {processingStep === 2 && "Securing payment..."}
                                {processingStep === 3 && "Finalizing transaction..."}
                                {processingStep === 0 && "Processing..."}
                              </span>
                            </div>
                          ) : (
                            <>
                              Purchase {quantity > 1 ? `${quantity} Tickets` : 'Ticket'}
                            </>
                          )}
                        </button>
                        
                        {/* Security Info */}
                        <div className="mt-4 flex items-center justify-center text-xs text-gray-400">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                          </svg>
                          Secure, Encrypted Transaction
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-xl mx-auto bg-white/10 backdrop-blur-lg p-8 rounded-2xl shadow-2xl border border-white/10 mb-8 text-center">
                    <svg className="w-16 h-16 mx-auto mb-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <h2 className="text-2xl font-bold mb-4">No Ticket Selected</h2>
                    <p className="mb-6 text-gray-300">Please return to the homepage and select a ticket to purchase</p>
                    <button
                      onClick={() => router.push('/')}
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg text-white font-medium hover:from-blue-600 hover:to-purple-600 transition-all"
                    >
                      Browse Events
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="max-w-3xl mx-auto bg-white/10 backdrop-blur-lg p-8 rounded-2xl shadow-2xl border border-white/10 mb-8">
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-2">Thank You For Your Purchase!</h2>
                  <p className="text-gray-300">Your ticket has been added to your blockchain wallet</p>
                </div>
                
                {ticketInfo && (
                  <div className="bg-white/5 p-6 rounded-xl border border-white/10 mb-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 bg-green-500/20 text-green-300 text-xs rounded-bl-lg">
                      Confirmed
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="md:w-1/4 flex items-center justify-center">
                        <div className="w-24 h-24 bg-gradient-to-tr from-blue-500/30 to-purple-500/30 rounded-lg flex items-center justify-center">
                          <span className="text-4xl">🎟️</span>
                        </div>
                      </div>
                      <div className="md:w-3/4">
                        <h3 className="font-medium text-xl mb-2">{ticketInfo.name}</h3>
                        <p className="text-gray-400 mb-3">{ticketInfo.date}</p>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="px-3 py-1 bg-blue-500/20 rounded-full text-blue-300 text-sm">
                            {ticketInfo.type}
                          </div>
                          <div className="text-blue-400 font-medium">
                            Qty: {quantity}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                          </svg>
                          Secured with ZukPassport identity verification
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-gray-300">Transaction ID</span>
                    <span className="font-mono text-sm text-gray-400">
                      {typeof transactionId === 'string' && transactionId.length > 10 
                        ? `${transactionId.substring(0, 8)}...` 
                        : transactionId}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-gray-300">Payment Method</span>
                    <span className="text-gray-300">
                      {paymentMethod === 'balance' ? 'Hylé Balance' : 'Credit Card'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-gray-300">Total Paid</span>
                    <span className="text-white font-bold">
                      ${(calculatePrice() + (paymentMethod === 'card' ? 2.99 : 0)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-gray-300">New Balance</span>
                    <span className="text-green-400 font-medium">${accountBalance.toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-8 text-sm text-center text-blue-300">
                  Your tickets and receipt have been sent to your email and are available in your ZukPassport account
                </div>
                
                {transactionId && (
                  <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg mb-8 text-sm text-center">
                    <span className="text-purple-300">View transaction on Hylé explorer: </span>
                    <a 
                      href={`https://hyleou.hyle.eu/tx/${transactionId}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 underline"
                    >
                      https://hyleou.hyle.eu/tx/
                      {typeof transactionId === 'string' && transactionId.length > 10 
                        ? `${transactionId.substring(0, 8)}...` 
                        : transactionId}
                    </a>
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={() => router.push('/')}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg text-white font-medium hover:from-blue-600 hover:to-purple-600 transition-all"
                  >
                    Browse More Events
                  </button>
                  <button
                    onClick={() => router.push('/account')}
                    className="px-6 py-3 border border-white/20 rounded-lg text-white font-medium hover:bg-white/10 transition-all"
                  >
                    View My Tickets
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="max-w-3xl mx-auto mt-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {message && (
          <div className="max-w-3xl mx-auto mt-6 p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg text-blue-200">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
