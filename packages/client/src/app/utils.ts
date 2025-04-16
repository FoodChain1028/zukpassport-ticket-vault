import {
  constructZupassPcdAddRequestUrl,
  getWithoutProvingUrl,
  useZupassPopupMessages,
} from '@pcd/passport-interface';
import { PODPCD, PODPCDPackage } from '@pcd/pod-pcd';
import { POD, podEntriesFromJSON } from '@pcd/pod';
import { v4 as uuid } from 'uuid';
import { ZUPASS_URL } from './constants';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

// Storage key for Zupass data in localStorage
const ZUPASS_DATA_KEY = 'zupass_pcd_data';
const ZUPASS_REDIRECT_KEY = 'zupass_redirect_path';

// Keep a reference to the popup window so we can close it later
let zupassPopupWindow: Window | null = null;

/**
 * Popup window will redirect to Zupass to request a proof.
 * Open the popup window under the current domain, let it redirect there.
 * This function creates a popup that will communicate directly back to this window.
 * @param proofUrl - The URL to open in the popup
 * @returns The popup window reference
 */
export function sendZupassRequest(proofUrl: string): Window | null {
  // Close any existing popup first
  closeZupassPopup();

  console.log('📲 Opening Zupass popup with URL:', proofUrl);

  // IMPORTANT: Use specific popup parameters and name it to ensure window.opener works correctly
  zupassPopupWindow = window.open(
    proofUrl,
    'zupass_popup',
    'width=450,height=600,top=100,left=100,popup=yes,noopener=no',
  );

  // Add event listener to check if popup is closed
  if (zupassPopupWindow) {
    document.body.classList.add('zupass-popup-open');

    // Monitor for popup closure
    const checkPopupInterval = setInterval(() => {
      if (zupassPopupWindow && zupassPopupWindow.closed) {
        console.log('📴 Zupass popup was closed by user');
        clearInterval(checkPopupInterval);
        document.body.classList.remove('zupass-popup-open');
        zupassPopupWindow = null;
      }
    }, 500);
  } else {
    console.error('❌ Failed to open Zupass popup - it may have been blocked by the browser');
  }

  return zupassPopupWindow;
}

/**
 * Close the Zupass popup window if it exists
 */
export function closeZupassPopup(): void {
  if (zupassPopupWindow && !zupassPopupWindow.closed) {
    zupassPopupWindow.close();
    zupassPopupWindow = null;
  }
}

/**
 * Add a new POD to Zupass
 * @param podContent
 * @param podPrivateKey
 * @param podFolder
 * @param redirectToFolder
 */
export async function addPODPCD(
  podContent: string,
  podPrivateKey: string,
  podFolder: string | undefined,
  redirectToFolder?: boolean,
): Promise<void> {
  podPrivateKey = 'AAECAwQFBgcICQABAgMEBQYHCAkAAQIDBAUGBwgJAAE=';
  const newPOD = new PODPCD(
    uuid(),
    POD.sign(podEntriesFromJSON(JSON.parse(podContent)), podPrivateKey),
  );

  const serializedPODPCD = await PODPCDPackage.serialize(newPOD);

  const url = constructZupassPcdAddRequestUrl(
    ZUPASS_URL,
    window.location.origin + '#/popup',
    serializedPODPCD,
    podFolder,
    false,
    redirectToFolder,
  );

  if (redirectToFolder) {
    open(url);
  } else {
    sendZupassRequest(url);
  }
}

/**
 * Request PCDs from Zupass without proving first.
 * This function opens a popup directly to Zupass
 *
 * @param pcdType - The PCD type to request (defaults to PODPCDPackage.name)
 * @returns The popup window reference
 */
export function getPCDFromZupass(pcdType: string = PODPCDPackage.name): Window | null {
  const requestObject = {
    type: 'GetWithoutProving',
    pcdType: pcdType,
    returnUrl: window.location.origin,
    postMessage: true,
  };

  const requestParam = encodeURIComponent(JSON.stringify(requestObject));

  const popupUrl = `${ZUPASS_URL}#/get-without-proving?request=${requestParam}`;

  console.log('🔄 Opening Zupass popup with correct URL format:', popupUrl);

  const popupWindow = window.open(
    popupUrl,
    'zupass_popup',
    'width=450,height=600,top=100,left=100,popup=yes,noopener=no',
  );

  zupassPopupWindow = popupWindow;

  if (popupWindow) {
    document.body.classList.add('zupass-popup-open');
  } else {
    console.error('❌ Failed to open Zupass popup - may be blocked by browser');
  }

  return popupWindow;
}

/**
 * Legacy version of getPCDFromZupass that uses redirects.
 * @deprecated Use the direct popup method instead.
 */
export function getPCDFromZupassWithRedirect(
  redirectPath: string = '/retrieve-zupass',
  originPath?: string,
): void {
  // Store the origin path to redirect back to after retrieval
  if (typeof window !== 'undefined') {
    localStorage.setItem(ZUPASS_REDIRECT_KEY, originPath || window.location.pathname);
  }

  const url = getWithoutProvingUrl(
    ZUPASS_URL,
    window.location.origin + redirectPath,
    PODPCDPackage.name,
  );
  console.log('⚠️ Using redirect method (not recommended):', url);
  sendZupassRequest(url);
}

