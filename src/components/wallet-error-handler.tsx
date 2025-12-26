"use client";

import { useEffect } from 'react';
import { ensureWalletAuthorization } from '@/lib/charms/wallet';

/**
 * Global Wallet Error Handler Component
 * 
 * Catches Chrome extension authorization errors and triggers authorization
 * to prevent "source has not been authorized yet" errors from appearing.
 * 
 * This component should be included in the root layout to handle errors globally.
 */
export function WalletErrorHandler() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Global error handler for extension authorization errors
    const handleError = (event: ErrorEvent) => {
      const errorMessage = event.message || '';
      const errorSource = event.filename || '';
      
      // Check if this is a Chrome extension authorization error
      const isExtensionError = errorSource.includes('chrome-extension://') ||
                               errorMessage.includes('not been authorized') ||
                               errorMessage.includes('not authorized') ||
                               errorMessage.includes('source') && errorMessage.includes('authorized');

      if (isExtensionError) {
        // Prevent the error from showing in console
        event.preventDefault();
        
        // Trigger authorization attempt (non-blocking)
        ensureWalletAuthorization().catch(() => {
          // Silently handle - authorization will be requested when user connects
        });
        
        return false;
      }
    };

    // Global unhandled promise rejection handler
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const errorMessage = typeof reason === 'string' 
        ? reason 
        : reason?.message || reason?.toString() || '';
      
      // Check if this is an authorization-related error
      if (errorMessage.includes('not been authorized') ||
          errorMessage.includes('not authorized') ||
          errorMessage.includes('source') && errorMessage.includes('authorized')) {
        // Prevent the error from showing in console
        event.preventDefault();
        
        // Trigger authorization attempt (non-blocking)
        ensureWalletAuthorization().catch(() => {
          // Silently handle - authorization will be requested when user connects
        });
        
        return false;
      }
    };

    // Add event listeners
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null; // This component doesn't render anything
}

