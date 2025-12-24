"use client";

import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, X, ExternalLink, Coins, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getNetworkSwitchInstructions, detectWalletName, detectConnectedWallet, getNetworkFromWallet } from '@/lib/charms/network';
import { useAppKitAccount } from '@reown/appkit/react';
import { toast } from 'sonner';
import TestnetFaucet from './testnet-faucet';

interface NetworkSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentNetwork?: string;
  requiredNetwork?: string;
  walletName?: string;
  onDismiss?: () => void;
}

export default function NetworkSwitchModal({
  isOpen,
  onClose,
  currentNetwork = 'Mainnet',
  requiredNetwork = 'Testnet4',
  walletName,
  onDismiss,
}: NetworkSwitchModalProps) {
  const [showFaucet, setShowFaucet] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [detectedNetwork, setDetectedNetwork] = useState<string | null>(null);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const { address, isConnected } = useAppKitAccount();
  
  // Detect which wallet is actually connected
  useEffect(() => {
    const detectWallet = async () => {
      if (isConnected && address) {
        const wallet = await detectConnectedWallet();
        setConnectedWallet(wallet);
      } else {
        setConnectedWallet(null);
      }
    };
    
    detectWallet();
  }, [isConnected, address]);
  
  const detectedWallet = walletName || connectedWallet || detectWalletName();
  const instructions = getNetworkSwitchInstructions(detectedWallet || undefined);
  const walletSteps = detectedWallet && instructions.walletSpecific?.[detectedWallet]
    ? instructions.walletSpecific[detectedWallet]
    : instructions.steps;

  // Auto-switch network when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const autoSwitch = async () => {
      try {
        // First check current network
        const currentNetwork = await getNetworkFromWallet();
        setDetectedNetwork(currentNetwork || null);
        
        // If already on correct network, close modal
        if (currentNetwork === 'testnet4' || currentNetwork === 'testnet') {
          onClose();
          return;
        }
        
        // Attempt automatic switch if wallet is detected
        if (detectedWallet) {
          console.log('Attempting automatic network switch for:', detectedWallet);
          const { connectAndSwitchNetwork, attemptNetworkSwitch } = await import('@/lib/charms/network');
          
          // Show toast that we're connecting - this will trigger wallet popup
          const walletDisplayName = detectedWallet.charAt(0).toUpperCase() + detectedWallet.slice(1);
          toast.info(`Connecting ${walletDisplayName} and switching to Testnet4...`);
          
          // Try connect and switch first - this will trigger wallet popup (same for all wallets)
          const result = await connectAndSwitchNetwork(detectedWallet);
          
          if (result.connected && result.switched) {
            console.log('Network switch initiated, waiting for confirmation...');
            toast.success(`${walletDisplayName} connected and switching to Testnet4...`);
            // Wait for network to switch
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else if (result.connected) {
            // Connected but switch needs approval
            toast.info('Wallet connected! Please approve network switch in popup...');
            const switched = await attemptNetworkSwitch(detectedWallet);
            if (switched) {
              toast.success('Network switch approved!');
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } else if (result.switched) {
            // Switch worked
            toast.success('Network switch initiated...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            // Neither worked - might need user approval
            toast.warning(`Please approve ${walletDisplayName} connection and network switch in the popup.`);
          }
        }
      } catch (error) {
        console.error('Auto-switch error:', error);
      }
    };

    // Try auto-switch immediately
    autoSwitch();

    // Poll network status
    let pollInterval: NodeJS.Timeout | null = null;

    const checkNetwork = async () => {
      try {
        const network = await getNetworkFromWallet();
        if (network) {
          setDetectedNetwork(network);
          console.log('Polled network status:', network);
          
          // If network is correct, close modal and reload
          if (network === 'testnet4' || network === 'testnet') {
            console.log('Network is now correct! Closing modal...');
            // Wait a moment for wallet to fully switch
            await new Promise(resolve => setTimeout(resolve, 1500));
            // Close modal first
            onClose();
            // Small delay before reload to ensure modal closes
            setTimeout(() => {
              window.location.reload();
            }, 500);
            // Stop polling
            if (pollInterval) {
              clearInterval(pollInterval);
            }
          }
        }
      } catch (error) {
        console.error('Error checking network:', error);
      }
    };

    // Check immediately
    checkNetwork();

    // Poll every 3 seconds (reduced frequency)
    pollInterval = setInterval(checkNetwork, 3000);

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isOpen, onClose, detectedWallet]);

  // Manual network check function
  const handleCheckNetwork = async () => {
    setIsChecking(true);
    try {
      const network = await getNetworkFromWallet();
      if (network) {
        setDetectedNetwork(network);
        console.log('Manual network check:', network);
        
        if (network === 'testnet4' || network === 'testnet') {
          console.log('Network is correct! Closing modal...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          onClose();
          window.location.reload();
        } else {
          alert(`Current network: ${network}. Please switch to Testnet4 in your wallet.`);
        }
      } else {
        // Fallback to address-based detection
        if (address) {
          const { detectNetworkFromAddress } = await import('@/lib/charms/network');
          const addrNetwork = detectNetworkFromAddress(address);
          setDetectedNetwork(addrNetwork);
          if (addrNetwork === 'testnet4' || addrNetwork === 'testnet') {
            await new Promise(resolve => setTimeout(resolve, 1000));
            onClose();
            window.location.reload();
          } else {
            alert(`Current network: ${addrNetwork}. Please switch to Testnet4 in your wallet.`);
          }
        } else {
          alert('Could not detect network. Please ensure your wallet is connected.');
        }
      }
    } catch (error) {
      console.error('Error checking network:', error);
      alert('Failed to check network. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-background border border-border rounded-xl shadow-xl max-w-sm w-full p-4"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-foreground">
                  Switch to {requiredNetwork}
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-secondary transition-colors"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>

          <div className="bg-secondary/50 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-[12px] font-medium text-foreground">
                Current: {detectedNetwork || currentNetwork}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[12px] font-medium text-foreground">
                Required: {requiredNetwork}
              </span>
            </div>
            {detectedNetwork && (detectedNetwork === 'testnet4' || detectedNetwork === 'testnet') && (
              <div className="mt-2 flex items-center gap-2 text-green-600">
                <CheckCircle className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium">Switching... Reloading...</span>
              </div>
            )}
          </div>

          {/* Wallet Status - Prominent */}
          {detectedWallet && (
            <div className="bg-primary/10 border-2 border-primary/30 rounded-lg p-3 mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <p className="text-[13px] font-semibold text-foreground">
                    Connected: {detectedWallet.charAt(0).toUpperCase() + detectedWallet.slice(1)}
                  </p>
                </div>
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {/* Auto Switch Button - Primary Action */}
            <button
              onClick={async () => {
                setIsSwitching(true);
                try {
                  const { connectAndSwitchNetwork, detectConnectedWallet, attemptNetworkSwitch } = await import('@/lib/charms/network');
                  
                  // Detect which wallet is actually connected
                  let walletToUse = detectedWallet;
                  if (!walletToUse) {
                    // Try to detect connected wallet
                    const connected = await detectConnectedWallet();
                    walletToUse = connected || detectWalletName();
                  }
                  
                  if (!walletToUse) {
                    toast.error('No wallet detected. Please connect a wallet first.');
                    setIsSwitching(false);
                    return;
                  }
                  
                  const walletDisplayName = walletToUse.charAt(0).toUpperCase() + walletToUse.slice(1);
                  toast.info(`Connecting ${walletDisplayName} and switching to Testnet4...`);
                  console.log('Using wallet for connection:', walletToUse);
                  
                  // Connect and switch - this will trigger wallet popup
                  const result = await connectAndSwitchNetwork(walletToUse);
                  
                  if (result.connected && result.switched) {
                    toast.success(`${walletDisplayName} connected and switched to Testnet4! Confirming...`);
                    // Wait a bit then check
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    await handleCheckNetwork();
                  } else if (result.connected) {
                    // Connected but switch might need approval
                    toast.info('Wallet connected! Please approve network switch in popup...');
                    // Try switch again
                    const switched = await attemptNetworkSwitch(walletToUse);
                    if (switched) {
                      toast.success('Network switch approved! Confirming...');
                      await new Promise(resolve => setTimeout(resolve, 2000));
                      await handleCheckNetwork();
                    } else {
                      setIsSwitching(false);
                      toast.warning('Please approve the network switch in your wallet popup. The app will auto-detect the change.');
                    }
                  } else if (result.switched) {
                    // Switch worked but connection might have failed
                    toast.success('Network switch initiated! Confirming...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    await handleCheckNetwork();
                  } else {
                    // Neither worked - might need manual approval
                    setIsSwitching(false);
                    toast.warning(`Please approve the ${walletDisplayName} connection and network switch in the popup. The app will auto-detect the change.`);
                  }
                } catch (error: any) {
                  console.error('Network switch error:', error);
                  setIsSwitching(false);
                  toast.error(`Failed to switch: ${error?.message || 'Please switch manually in your wallet.'}`);
                }
              }}
              disabled={isSwitching}
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-bold text-[14px] hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSwitching ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Opening {detectedWallet ? detectedWallet.charAt(0).toUpperCase() + detectedWallet.slice(1) : 'Wallet'}...</span>
                </>
              ) : (
                <>
                  <span>Connect & Switch to Testnet4</span>
                  <ExternalLink className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Check Network Button */}
            <button
              onClick={handleCheckNetwork}
              disabled={isChecking}
              className="w-full h-9 rounded-lg border border-primary bg-primary/5 text-primary font-medium text-[12px] hover:bg-primary/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isChecking ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Check Network</span>
                </>
              )}
            </button>
            
            {/* Compact Instructions for Unisat */}
            {detectedWallet === 'unisat' && (
              <div className="bg-accent/10 border border-accent/30 rounded-lg p-2.5 mb-1">
                <p className="text-[11px] font-semibold text-foreground mb-1.5">Quick Steps:</p>
                <ol className="text-[10px] text-foreground space-y-0.5 list-decimal list-inside leading-relaxed">
                  <li>Click Unisat extension icon</li>
                  <li>Click network indicator</li>
                  <li>Select <strong>"Bitcoin Testnet4 Beta"</strong></li>
                </ol>
              </div>
            )}
            
            <button
              onClick={() => setShowFaucet(true)}
              className="w-full h-9 rounded-lg border border-accent bg-accent/10 text-accent font-medium text-[12px] hover:bg-accent/20 transition-colors flex items-center justify-center gap-2"
            >
              <Coins className="w-3.5 h-3.5" />
              Get Testnet4 BTC
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (onDismiss) {
                    onDismiss();
                  }
                  onClose();
                }}
                className="flex-1 h-9 rounded-lg border border-border bg-background text-foreground font-medium text-[12px] hover:bg-secondary transition-colors"
              >
                Dismiss (5 min)
              </button>
              <button
                onClick={onClose}
                className="flex-1 h-9 rounded-lg border border-border bg-background text-foreground font-medium text-[12px] hover:bg-secondary transition-colors"
              >
                Close
              </button>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground text-center mt-3">
            Auto-detecting network changes. Modal will close when Testnet4 is detected.
          </p>
        </motion.div>
      </div>

      {/* Testnet Faucet Modal */}
      <TestnetFaucet
        isOpen={showFaucet}
        onClose={() => setShowFaucet(false)}
      />
    </AnimatePresence>
  );
}

