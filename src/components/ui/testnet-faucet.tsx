"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Coins, ExternalLink, Copy, Check, X, Bitcoin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppKitAccount } from '@reown/appkit/react';
import { toast } from 'sonner';
import { getWalletUtxos, getWalletBalance } from '@/lib/charms/wallet';
import { isTaprootAddress } from '@/lib/charms/taproot-address';
import { formatBalanceSatsOnly } from '@/lib/utils/balance';

interface TestnetFaucetProps {
  isOpen: boolean;
  onClose: () => void;
  autoOpen?: boolean; // Auto-open when Taproot address detected
}

const TESTNET4_FAUCETS = [
  {
    name: 'Coinfaucet.eu Testnet4',
    url: 'https://coinfaucet.eu/en/btc-testnet4/',
    description: 'Reliable Testnet4 faucet - Supports Taproot addresses',
    supportsTaproot: true,
  },
  {
    name: 'Bitcoin Testnet4 Faucet',
    url: 'https://bitcoinfaucet.uo1.net/',
    description: 'Official Bitcoin Testnet4 faucet - Works with Taproot (tb1p...)',
    supportsTaproot: true,
  },
  {
    name: 'Mempool Testnet4 Faucet',
    url: 'https://mempool.space/testnet4/faucet',
    description: 'Mempool.space faucet - Taproot compatible',
    supportsTaproot: true,
  },
];

export default function TestnetFaucet({ isOpen, onClose, autoOpen = false }: TestnetFaucetProps) {
  const { address, isConnected } = useAppKitAccount();
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  
  // Check if faucet has already been shown (persists across page loads)
  const getHasAutoOpened = (): boolean => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('faucetModalShown');
    return stored === 'true';
  };
  
  const [hasAutoOpened, setHasAutoOpened] = useState<boolean>(getHasAutoOpened());

  // Auto-open when Taproot address is detected (only if not already shown before)
  useEffect(() => {
    if (autoOpen && address && isConnected && isTaprootAddress(address) && !hasAutoOpened && !isOpen) {
      setInternalIsOpen(true);
      setHasAutoOpened(true);
      // Store in localStorage so it persists across page loads
      if (typeof window !== 'undefined') {
        localStorage.setItem('faucetModalShown', 'true');
      }
    }
  }, [address, isConnected, autoOpen, hasAutoOpened, isOpen]);

  const actualIsOpen = isOpen || internalIsOpen;
  
  const handleClose = () => {
    setInternalIsOpen(false);
    onClose();
  };


  // Fetch Bitcoin balance - try wallet first, then UTXOs
  useEffect(() => {
    const fetchBalance = async () => {
      if (!address || !isConnected || !actualIsOpen) {
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

    if (actualIsOpen) {
      fetchBalance();
      // Refresh balance every 5 seconds while modal is open
      const interval = setInterval(fetchBalance, 5000);
      return () => clearInterval(interval);
    }
  }, [address, isConnected, actualIsOpen]);

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
      {actualIsOpen && (
        <>
          {/* Use high z-index to ensure modal appears above all content including navbar */}
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleClose();
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
              onClick={handleClose}
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
                      {formatBalanceSatsOnly(balance)}
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
                      Your Taproot Address
                    </p>
                    <p className="text-[13px] font-mono text-foreground break-all select-all">{address}</p>
                  </div>
                  <button
                    type="button"
                    onClick={copyAddress}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-black text-white flex-shrink-0 ml-2 cursor-pointer"
                    title="Copy address"
                  >
                    {copied ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Copy className="w-5 h-5" />
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

            {/* Address Type Info */}
            {address && isTaprootAddress(address) && (
              <div className="bg-green-500/10 border-2 border-green-500/30 rounded-[12px] p-4 mb-4">
                <div className="flex items-start gap-2">
                  <span className="text-[20px] flex-shrink-0">✅</span>
                  <div className="flex-1">
                    <p className="text-[14px] font-bold text-foreground mb-1">
                      Taproot Address Ready!
                    </p>
                    <p className="text-[13px] text-foreground leading-relaxed">
                      Your address is ready. Click any faucet button below to get testnet tokens. Your address will be copied automatically.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Faucets List */}
            <div className="mb-4">
              <h4 className="text-[16px] font-bold text-foreground mb-4">
                Testnet4 Faucets (Taproot Compatible):
              </h4>
              <div className="space-y-2">
                {TESTNET4_FAUCETS.map((faucet, index) => {
                  const handleCopyAndOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (address) {
                      navigator.clipboard.writeText(address);
                      toast.success('Address copied! Opening faucet...');
                      setTimeout(() => {
                        window.open(faucet.url, '_blank', 'noopener,noreferrer');
                      }, 300);
                    } else {
                      toast.error('Please connect your wallet first');
                    }
                  };

                  const handleDirectOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(faucet.url, '_blank', 'noopener,noreferrer');
                  };

                  return (
                    <div
                      key={index}
                      className="flex flex-col p-4 rounded-[12px] border-2 border-border bg-background hover:border-primary hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-[15px] font-bold text-foreground">
                              {faucet.name}
                            </p>
                            {faucet.supportsTaproot && (
                              <span className="text-[11px] px-2 py-1 rounded-md bg-green-500/20 text-green-700 dark:text-green-400 font-semibold border border-green-500/30">
                                Taproot ✓
                              </span>
                            )}
                          </div>
                          <p className="text-[13px] text-foreground/80 leading-relaxed">
                            {faucet.description}
                          </p>
                        </div>
                      </div>
                      {address ? (
                        <button
                          type="button"
                          onClick={handleCopyAndOpen}
                          className="w-full h-12 rounded-[8px] bg-black text-white font-bold text-[14px] flex items-center justify-center gap-2 cursor-pointer border-0"
                        >
                          <Copy className="w-4 h-4" />
                          Copy Address & Open Faucet
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleDirectOpen}
                          className="w-full h-12 rounded-[8px] bg-black text-white font-bold text-[14px] flex items-center justify-center gap-2 cursor-pointer border-0"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open Faucet
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Simple Instructions */}
            {address && isTaprootAddress(address) && (
              <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-[12px] p-4 mb-4">
                <p className="text-[13px] text-foreground text-center leading-relaxed">
                  <strong className="font-bold">Click any faucet button below.</strong> Your address will be copied automatically and the faucet will open in a new tab.
                </p>
              </div>
            )}
          </div>

          {/* Footer - Fixed */}
          <div className="p-6 pt-4 border-t border-border flex-shrink-0">
            <button
              onClick={handleClose}
              className="w-full h-11 rounded-full bg-black text-white font-medium cursor-pointer"
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

