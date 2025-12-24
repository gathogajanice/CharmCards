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
  const [dismissedUntil, setDismissedUntil] = useState<number | null>(null);

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
        
        // Only update if network actually changed
        setCurrentNetwork(prev => {
          if (prev !== network) {
            console.log('Network changed from', prev, 'to', network);
            return network;
          }
          return prev;
        });
        
        // Show modal if not on required network
        // Don't show modal if network is 'unknown' (might be still detecting)
        // IMPORTANT: If wallet reports 'testnet' but we need 'testnet4', 
        // Unisat's 'testnet' IS actually testnet4, so we should accept it
        const isOnCorrectNetwork = network === REQUIRED_NETWORK || 
                                   (network === 'testnet' && REQUIRED_NETWORK === 'testnet4');
        
        if (isOnCorrectNetwork) {
          console.log('Network is correct:', network);
          setShowNetworkModal(false);
          setHasChecked(false); // Reset so we can check again if network changes
          setDismissedUntil(null); // Clear dismissal when network is correct
        } else if (!isOnCorrectNetwork && network !== 'unknown') {
          // Check if user dismissed the modal recently (within last 5 minutes)
          const now = Date.now();
          const wasDismissed = dismissedUntil && now < dismissedUntil;
          
          if (!wasDismissed) {
            console.log('Network mismatch detected. Current:', network, 'Required:', REQUIRED_NETWORK);
            // Only show modal if it hasn't been dismissed recently
            setShowNetworkModal(true);
            if (!hasChecked) {
              setHasChecked(true);
            }
          } else {
            // Modal was dismissed, don't show it again yet
            setShowNetworkModal(false);
          }
        }
      } else {
        setCurrentNetwork('unknown');
        setShowNetworkModal(false);
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
  }, [address, isConnected, hasChecked]);

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

  // Load dismissed state from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('networkModalDismissedUntil');
      if (stored) {
        const dismissedUntilTime = parseInt(stored, 10);
        if (dismissedUntilTime > Date.now()) {
          setDismissedUntil(dismissedUntilTime);
        } else {
          // Expired, clear it
          localStorage.removeItem('networkModalDismissedUntil');
        }
      }
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

