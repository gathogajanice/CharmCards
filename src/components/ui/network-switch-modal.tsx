"use client";

import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, X, ExternalLink, Coins, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getNetworkSwitchInstructions, detectWalletName, getNetworkFromWallet } from '@/lib/charms/network';
import { useAppKitAccount } from '@reown/appkit/react';
import TestnetFaucet from './testnet-faucet';

interface NetworkSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentNetwork?: string;
  requiredNetwork?: string;
  walletName?: string;
}

export default function NetworkSwitchModal({
  isOpen,
  onClose,
  currentNetwork = 'Mainnet',
  requiredNetwork = 'Testnet4',
  walletName,
}: NetworkSwitchModalProps) {
  const [showFaucet, setShowFaucet] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [detectedNetwork, setDetectedNetwork] = useState<string | null>(null);
  const { address, isConnected } = useAppKitAccount();
  const detectedWallet = walletName || detectWalletName();
  const instructions = getNetworkSwitchInstructions(detectedWallet || undefined);
  const walletSteps = detectedWallet && instructions.walletSpecific?.[detectedWallet]
    ? instructions.walletSpecific[detectedWallet]
    : instructions.steps;

  // Poll network status when modal is open
  useEffect(() => {
    if (!isOpen) return;

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
            await new Promise(resolve => setTimeout(resolve, 1000));
            onClose();
            // Reload to reconnect with new network
            window.location.reload();
          }
        }
      } catch (error) {
        console.error('Error checking network:', error);
      }
    };

    // Check immediately
    checkNetwork();

    // Poll every 2 seconds
    pollInterval = setInterval(checkNetwork, 2000);

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isOpen, onClose]);

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
          className="bg-background border border-border rounded-[16px] shadow-xl max-w-md w-full p-6"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="text-[18px] font-semibold text-foreground">
                  Switch to {requiredNetwork}
                </h3>
                <p className="text-[13px] text-muted-foreground mt-1">
                  This app requires Bitcoin {requiredNetwork}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="bg-secondary/50 rounded-[12px] p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-[14px] font-medium text-foreground">
                Current Network: {detectedNetwork || currentNetwork}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-[14px] font-medium text-foreground">
                Required Network: {requiredNetwork}
              </span>
            </div>
            {detectedNetwork && (detectedNetwork === 'testnet4' || detectedNetwork === 'testnet') && (
              <div className="mt-3 flex items-center gap-2 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span className="text-[13px] font-medium">Network is correct! Reloading...</span>
              </div>
            )}
          </div>

          <div className="mb-4">
            <h4 className="text-[14px] font-semibold text-foreground mb-3">
              How to Switch:
            </h4>
            <ol className="space-y-2">
              {walletSteps.map((step, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[12px] font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  <span className="text-[14px] text-foreground flex-1">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {detectedWallet && (
            <div className="bg-accent/5 border border-accent/20 rounded-[8px] p-3 mb-4">
              <p className="text-[13px] text-foreground">
                <strong>Detected Wallet:</strong> {detectedWallet.charAt(0).toUpperCase() + detectedWallet.slice(1)}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {/* Check Network Button - Prominent */}
            <button
              onClick={handleCheckNetwork}
              disabled={isChecking}
              className="w-full h-12 rounded-full bg-primary text-primary-foreground font-black text-[15px] hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isChecking ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Checking Network...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Check Network Status</span>
                </>
              )}
            </button>

            {/* Auto Switch Button */}
            <button
              onClick={async () => {
                setIsSwitching(true);
                try {
                  const { attemptNetworkSwitch } = await import('@/lib/charms/network');
                  
                  // Log what we're trying to do
                  console.log('Attempting to switch network for wallet:', detectedWallet);
                  
                  const switched = await attemptNetworkSwitch(detectedWallet || undefined);
                  
                  if (switched) {
                    console.log('Network switch initiated, checking status...');
                    // Wait a moment for network to switch
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    // Check network status
                    await handleCheckNetwork();
                  } else {
                    console.log('Network switch returned false - check console for details');
                    setIsSwitching(false);
                    
                    // For Unisat, provide specific instructions
                    if (detectedWallet === 'unisat') {
                      // Check current network if possible
                      try {
                        const unisat = (window as any).unisat;
                        if (unisat && typeof unisat.getNetwork === 'function') {
                          const currentNet = await unisat.getNetwork();
                          console.log('Current Unisat network:', currentNet);
                        }
                      } catch (e) {
                        console.log('Could not get current network:', e);
                      }
                      
                      // Show helpful message
                      alert('After switching in Unisat:\n\n1. Click "Check Network Status" above\n2. Or wait - the app will auto-detect the change\n3. The modal will close automatically when Testnet4 is detected');
                    } else {
                      alert('After switching in your wallet:\n\n1. Click "Check Network Status" above\n2. Or wait - the app will auto-detect the change');
                    }
                  }
                } catch (error: any) {
                  console.error('Network switch error:', error);
                  setIsSwitching(false);
                  
                  // Provide helpful error message
                  if (detectedWallet === 'unisat') {
                    alert('After switching in Unisat:\n\n1. Click "Check Network Status" above\n2. Or wait - the app will auto-detect the change');
                  } else {
                    alert(`Failed to switch network: ${error?.message || 'Unknown error'}. Please switch manually and click "Check Network Status".`);
                  }
                }
              }}
              disabled={isSwitching}
              className="w-full h-11 rounded-full border border-primary bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSwitching ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <span>Opening Wallet...</span>
                </>
              ) : (
                <>
                  <span>Open Wallet Network Switcher</span>
                  <ExternalLink className="w-4 h-4" />
                </>
              )}
            </button>
            
            {/* Manual Switch Instructions - More Prominent for Unisat */}
            {detectedWallet === 'unisat' && (
              <div className="bg-accent/10 border border-accent/30 rounded-[12px] p-4 mb-2">
                <p className="text-[13px] font-semibold text-foreground mb-2">Manual Switch Required:</p>
                <ol className="text-[12px] text-foreground space-y-1 list-decimal list-inside">
                  <li>Click the Unisat extension icon in your browser</li>
                  <li>Look for the network indicator (shows current network)</li>
                  <li>Click it and select <strong>"Bitcoin Testnet4 Beta"</strong></li>
                  <li>Return here and reconnect your wallet</li>
                </ol>
              </div>
            )}
            
            <button
              onClick={() => setShowFaucet(true)}
              className="w-full h-11 rounded-full border border-accent bg-accent/10 text-accent font-medium hover:bg-accent/20 transition-colors flex items-center justify-center gap-2"
            >
              <Coins className="w-4 h-4" />
              Get Testnet4 BTC from Faucet
            </button>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 h-11 rounded-full border border-border bg-background text-foreground font-medium hover:bg-secondary transition-colors"
              >
                I'll Switch Manually
              </button>
              <a
                href="https://mempool.space/testnet4"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 h-11 rounded-full bg-secondary text-foreground font-medium hover:bg-secondary/80 transition-colors"
              >
                View Explorer
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          <p className="text-[12px] text-muted-foreground text-center mt-4">
            {detectedWallet === 'unisat' 
              ? 'Switch to "Bitcoin Testnet4 Beta" in Unisat, then click "Check Network Status" above. The app will auto-detect the change.'
              : detectedWallet === 'xverse' || detectedWallet === 'leather'
              ? 'Switch to Testnet4 in your wallet, then click "Check Network Status" above. The app will auto-detect the change.'
              : 'Switch to Testnet4 in your wallet, then click "Check Network Status" above. The app will auto-detect the change.'}
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

