"use client";

import { useWalletAuthorization } from '@/hooks/use-wallet-authorization';
import { ReactNode } from 'react';

/**
 * Wallet Authorization Provider
 * 
 * Wrapper component that initializes wallet authorization on app load.
 * This ensures wallet extensions are authorized proactively to prevent errors.
 */
export function WalletAuthorizationProvider({ children }: { children: ReactNode }) {
  // Initialize wallet authorization on mount
  useWalletAuthorization();
  
  return <>{children}</>;
}

