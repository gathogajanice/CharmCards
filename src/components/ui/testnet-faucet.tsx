"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Coins, ExternalLink, Copy, Check, X, Bitcoin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppKitAccount } from '@reown/appkit/react';
import { toast } from 'sonner';
import { getWalletUtxos, getWalletBalance } from '@/lib/charms/wallet';

interface TestnetFaucetProps {
  isOpen: boolean;
  onClose: () => void;
}

const TESTNET4_FAUCETS = [
  {
    name: 'Bitcoin Testnet4 Faucet',
    url: 'https://bitcoinfaucet.uo1.net/',
    description: 'Official Bitcoin Testnet4 faucet',
  },
  {
    name: 'Coinfaucet.eu',
    url: 'https://coinfaucet.eu/en/btc-testnet4/',
    description: 'Reliable Testnet4 faucet',
  },
  {
    name: 'Testnet4 Faucet',
    url: 'https://testnet4.bitcoinfaucet.uo1.net/',
    description: 'Alternative Testnet4 faucet',
  },
];

export default function TestnetFaucet({ isOpen, onClose }: TestnetFaucetProps) {
  const { address, isConnected } = useAppKitAccount();
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Format balance to show up to 2 decimal places, removing trailing zeros
  const formatBalance = (bal: number | null): string => {
    if (bal === null || bal === undefined) return '0';
    // Round to 2 decimal places and remove trailing zeros
    const rounded = Math.round(bal * 100) / 100;
    return rounded.toFixed(2).replace(/\.?0+$/, '');
  };

  // Fetch Bitcoin balance - try wallet first, then UTXOs
  useEffect(() => {
    const fetchBalance = async () => {
      if (!address || !isConnected || !isOpen) {
        setBalance(null);
        return;
      }

      setIsLoadingBalance(true);
      try {
        // First try to get balance directly from wallet (most accurate)
        let walletBalance = await getWalletBalance(address, null);
        
        if (walletBalance !== null && walletBalance !== undefined) {
          console.log('Balance from wallet:', walletBalance);
          setBalance(walletBalance);
        } else {
          // Fallback: calculate from UTXOs
          console.log('Wallet balance not available, calculating from UTXOs...');
          const utxos = await getWalletUtxos(address, null);
          const totalSats = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
          const totalBTC = totalSats / 100000000;
          console.log('Balance from UTXOs:', totalBTC, 'BTC');
          setBalance(totalBTC);
        }
      } catch (error) {
        console.error('Failed to fetch balance:', error);
        setBalance(null);
      } finally {
        setIsLoadingBalance(false);
      }
    };

    if (isOpen) {
      fetchBalance();
      // Refresh balance every 5 seconds while modal is open
      const interval = setInterval(fetchBalance, 5000);
      return () => clearInterval(interval);
    }
  }, [address, isConnected, isOpen]);

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success('Address copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Use high z-index to ensure modal appears above all content including navbar */}
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                onClose();
              }
            }}
            onWheel={(e) => {
              // Prevent backdrop from capturing scroll events
              e.stopPropagation();
            }}
            style={{ overflow: 'hidden' }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-background border border-border rounded-[16px] shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden relative z-[101]"
              onClick={(e) => {
                // Prevent clicks inside modal from closing it
                e.stopPropagation();
              }}
            >
          {/* Header - Fixed */}
          <div className="flex items-start justify-between p-6 pb-4 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Coins className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[18px] font-semibold text-foreground">
                  Get Testnet4 BTC
                </h3>
                <p className="text-[13px] text-muted-foreground mt-1">
                  Get free Testnet4 BTC to test the app
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary transition-colors flex-shrink-0 ml-2"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div 
            className="flex-1 overflow-y-auto overflow-x-hidden p-6 pt-4"
            style={{ 
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain'
            }}
          >
            {/* Bitcoin Balance Display */}
            {address && isConnected && (
              <div className="bg-primary/10 border border-primary/20 rounded-[12px] p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bitcoin className="w-5 h-5 text-primary" />
                    <span className="text-[12px] text-muted-foreground uppercase tracking-wider font-medium">
                      Your Balance
                    </span>
                  </div>
                  {isLoadingBalance ? (
                    <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  ) : balance !== null ? (
                    <span className="text-[20px] font-black text-foreground font-bricolage">
                      {formatBalance(balance)} BTC
                    </span>
                  ) : (
                    <span className="text-[14px] text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            )}

            {/* Address Display */}
            {address ? (
              <div className="bg-secondary/50 rounded-[12px] p-4 mb-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-muted-foreground mb-1.5 uppercase tracking-wider font-medium">
                      Your Address
                    </p>
                    <p className="text-[13px] font-mono text-foreground break-all">{address}</p>
                  </div>
                  <button
                    onClick={copyAddress}
                    className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary transition-colors flex-shrink-0 ml-2"
                    title="Copy address"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-[12px] p-4 mb-4">
                <p className="text-[13px] text-foreground">
                  ⚠️ Please connect your wallet first to get your address
                </p>
              </div>
            )}

            {/* Faucets List */}
            <div className="mb-4">
              <h4 className="text-[14px] font-semibold text-foreground mb-3">
                Testnet4 Faucets:
              </h4>
              <div className="space-y-2">
                {TESTNET4_FAUCETS.map((faucet, index) => (
                  <a
                    key={index}
                    href={faucet.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-[8px] border border-border hover:border-accent hover:bg-accent/5 transition-all group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-foreground group-hover:text-accent transition-colors">
                        {faucet.name}
                      </p>
                      <p className="text-[12px] text-muted-foreground mt-0.5">
                        {faucet.description}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors flex-shrink-0 ml-2" />
                  </a>
                ))}
              </div>
            </div>

            {/* Tip Card */}
            <div className="bg-accent/5 border border-accent/20 rounded-[12px] p-4">
              <div className="flex items-start gap-2">
                <span className="text-[16px] flex-shrink-0">💡</span>
                <p className="text-[13px] text-foreground leading-relaxed">
                  <strong className="font-semibold">Tip:</strong> Copy your address above and paste it into any faucet. 
                  You'll receive Testnet4 BTC within a few minutes.
                </p>
              </div>
            </div>
          </div>

          {/* Footer - Fixed */}
          <div className="p-6 pt-4 border-t border-border flex-shrink-0">
            <button
              onClick={onClose}
              className="w-full h-11 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
            >
              Got it!
            </button>
            </div>
          </motion.div>
        </div>
        </>
      )}
    </AnimatePresence>
  );

  // Render modal using portal to ensure it's always on top
  return createPortal(modalContent, document.body);
}

