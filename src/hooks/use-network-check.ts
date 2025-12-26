/**
 * Hook to check and handle network switching
 * Automatically detects network and prompts user to switch if needed
 */

import { useState, useEffect, useCallback } from 'react';
import { useAppKitAccount } from '@reown/appkit/react';
import { 
  detectNetworkFromAddress, 
  isOnRequiredNetwork,
  attemptNetworkSwitch,
  detectWalletName,
  getNetworkFromWallet,
} from '@/lib/charms/network';

const REQUIRED_NETWORK = 'testnet4';

export function useNetworkCheck() {
  const { address, isConnected } = useAppKitAccount();
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [currentNetwork, setCurrentNetwork] = useState<string>('unknown');
  const [isChecking, setIsChecking] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  
  // Initialize from localStorage synchronously to avoid race conditions
  const getInitialDismissedUntil = (): number | null => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem('networkModalDismissedUntil');
    if (stored) {
      const dismissedUntilTime = parseInt(stored, 10);
      if (dismissedUntilTime > Date.now()) {
        return dismissedUntilTime;
      } else {
        localStorage.removeItem('networkModalDismissedUntil');
      }
    }
    return null;
  };
  
  const getInitialVerifiedCorrect = (): boolean => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('networkVerifiedCorrect');
    return stored === 'true';
  };
  
  const [dismissedUntil, setDismissedUntil] = useState<number | null>(getInitialDismissedUntil);
  const [lastVerifiedCorrect, setLastVerifiedCorrect] = useState<boolean>(getInitialVerifiedCorrect);

  // Detect network from address and wallet
  useEffect(() => {
    const detectNetwork = async () => {
      if (address && isConnected) {
        // First try to get network directly from wallet (more reliable)
        let network: 'mainnet' | 'testnet' | 'testnet4' | 'unknown' = 'unknown';
        const walletNetwork = await getNetworkFromWallet();
        
        if (walletNetwork) {
          network = walletNetwork;
          console.log('Network detected from wallet:', network);
        } else {
          // Fallback to address-based detection if wallet doesn't provide network
          network = detectNetworkFromAddress(address);
          console.log('Network detected from address:', network, address);
        }
        
        // IMPORTANT: If wallet reports 'testnet' but we need 'testnet4', 
        // Unisat's 'testnet' IS actually testnet4, so we should accept it
        const isOnCorrectNetwork = network === REQUIRED_NETWORK || 
                                   (network === 'testnet' && REQUIRED_NETWORK === 'testnet4');
        
        // Check if network actually changed from previous value
        const prevNetwork = currentNetwork;
        const networkChanged = prevNetwork !== network && prevNetwork !== 'unknown';
        
        // Update current network
        if (prevNetwork !== network) {
          console.log('Network changed from', prevNetwork, 'to', network);
          setCurrentNetwork(network);
        }
        
        if (isOnCorrectNetwork) {
          console.log('Network is correct:', network);
          // Mark as verified and store in localStorage
          setLastVerifiedCorrect(true);
          setShowNetworkModal(false);
          setHasChecked(true);
          setDismissedUntil(null);
          if (typeof window !== 'undefined') {
            localStorage.setItem('networkVerifiedCorrect', 'true');
            localStorage.removeItem('networkModalDismissedUntil');
          }
        } else if (!isOnCorrectNetwork && network !== 'unknown') {
          // Only show modal if:
          // 1. We haven't verified they're on correct network yet (first time check), OR
          // 2. Network changed from correct to incorrect (they switched networks), OR
          // 3. Modal hasn't been dismissed recently
          const now = Date.now();
          const wasDismissed = dismissedUntil && now < dismissedUntil;
          
          // Show modal if:
          // - Network changed from correct to incorrect (they switched away)
          // - OR we haven't verified correct yet AND not dismissed
          const shouldShow = (networkChanged && lastVerifiedCorrect) || (!lastVerifiedCorrect && !wasDismissed);
          
          if (shouldShow && !wasDismissed) {
            console.log('Network mismatch detected. Current:', network, 'Required:', REQUIRED_NETWORK);
            setShowNetworkModal(true);
            setLastVerifiedCorrect(false);
            if (typeof window !== 'undefined') {
              localStorage.setItem('networkVerifiedCorrect', 'false');
            }
            if (!hasChecked) {
              setHasChecked(true);
            }
          } else {
            // Don't show modal - either already verified correct or dismissed
            setShowNetworkModal(false);
          }
        }
      } else {
        setCurrentNetwork('unknown');
        setShowNetworkModal(false);
        // Don't clear verified state when disconnected - keep it for when they reconnect
      }
    };
    
    detectNetwork();
    
    // Poll network status periodically when connected to detect changes
    // Reduced frequency to avoid constant checks
    let pollInterval: NodeJS.Timeout | null = null;
    if (address && isConnected) {
      pollInterval = setInterval(() => {
        detectNetwork();
      }, 10000); // Check every 10 seconds (reduced from 3 seconds)
    }
    
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [address, isConnected, hasChecked, lastVerifiedCorrect, dismissedUntil, currentNetwork]);

  // Attempt automatic network switch
  const attemptAutoSwitch = useCallback(async () => {
    setIsChecking(true);
    try {
      const walletName = detectWalletName();
      const switched = await attemptNetworkSwitch(walletName || undefined);
      
      if (switched) {
        // Wait a moment for network to switch
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Reload page to reconnect with new network
        window.location.reload();
      } else {
        // If automatic switch failed, show manual instructions
        setShowNetworkModal(true);
      }
    } catch (error) {
      console.error('Network switch error:', error);
      setShowNetworkModal(true);
    } finally {
      setIsChecking(false);
    }
  }, []);

  const isOnCorrectNetwork = isOnRequiredNetwork(address || '');
  const needsSwitch = isConnected && !isOnCorrectNetwork && currentNetwork !== 'unknown';

  // Function to dismiss modal for a period of time
  const dismissModal = useCallback((minutes: number = 5) => {
    const dismissUntil = Date.now() + (minutes * 60 * 1000);
    setDismissedUntil(dismissUntil);
    setShowNetworkModal(false);
    // Store in localStorage so it persists across page reloads
    if (typeof window !== 'undefined') {
      localStorage.setItem('networkModalDismissedUntil', dismissUntil.toString());
    }
  }, []);

  return {
    currentNetwork,
    isOnCorrectNetwork,
    needsSwitch,
    showNetworkModal,
    setShowNetworkModal,
    dismissModal,
    attemptAutoSwitch,
    isChecking,
    hasChecked,
  };
}

