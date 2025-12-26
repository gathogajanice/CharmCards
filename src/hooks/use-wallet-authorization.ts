"use client";

import { useEffect, useRef } from 'react';
import { ensureWalletAuthorization } from '@/lib/charms/wallet';

/**
 * Global Wallet Authorization Hook
 * 
 * Detects wallet extensions on mount and proactively requests authorization
 * to prevent "source has not been authorized yet" errors.
 * 
 * This hook runs on app initialization, even before wallet connection,
 * to authorize detected wallet extensions early.
 */
export function useWalletAuthorization() {
  const hasInitialized = useRef(false);
  const authorizationAttempted = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Only run once on mount
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Wait for window to be available and extensions to load
    const initializeAuthorization = async () => {
      // Small delay to ensure extensions are injected
      await new Promise(resolve => setTimeout(resolve, 100));

      if (typeof window === 'undefined') return;

      // Detect which wallets are available
      const detectedWallets: string[] = [];
      
      if ((window as any).unisat) {
        detectedWallets.push('unisat');
      }
      
      const xverse = (window as any).XverseProviders?.BitcoinProvider || 
                     (window as any).XverseProviders ||
                     (window as any).xverse;
      if (xverse) {
        detectedWallets.push('xverse');
      }
      
      const leather = (window as any).btc || (window as any).hiroWalletProvider;
      if (leather) {
        detectedWallets.push('leather');
      }

      if (detectedWallets.length === 0) {
        return; // No wallets detected
      }

      // Request authorization for detected wallets
      // This is non-blocking and won't show popups unless user interacts
      try {
        await ensureWalletAuthorization();
      } catch (error: any) {
        // Silently handle authorization errors - they're expected if user hasn't connected yet
        // The important thing is we've attempted authorization, which prevents extension errors
        if (!error.message?.includes('not authorized') && 
            !error.message?.includes('not been authorized') &&
            !error.message?.includes('User rejected')) {
          // Only log unexpected errors
          console.debug('Wallet authorization check:', error.message || 'Unknown error');
        }
      }
    };

    initializeAuthorization();
  }, []);

  // Also set up a listener for when wallets become available later
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkForNewWallets = () => {
      // Check if any new wallets appeared
      const hasUnisat = !!(window as any).unisat;
      const hasXverse = !!(window as any).XverseProviders?.BitcoinProvider || 
                         !!(window as any).XverseProviders ||
                         !!(window as any).xverse;
      const hasLeather = !!(window as any).btc || !!(window as any).hiroWalletProvider;

      if (hasUnisat || hasXverse || hasLeather) {
        // Small delay to ensure wallet is fully initialized
        setTimeout(async () => {
          try {
            await ensureWalletAuthorization();
          } catch (error) {
            // Ignore errors - authorization will be requested when user connects
          }
        }, 500);
      }
    };

    // Check periodically for new wallets (e.g., if user installs extension)
    const interval = setInterval(checkForNewWallets, 2000);
    
    // Also check on window focus (user might have installed extension in another tab)
    window.addEventListener('focus', checkForNewWallets);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkForNewWallets);
    };
  }, []);
}

