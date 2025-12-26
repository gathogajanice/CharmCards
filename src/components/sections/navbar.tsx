"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Menu, User, X, ChevronRight, LogOut, Wallet, Coins, Network, CheckCircle2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { useNetworkCheck } from '@/hooks/use-network-check';
import NetworkSwitchModal from '@/components/ui/network-switch-modal';
import TestnetFaucet from '@/components/ui/testnet-faucet';
import WalletSelectModal from '@/components/ui/wallet-select-modal';
import { attemptNetworkSwitch, detectWalletName, getNetworkFromWallet } from '@/lib/charms/network';
import { getWalletBalance } from '@/lib/charms/wallet';
import { formatBalanceSatsOnly } from '@/lib/utils/balance';

// Component to show connected wallet name
function ConnectedWalletName() {
  const [walletName, setWalletName] = useState<string>('Wallet');
  const { isConnected, address } = useAppKitAccount();
  
  useEffect(() => {
    const detectWallet = async () => {
      if (isConnected && address) {
        const { detectConnectedWallet } = await import('@/lib/charms/network');
        const wallet = await detectConnectedWallet();
        if (wallet) {
          setWalletName(wallet.charAt(0).toUpperCase() + wallet.slice(1));
        } else {
          setWalletName('Wallet');
        }
      } else {
        setWalletName('Wallet');
      }
    };
    
    detectWallet();
    // Re-check periodically in case wallet changes
    const interval = setInterval(detectWallet, 3000);
    return () => clearInterval(interval);
  }, [isConnected, address]);
  
  return (
    <span className="text-[9px] text-black/50 font-medium leading-tight">
      {walletName}
    </span>
  );
}

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showFaucet, setShowFaucet] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [displayBalance, setDisplayBalance] = useState<number | null>(null);
  const pathname = usePathname();
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const {
    currentNetwork,
    isOnCorrectNetwork,
    showNetworkModal,
    setShowNetworkModal,
    dismissModal,
  } = useNetworkCheck();

  // Fetch wallet balance - prevent blinking by only updating display when value actually changes
  useEffect(() => {
    const fetchBalance = async () => {
      if (!address || !isConnected) {
        setBalance(null);
        setDisplayBalance(null);
        return;
      }

      setIsLoadingBalance(true);
      try {
        const walletBalance = await getWalletBalance(address, null);
        if (walletBalance !== null && walletBalance !== undefined) {
          setBalance(walletBalance);
          // Only update display if value actually changed (prevents blinking)
          setDisplayBalance(prev => {
            if (prev === null || Math.abs(prev - walletBalance) > 0.00000001) {
              return walletBalance;
            }
            return prev;
          });
        } else {
          setBalance(null);
          setDisplayBalance(null);
        }
      } catch (error) {
        console.error('Failed to fetch balance:', error);
        // Don't clear display on error to prevent blinking
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchBalance();
    // Refresh balance every 15 seconds (less frequent to reduce blinking)
    const interval = setInterval(fetchBalance, 15000);
    return () => clearInterval(interval);
  }, [address, isConnected]);

  const hasHeroBanner = pathname === "/" || pathname === "/categories";

  useEffect(() => {
    const handleScroll = () => {
      // Check if we've scrolled past the banner (550px on mobile, 600px on desktop)
      const bannerHeight = window.innerWidth >= 1024 ? 600 : 550;
      setIsScrolled(window.scrollY > bannerHeight);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isTransparent = hasHeroBanner && !isScrolled;

  return (
    <motion.header 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 z-50 w-full transition-all duration-500 ${
        isTransparent 
          ? "bg-transparent py-6" 
          : "bg-white/80 backdrop-blur-xl border-b border-black/5 py-3 shadow-[0_2px_20px_rgba(0,0,0,0.02)]"
      }`}
    >
      <div className="container mx-auto px-6 sm:px-8 flex items-center justify-between h-14 sm:h-16 gap-4">
        <div className="flex items-center flex-shrink-0">
          <motion.div
            whileHover={{ scale: 1.05, rotate: -2 }}
            whileTap={{ scale: 0.95 }}
            className="relative"
          >
            <Link
              href="/"
              aria-label="Charm Cards"
              className="flex items-center gap-3 transition-opacity hover:opacity-80 cursor-pointer"
              onClick={(e) => {
                // Ensure navigation happens
                e.stopPropagation();
              }}
            >
              <img 
                src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/image-1766104251676.png?width=8000&height=8000&resize=contain" 
                alt="Charm Cards" 
                className="h-10 sm:h-12 w-auto drop-shadow-sm pointer-events-none"
              />
              <span className={`text-xl sm:text-2xl font-black font-bricolage tracking-tight ${!isTransparent ? "text-black" : "text-white"} pointer-events-none`}>
                Charm Cards
              </span>
            </Link>
          </motion.div>
        </div>

        <div className="flex-1 max-w-[500px] hidden sm:flex justify-center">
            <div className="relative group w-full">
              <input
                type="text"
                placeholder="Search gift cards..."
                className={`w-full h-11 pl-12 pr-4 rounded-full text-[14px] font-medium outline-none transition-all duration-300 ${
                  !isTransparent 
                    ? "bg-black/5 text-black placeholder-black/30 focus:bg-black/10 focus:ring-2 focus:ring-[#2A9DFF]/20" 
                    : "bg-white/10 text-white placeholder-white/40 backdrop-blur-md border border-white/20 focus:bg-white/20 focus:ring-2 focus:ring-white/10"
                }`}
              />
              <div className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors duration-300 ${!isTransparent ? "text-black/30" : "text-white/40"}`}>
                <Search size={18} strokeWidth={2.5} />
              </div>
            </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {/* Wallet Connection with Balance */}
            <div className="hidden md:flex items-center gap-3">
              {/* Balance - Show when connected (sats primary, BTC secondary) */}
              {isConnected && displayBalance !== null && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2.5 h-10 px-4 rounded-full bg-black text-white border-0"
                >
                  <span className="text-[13px] font-bold leading-none">
                    {formatBalanceSatsOnly(displayBalance)}
                  </span>
                </motion.div>
              )}

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <button 
                  onClick={() => {
                    if (isConnected) {
                      open({ view: 'Account' }); // Open wallet modal if already connected
                      return;
                    }
                    // Try to open AppKit directly first (it should detect wallets)
                    // Open with default view to show wallets directly
                    try {
                      open();
                    } catch (error) {
                      // Fallback to custom modal if AppKit fails
                      console.warn('AppKit modal failed, showing custom modal:', error);
                      setShowWalletModal(true);
                    }
                  }}
                  className={`group flex items-center transition-all duration-300 font-bricolage ${
                    isConnected
                      ? `h-9 px-3 rounded-full text-[12px] font-semibold ${
                          !isTransparent 
                            ? "bg-black/5 text-black hover:bg-black/10" 
                            : "bg-white/10 text-white hover:bg-white/20 border border-white/20"
                        }`
                      : `h-11 px-6 rounded-full text-[14px] font-black uppercase tracking-wider ${
                          !isTransparent 
                            ? "bg-[#2A9DFF] text-white hover:bg-[#1A8DFF] shadow-[0_4px_15px_rgba(42,157,255,0.3)]" 
                            : "bg-white text-[#2A9DFF] hover:bg-white/95 shadow-[0_8px_25px_rgba(0,0,0,0.15)]"
                        }`
                  }`}
                >
                  {isConnected ? (
                    <>
                      <Wallet size={14} className="mr-1.5" />
                      <div className="flex flex-col items-start">
                        <span className="font-semibold text-[11px] leading-tight">{address?.slice(0, 4)}...{address?.slice(-4)}</span>
                        <ConnectedWalletName />
                      </div>
                    </>
                  ) : (
                    <>
                      <Wallet size={16} className="mr-2" />
                      <span>Connect</span>
                      <ChevronRight size={16} className="ml-1 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </motion.div>
            </div>

              <div className="flex items-center gap-2">
                {/* Get Testnet BTC Button - Visible when connected on Testnet4 */}
                {isConnected && isOnCorrectNetwork && (
                  <motion.div 
                    whileHover={{ scale: 1.08, y: -2 }} 
                    whileTap={{ scale: 0.92 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Get Testnet BTC button clicked - opening faucet modal');
                        setShowFaucet(true);
                      }}
                      type="button"
                      className={`flex items-center justify-center w-10 h-10 rounded-full border transition-all duration-300 ${
                        !isTransparent 
                          ? "border-black/5 bg-black/5 hover:bg-black/10 text-black" 
                          : "border-white/10 bg-white/10 hover:bg-white/20 text-white"
                      }`}
                      title="Get Testnet4 BTC"
                    >
                      <Coins size={18} strokeWidth={2} />
                    </button>
                  </motion.div>
                )}

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className={`md:hidden flex items-center justify-center w-10 h-10 rounded-full border transition-all duration-300 ${
                  !isTransparent 
                    ? "border-black/5 bg-black/5 hover:bg-black/10 text-black" 
                    : "border-white/10 bg-white/10 hover:bg-white/20 text-white"
                }`}
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </motion.button>
            </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden bg-white/95 backdrop-blur-2xl border-b border-black/5 shadow-2xl px-6 py-8"
          >
            <nav className="flex flex-col gap-4">
              <div className="relative group w-full mb-2">
                <input
                  type="text"
                  placeholder="Search gift cards..."
                  className="w-full h-12 pl-12 pr-4 rounded-2xl text-[14px] font-medium outline-none bg-black/5 text-black placeholder-black/30"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30">
                  <Search size={18} strokeWidth={2.5} />
                </div>
              </div>
                <button 
                  onClick={() => {
                    if (isConnected) {
                      open();
                    } else {
                      setShowWalletModal(true);
                    }
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center justify-center h-12 rounded-xl text-[14px] font-semibold shadow-lg font-bricolage active:scale-[0.98] transition-transform gap-2 ${
                    isConnected 
                      ? "bg-black/5 text-black border border-black/10" 
                      : "bg-black text-white"
                  }`}
                >
                  <Wallet size={16} />
                  {isConnected ? `${address?.slice(0, 6)}...${address?.slice(-4)}` : "Connect Wallet"}
                </button>
                
                {isConnected && isOnCorrectNetwork && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowFaucet(true);
                      setMobileMenuOpen(false);
                    }}
                    type="button"
                    className="flex items-center justify-center h-14 rounded-2xl border border-accent/20 bg-accent/10 text-accent text-lg font-bold active:scale-[0.98] transition-transform gap-2"
                  >
                    <Coins size={20} />
                    Get Testnet BTC
                  </button>
                )}
                
                {/* Balance in Mobile Menu (sats only) */}
                {isConnected && displayBalance !== null && (
                  <div className="flex items-center justify-center h-12 rounded-xl bg-black text-white text-[14px] font-semibold gap-2.5">
                    <span className="text-[14px] font-bold leading-none">
                      {formatBalanceSatsOnly(displayBalance)}
                    </span>
                  </div>
                )}

            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Network Switch Modal - Shows when wrong network detected */}
      <NetworkSwitchModal
        isOpen={showNetworkModal}
        onClose={() => setShowNetworkModal(false)}
        onDismiss={() => dismissModal(5)} // Dismiss for 5 minutes
        currentNetwork={currentNetwork === 'mainnet' ? 'Mainnet' : currentNetwork === 'testnet' ? 'Testnet' : currentNetwork}
        requiredNetwork="Testnet4"
      />

      {/* Testnet Faucet Modal */}
      <TestnetFaucet
        isOpen={showFaucet}
        onClose={() => setShowFaucet(false)}
        autoOpen={true}
      />

      {/* Wallet Selection Modal */}
      <WalletSelectModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
      />
    </motion.header>
  );
}
