"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Menu, ShoppingCart, User, X, ChevronRight, LogOut, Wallet, Coins, Network, CheckCircle2, AlertCircle, Bitcoin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { useCart } from '@/context/CartContext';
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { useNetworkCheck } from '@/hooks/use-network-check';
import NetworkSwitchModal from '@/components/ui/network-switch-modal';
import TestnetFaucet from '@/components/ui/testnet-faucet';
import { attemptNetworkSwitch, detectWalletName, getNetworkFromWallet } from '@/lib/charms/network';
import { getWalletBalance } from '@/lib/charms/wallet';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showFaucet, setShowFaucet] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const pathname = usePathname();
  const { cartItems } = useCart();
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const {
    currentNetwork,
    isOnCorrectNetwork,
    showNetworkModal,
    setShowNetworkModal,
  } = useNetworkCheck();

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Fetch wallet balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!address || !isConnected) {
        setBalance(null);
        return;
      }

      setIsLoadingBalance(true);
      try {
        const walletBalance = await getWalletBalance(address, null);
        if (walletBalance !== null && walletBalance !== undefined) {
          setBalance(walletBalance);
        }
      } catch (error) {
        console.error('Failed to fetch balance:', error);
        setBalance(null);
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchBalance();
    // Refresh balance every 10 seconds
    const interval = setInterval(fetchBalance, 10000);
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
              className="flex items-center gap-3 transition-opacity hover:opacity-80"
            >
              <img 
                src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/image-1766104251676.png?width=8000&height=8000&resize=contain" 
                alt="Charm Cards" 
                className="h-10 sm:h-12 w-auto drop-shadow-sm"
              />
              <span className={`text-xl sm:text-2xl font-black font-bricolage tracking-tight ${!isTransparent ? "text-black" : "text-white"}`}>
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
            {/* Wallet Connection with Balance and Network Badge */}
            <div className="hidden md:flex items-center gap-2">
              {/* BTC Balance - Show when connected */}
              {isConnected && balance !== null && (
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center gap-2 h-11 px-4 rounded-full text-[13px] font-bold transition-all duration-300 ${
                    !isTransparent 
                      ? "bg-[#2A9DFF]/10 text-[#2A9DFF] border border-[#2A9DFF]/20" 
                      : "bg-white/20 text-white border border-white/30"
                  }`}
                >
                  <Bitcoin size={16} />
                  <span className="font-black">
                    {isLoadingBalance ? '...' : formatBalance(balance)} BTC
                  </span>
                </motion.div>
              )}

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <button 
                  onClick={() => open()}
                  className={`group flex items-center h-11 px-6 rounded-full text-[14px] font-black uppercase tracking-wider transition-all duration-300 font-bricolage ${
                    isConnected
                      ? (!isTransparent ? "bg-black/5 text-black hover:bg-black/10" : "bg-white/10 text-white hover:bg-white/20 border border-white/20")
                      : (!isTransparent 
                        ? "bg-[#2A9DFF] text-white hover:bg-[#1A8DFF] shadow-[0_4px_15px_rgba(42,157,255,0.3)]" 
                        : "bg-white text-[#2A9DFF] hover:bg-white/95 shadow-[0_8px_25px_rgba(0,0,0,0.15)]")
                  }`}
                >
                  <Wallet size={16} className="mr-2" />
                  <span>{isConnected ? `${address?.slice(0, 4)}...${address?.slice(-4)}` : "Connect"}</span>
                  <ChevronRight size={16} className="ml-1 transition-transform group-hover:translate-x-1" />
                </button>
              </motion.div>
              
              {/* Network Badge - Show when connected */}
              {isConnected && (
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <button
                    onClick={async () => {
                      if (!isOnCorrectNetwork) {
                        const walletName = detectWalletName();
                        await attemptNetworkSwitch(walletName || undefined);
                        // Check network after a moment
                        setTimeout(async () => {
                          const network = await getNetworkFromWallet();
                          if (network === 'testnet4' || network === 'testnet') {
                            window.location.reload();
                          }
                        }, 2000);
                      }
                    }}
                    className={`group flex items-center gap-2 h-11 px-4 rounded-full text-[12px] font-bold transition-all duration-300 ${
                      isOnCorrectNetwork
                        ? (!isTransparent 
                          ? "bg-green-500/10 text-green-600 border border-green-500/20 hover:bg-green-500/20" 
                          : "bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30")
                        : (!isTransparent 
                          ? "bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20 cursor-pointer" 
                          : "bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 cursor-pointer")
                    }`}
                    title={isOnCorrectNetwork ? "Network: Testnet4 ✓" : "Click to switch to Testnet4"}
                  >
                    {isOnCorrectNetwork ? (
                      <CheckCircle2 size={14} className="text-green-600" />
                    ) : (
                      <AlertCircle size={14} className="text-red-600" />
                    )}
                    <Network size={14} />
                    <span className="font-black uppercase tracking-wider">
                      {currentNetwork === 'testnet4' || currentNetwork === 'testnet' 
                        ? 'Testnet4' 
                        : currentNetwork === 'mainnet' 
                        ? 'Mainnet' 
                        : currentNetwork.toUpperCase()}
                    </span>
                    {!isOnCorrectNetwork && (
                      <ChevronRight size={12} className="transition-transform group-hover:translate-x-1" />
                    )}
                  </button>
                </motion.div>
              )}
            </div>

              <div className="flex items-center gap-2">
                {/* Get Testnet BTC Button - Visible when connected on Testnet4 */}
                {isConnected && isOnCorrectNetwork && (
                  <motion.div whileHover={{ scale: 1.08, y: -2 }} whileTap={{ scale: 0.92 }}>
                    <button
                      onClick={() => setShowFaucet(true)}
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


              <motion.div whileHover={{ scale: 1.08, y: -2 }} whileTap={{ scale: 0.92 }}>
                <Link
                  href="/cart"
                  className={`relative flex items-center justify-center w-10 h-10 rounded-full border transition-all duration-300 ${
                    !isTransparent 
                      ? "border-black/5 bg-black/5 hover:bg-black/10 text-black" 
                      : "border-white/10 bg-white/10 hover:bg-white/20 text-white"
                  }`}
                >
                  <ShoppingCart size={18} strokeWidth={2} />
                    <span className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm ${
                      !isTransparent ? "bg-[#2A9DFF] text-white" : "bg-white text-[#2A9DFF]"
                    }`}>
                      {cartCount}
                    </span>
                </Link>
              </motion.div>

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
                    open();
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center justify-center h-14 rounded-2xl text-lg font-black uppercase tracking-wider shadow-lg font-bricolage active:scale-[0.98] transition-transform ${
                    isConnected ? "bg-black/5 text-black border border-black/10" : "bg-black text-white"
                  }`}
                >
                  {isConnected ? `${address?.slice(0, 8)}...${address?.slice(-6)}` : "Connect Wallet"}
                </button>
                
                {isConnected && isOnCorrectNetwork && (
                  <button
                    onClick={() => {
                      setShowFaucet(true);
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center justify-center h-14 rounded-2xl border border-accent/20 bg-accent/10 text-accent text-lg font-bold active:scale-[0.98] transition-transform gap-2"
                  >
                    <Coins size={20} />
                    Get Testnet BTC
                  </button>
                )}
                
                {/* BTC Balance in Mobile Menu */}
                {isConnected && balance !== null && (
                  <div className="flex items-center justify-center h-14 rounded-2xl border border-[#2A9DFF]/20 bg-[#2A9DFF]/10 text-[#2A9DFF] text-lg font-bold gap-2">
                    <Bitcoin size={20} />
                    <span>{isLoadingBalance ? '...' : formatBalance(balance)} BTC</span>
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
        currentNetwork={currentNetwork === 'mainnet' ? 'Mainnet' : currentNetwork === 'testnet' ? 'Testnet' : currentNetwork}
        requiredNetwork="Testnet4"
      />

      {/* Testnet Faucet Modal */}
      <TestnetFaucet
        isOpen={showFaucet}
        onClose={() => setShowFaucet(false)}
      />
    </motion.header>
  );
}
