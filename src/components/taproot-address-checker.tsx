"use client";

import { useState, useEffect } from 'react';
import { useAppKitAccount } from '@reown/appkit/react';
import { isTaprootAddress, getTaprootAddress } from '@/lib/charms/taproot-address';
import TaprootAddressModal from '@/components/ui/taproot-address-modal';

/**
 * TaprootAddressChecker Component
 * 
 * Monitors wallet connection and shows modal if non-Taproot address is detected.
 * Automatically detects when user switches to Taproot and updates the connection.
 */
export function TaprootAddressChecker() {
  const { address, isConnected } = useAppKitAccount();
  const [showModal, setShowModal] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [lastAddress, setLastAddress] = useState<string | null>(null);
  
  // Check if user has already been verified as having Taproot (persists across page loads)
  const getIsTaprootVerified = (): boolean => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('taprootAddressVerified');
    return stored === 'true';
  };
  
  const [isTaprootVerified, setIsTaprootVerified] = useState<boolean>(getIsTaprootVerified());

  useEffect(() => {
    if (!isConnected || !address) {
      setShowModal(false);
      setHasChecked(false);
      setLastAddress(null);
      return;
    }

    // Only check once per address change, and don't re-check if modal is already showing
    if (hasChecked && lastAddress === address) {
      // If address hasn't changed and we've already checked, keep modal state as is
      return;
    }

    // Check if address is Taproot
    const checkTaproot = async () => {
      try {
        const isTaproot = isTaprootAddress(address);
        
        if (!isTaproot) {
          // Not Taproot - ALWAYS show modal with instructions (for new users or if they switched)
          // This is the instruction modal to help them switch to Taproot
          if (!showModal) {
            setShowModal(true);
          }
          setLastAddress(address);
          setHasChecked(true);
          // Clear verified state since they're not on Taproot
          if (typeof window !== 'undefined') {
            localStorage.setItem('taprootAddressVerified', 'false');
          }
          setIsTaprootVerified(false);
        } else {
          // Already Taproot - close modal if open and mark as verified
          // Once verified, we remember this so faucet modal won't auto-open repeatedly
          if (showModal) {
            setShowModal(false);
          }
          setLastAddress(address);
          setHasChecked(true);
          // Mark as verified in localStorage (prevents faucet modal from auto-opening repeatedly)
          if (typeof window !== 'undefined') {
            localStorage.setItem('taprootAddressVerified', 'true');
          }
          setIsTaprootVerified(true);
        }
      } catch (error) {
        // Error checking, assume not Taproot and show modal
        if (!showModal) {
          setShowModal(true);
        }
        setLastAddress(address);
        setHasChecked(true);
      }
    };

    checkTaproot();
  }, [address, isConnected, hasChecked, lastAddress, showModal, isTaprootVerified]);

  const handleAddressSwitched = async (taprootAddress: string) => {
    // Address has been switched to Taproot
    // Close modal and reset state
    setShowModal(false);
    setHasChecked(false);
    setLastAddress(null);
    
    // Wait a moment for state to update, then refresh
    // This ensures the new Taproot address is properly detected
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  if (!isConnected || !address) {
    return null;
  }

  return (
    <TaprootAddressModal
      isOpen={showModal}
      onClose={() => setShowModal(false)}
      currentAddress={address}
      onAddressSwitched={handleAddressSwitched}
    />
  );
}

