"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, Download, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { useAppKit } from '@reown/appkit/react';
import { connectUnisatDirectly, isUnisatAvailable } from '@/lib/charms/wallet-connection';
import { attemptNetworkSwitch, detectWalletName, getNetworkFromWallet } from '@/lib/charms/network';
import { toast } from 'sonner';

interface Wallet {
  id: string;
  name: string;
  icon: React.ReactNode;
  available: boolean;
  installUrl?: string;
}

interface WalletSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalletSelectModal({ isOpen, onClose }: WalletSelectModalProps) {
  const { open } = useAppKit();
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);

  // Check wallet availability on mount and when modal opens
  useEffect(() => {
    if (isOpen) {
      checkWalletAvailability();
    }
  }, [isOpen]);

  const checkWalletAvailability = () => {
    const walletList: Wallet[] = [
      {
        id: 'unisat',
        name: 'Unisat',
        icon: (
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#F7931A] flex items-center justify-center">
            <Image
              src="https://unisat.io/logo.png"
              alt="Unisat"
              width={32}
              height={32}
              className="w-full h-full object-contain"
              onError={(e) => {
                // Fallback to SVG if image fails to load
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="32" height="32" rx="6" fill="#F7931A"/>
                      <path d="M16 6L20 10H18V22H14V10H12L16 6Z" fill="white"/>
                    </svg>
                  `;
                }
              }}
            />
          </div>
        ),
        available: isUnisatAvailable(),
        installUrl: 'https://unisat.io/download',
      },
      {
        id: 'xverse',
        name: 'Xverse',
        icon: (
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#6366F1] flex items-center justify-center">
            <Image
              src="https://www.xverse.app/favicon.ico"
              alt="Xverse"
              width={32}
              height={32}
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="32" height="32" rx="6" fill="#6366F1"/>
                      <path d="M16 8L24 16L16 24L8 16L16 8Z" fill="white" fillRule="evenodd"/>
                    </svg>
                  `;
                }
              }}
            />
          </div>
        ),
        available: typeof window !== 'undefined' && !!(window as any).XverseProviders,
        installUrl: 'https://www.xverse.app/download',
      },
      {
        id: 'leather',
        name: 'Leather',
        icon: (
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-black flex items-center justify-center">
            <Image
              src="https://leather.io/icon-512.png"
              alt="Leather"
              width={32}
              height={32}
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="32" height="32" rx="6" fill="#000000"/>
                      <path d="M10 16L14 20L22 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  `;
                }
              }}
            />
          </div>
        ),
        available: typeof window !== 'undefined' && !!(window as any).btc,
        installUrl: 'https://leather.io/install-extension',
      },
    ];

    setWallets(walletList);
  };

  const handleConnect = async (walletId: string) => {
    setIsConnecting(walletId);

    try {
      let address: string | null = null;
      let walletName: string | null = null;

      // All wallets work the same way - try direct connection first (triggers popup)
      // If that fails, fall back to AppKit
      if (walletId === 'unisat') {
        try {
          address = await connectUnisatDirectly();
          walletName = 'unisat';
          
          if (!address) {
            throw new Error('Unisat connection returned no address');
          }
        } catch (error: any) {
          // If direct connection fails, use AppKit as fallback
          console.warn('Direct Unisat connection failed, using AppKit:', error);
          toast.info('Opening wallet selection...');
          onClose();
          setTimeout(() => {
            // Open AppKit with default view to show wallets directly
            open();
          }, 300);
          setIsConnecting(null);
          return;
        }
      } else if (walletId === 'xverse') {
        // Xverse works the same way as Unisat
        try {
          const { connectXverseDirectly } = await import('@/lib/charms/wallet-connection');
          address = await connectXverseDirectly();
          walletName = 'xverse';
          
          if (!address) {
            throw new Error('Xverse connection returned no address');
          }
        } catch (error: any) {
          // If direct connection fails, use AppKit as fallback (same as Unisat)
          console.warn('Direct Xverse connection failed, using AppKit:', error);
          toast.info('Opening wallet selection...');
          onClose();
          setTimeout(() => {
            try {
              // Open AppKit with default view to show wallets directly
              open();
            } catch (appKitError) {
              console.error('Failed to open AppKit modal:', appKitError);
              toast.error('Please connect your wallet manually through the browser extension.');
            }
          }, 300);
          setIsConnecting(null);
          return;
        }
      } else if (walletId === 'leather') {
        // Leather works the same way as Unisat
        try {
          const { connectLeatherDirectly } = await import('@/lib/charms/wallet-connection');
          address = await connectLeatherDirectly();
          walletName = 'leather';
          
          if (!address) {
            throw new Error('Leather connection returned no address');
          }
        } catch (error: any) {
          // If direct connection fails, use AppKit as fallback (same as Unisat)
          console.warn('Direct Leather connection failed, using AppKit:', error);
          toast.info('Opening wallet selection...');
          onClose();
          setTimeout(() => {
            // Open AppKit with default view to show wallets directly
            open();
          }, 300);
          setIsConnecting(null);
          return;
        }
      }

      if (address) {
        await handlePostConnection(address, walletName || walletId);
      } else {
        throw new Error('Connection failed - no address returned');
      }
    } catch (error: any) {
      console.error(`Failed to connect to ${walletId}:`, error);
      toast.error(error.message || `Failed to connect to ${walletId}`);
      setIsConnecting(null);
    }
  };

  const handleInstall = (installUrl: string) => {
    window.open(installUrl, '_blank');
  };

  const handlePostConnection = async (address: string, walletName: string) => {
    toast.success(`${walletName.charAt(0).toUpperCase() + walletName.slice(1)} wallet connected!`);
    
    // Automatically connect and switch network using connectAndSwitchNetwork
    // This will trigger both connection and network switch popups if needed
    try {
      const { connectAndSwitchNetwork } = await import('@/lib/charms/network');
      
      toast.info('Switching to Bitcoin Testnet4...');
      
      // This will automatically connect (if not already) and switch network
      const result = await connectAndSwitchNetwork(walletName);
      
      if (result.connected && result.switched) {
        toast.success('Wallet connected and switched to Testnet4!');
      } else if (result.connected) {
        toast.info('Wallet connected! Please approve network switch in the popup.');
      } else if (result.switched) {
        toast.success('Network switched to Testnet4!');
      } else {
        toast.warning('Please approve the connection and network switch in your wallet popup.');
      }
    } catch (networkError: any) {
      console.warn('Network switch failed:', networkError);
      toast.warning('Please ensure your wallet is on Bitcoin Testnet4 network.');
    }

    onClose();
    // Reload to sync with AppKit
    setTimeout(() => window.location.reload(), 1500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-black/5">
                <h2 className="text-[24px] font-black text-black font-bricolage">
                  Connect Wallet
                </h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors"
                >
                  <X size={20} className="text-black/60" />
                </button>
              </div>

              {/* Wallet List */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <p className="text-[14px] text-black/60 mb-4">
                  Choose a wallet to connect to Charm Cards
                </p>

                <div className="space-y-2">
                  {wallets.map((wallet) => (
                    <motion.button
                      key={wallet.id}
                      onClick={() => {
                        if (wallet.available) {
                          handleConnect(wallet.id);
                        } else if (wallet.installUrl) {
                          handleInstall(wallet.installUrl);
                        }
                      }}
                      disabled={isConnecting !== null}
                      className={`w-full h-16 px-4 rounded-xl border-2 transition-all duration-200 flex items-center justify-between group ${
                        wallet.available
                          ? isConnecting === wallet.id
                            ? 'border-[#2A9DFF] bg-[#2A9DFF]/5'
                            : 'border-black/10 hover:border-[#2A9DFF] hover:bg-[#2A9DFF]/5 bg-white'
                          : 'border-black/5 bg-black/2 opacity-60'
                      }`}
                      whileHover={wallet.available && isConnecting === null ? { scale: 1.02 } : {}}
                      whileTap={wallet.available && isConnecting === null ? { scale: 0.98 } : {}}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0">{wallet.icon}</div>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-[16px] font-semibold text-black">
                              {wallet.name}
                            </span>
                            {wallet.available && (
                              <CheckCircle2 size={16} className="text-green-500" />
                            )}
                          </div>
                          <span className="text-[12px] text-black/50">
                            {wallet.available ? 'Installed' : 'Not installed'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isConnecting === wallet.id ? (
                          <div className="w-5 h-5 border-2 border-[#2A9DFF] border-t-transparent rounded-full animate-spin" />
                        ) : wallet.available ? (
                          <Wallet size={20} className="text-[#2A9DFF]" />
                        ) : (
                          <Download size={20} className="text-black/30" />
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>

                {/* Alternative: Use AppKit directly */}
                <div className="mt-6 pt-6 border-t border-black/5">
                  <button
                    onClick={() => {
                      onClose();
                      setTimeout(() => {
                        // Open AppKit with default view (shows wallets directly)
                        // This will show all available wallets including Bitcoin wallets
                        open();
                      }, 300);
                    }}
                    className="w-full h-12 px-4 rounded-xl border-2 border-[#2A9DFF] bg-[#2A9DFF]/5 hover:bg-[#2A9DFF]/10 transition-all flex items-center justify-center gap-2"
                  >
                    <Wallet size={18} className="text-[#2A9DFF]" />
                    <span className="text-[14px] font-semibold text-[#2A9DFF]">
                      Use AppKit Wallet Selector
                    </span>
                  </button>
                  <p className="text-[11px] text-black/40 mt-2 text-center">
                    Opens the AppKit modal which auto-detects all installed wallets
                  </p>
                </div>

                <p className="text-[12px] text-black/40 mt-6 text-center">
                  New to Bitcoin wallets?{' '}
                  <a
                    href="https://docs.charms.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#2A9DFF] hover:underline"
                  >
                    Learn more
                  </a>
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