/**
 * Store the PCD data from Zupass and communicate it to the original page
 * This function handles both popup window and redirect flows
 * @param pcdData - The PCD data to store
 */
export function storePCDDataAndRedirect(pcdData: any): void {
  if (typeof window === 'undefined') return;

  // Check if we're in a popup window
  if (window.opener) {
    try {
      // If we are in a popup, send data directly to parent window via postMessage
      const message = JSON.stringify({
        pcd: pcdData,
      });

      console.log('📤 Sending PCD data to parent window via postMessage');

      // Send to parent - using '*' as targetOrigin for development
      // In production, you should use a specific origin for security
      window.opener.postMessage(message, '*');

      // Close this popup after sending the data
      console.log('🔒 Closing popup after data transmission');
      setTimeout(() => window.close(), 500); // Short delay to ensure message is sent

      return; // Exit early, no need for localStorage method
    } catch (e) {
      console.error('❌ Failed to send data via postMessage:', e);
      // Fall through to localStorage method as fallback
    }
  }

  // If not in a popup or if postMessage failed, use localStorage method
  console.log('💾 Using localStorage method for data transmission');
  useLocalStorageMethod(pcdData);
}

/**
 * Helper to use the localStorage method for communication
 * @param pcdData - The data to store
 */
function useLocalStorageMethod(pcdData: any): void {
  // Store the PCD data
  localStorage.setItem(ZUPASS_DATA_KEY, JSON.stringify(pcdData));

  // Get the redirect path and redirect back
  const redirectPath = localStorage.getItem(ZUPASS_REDIRECT_KEY) || '/';
  window.location.href = redirectPath;
}

/**
 * Custom hook to retrieve stored PCD data from local storage
 * @param clearAfterRead - Whether to clear the data after reading it (default: false)
 * @returns An object containing the stored data and a function to clear it
 */
export function useStoredPCDData(clearAfterRead: boolean = false) {
  const [storedData, setStoredData] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(ZUPASS_DATA_KEY);
      if (data) {
        try {
          const parsedData = JSON.parse(data);
          setStoredData(parsedData);
          console.log('🔄 Retrieved PCD data from localStorage');

          // Only clear data if specified
          if (clearAfterRead) {
            localStorage.removeItem(ZUPASS_DATA_KEY);
            console.log('🗑️ Cleared localStorage PCD data');
          }
        } catch (e) {
          console.error('❌ Failed to parse localStorage PCD data:', e);
        }
      }
    }
  }, [clearAfterRead]);

  const clearData = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ZUPASS_DATA_KEY);
      console.log('🗑️ Manually cleared localStorage PCD data');
    }
  };

  return { storedData, clearData };
}

/**
 * Custom hook to receive and parse messages from Zupass popup
 * @returns An object containing the parsed PCD data and loading state
 */
export function useZupassPCDData() {
  // Get message from the Zupass popup
  const [pcdStr] = useZupassPopupMessages();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use useEffect to handle loading and error states and add debug logging
  useEffect(() => {
    if (pcdStr) {
      setIsLoading(false);
      console.log('Received message from Zupass popup:', pcdStr.substring(0, 100) + '...');

      // Listen for the storage event as a backup method of communication
      const handleStorageEvent = (e: StorageEvent) => {
        if (e.key === ZUPASS_DATA_KEY && e.newValue) {
          console.log('Detected Zupass data change in localStorage');
        }
      };

      // Add storage event listener for cross-tab communication
      window.addEventListener('storage', handleStorageEvent);
      return () => window.removeEventListener('storage', handleStorageEvent);
    }
  }, [pcdStr]);

  // Use useMemo to parse and store the PCD data
  const pcdData = useMemo(() => {
    if (!pcdStr) return null;

    try {
      const parsed = JSON.parse(pcdStr);
      console.log('Successfully parsed PCD data:', parsed);
      return parsed;
    } catch (e) {
      console.error('Failed to parse PCD data:', e);
      setError(e instanceof Error ? e.message : 'Failed to parse PCD data');
      setIsLoading(false);
      return null;
    }
  }, [pcdStr]);

  return { pcdData, isLoading, error };
}

/**
 * Parse a PCD from Zupass and extract its data
 * @param pcdData - The raw PCD data received from Zupass
 * @returns The parsed data from the PCD
 */
export function parsePCDFromZupass(pcdData: any) {
  console.log('Received PCD data:', pcdData);

  // If this is a standard POD format with nested structure
  if (pcdData?.pcd?.claim?.pod?.entries) {
    return pcdData.pcd.claim.pod.entries;
  }

  // If this is a simple POD format with just entries
  if (pcdData?.entries) {
    return pcdData.entries;
  }

  // If we have raw SemaphoreSignaturePCD or other PCD type
  if (pcdData?.pcd) {
    return {
      pcdType: pcdData.pcd.type || 'Unknown',
      ...pcdData.pcd,
    };
  }

  // For the format shown in your example with passport data
  if (pcdData && typeof pcdData === 'object' && 'entries' in pcdData) {
    const entries = pcdData.entries;
    console.log('Found entries format, returning entries:', entries);
    return entries;
  }

  return pcdData;
}

/**
 * Alias for backward compatibility
 */
export const parsePODFromZupass = parsePCDFromZupass;
