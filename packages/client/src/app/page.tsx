'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Create a client-only component for the actual homepage
const HomePageClient = dynamic(() => import('./HomePageClient'), { ssr: false });

export default function Page() {
  return <HomePageClient />;
}
