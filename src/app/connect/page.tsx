"use client";

import React, { useState } from 'react';
import Navbar from '@/components/sections/navbar';
import Footer from '@/components/sections/footer';
import { motion, AnimatePresence } from 'framer-motion';

const wallets = [
  {
    id: 'metamask',
    name: 'MetaMask',
    icon: (
      <svg viewBox="0 0 35 33" className="w-8 h-8">
        <path fill="#E17726" d="M32.96 1l-13.14 9.72 2.44-5.72L32.96 1z"/>
        <path fill="#E27625" d="M2.66 1l13.02 9.82-2.32-5.82L2.66 1zM28.23 23.53l-3.5 5.35 7.49 2.06 2.14-7.28-6.13-.13zM1.27 23.66l2.13 7.28 7.47-2.06-3.48-5.35-6.12.13z"/>
        <path fill="#E27625" d="M10.47 14.51l-2.08 3.14 7.4.34-.26-7.97-5.06 4.49zM25.15 14.51l-5.13-4.59-.17 8.07 7.38-.34-2.08-3.14zM10.87 28.88l4.49-2.16-3.86-3.01-.63 5.17zM20.28 26.72l4.46 2.16-.61-5.17-3.85 3.01z"/>
        <path fill="#D5BFB2" d="M24.74 28.88l-4.46-2.16.36 2.9-.04 1.23 4.14-1.97zM10.87 28.88l4.16 1.97-.03-1.23.34-2.9-4.47 2.16z"/>
        <path fill="#233447" d="M15.1 21.78l-3.68-1.08 2.6-1.19 1.08 2.27zM20.52 21.78l1.09-2.27 2.61 1.19-3.7 1.08z"/>
        <path fill="#CC6228" d="M10.87 28.88l.65-5.35-4.13.13 3.48 5.22zM24.1 23.53l.64 5.35 3.49-5.22-4.13-.13zM27.23 17.65l-7.38.34.69 3.79 1.09-2.27 2.61 1.19 2.99-3.05zM11.42 20.7l2.6-1.19 1.08 2.27.69-3.79-7.4-.34 3.03 3.05z"/>
        <path fill="#E27625" d="M8.39 17.65l3.16 6.16-.11-3.11-3.05-3.05zM24.24 20.7l-.12 3.11 3.17-6.16-3.05 3.05zM15.79 17.99l-.69 3.79.87 4.5.2-5.93-.38-2.36zM19.85 17.99l-.37 2.35.18 5.94.87-4.5-.68-3.79z"/>
        <path fill="#F5841F" d="M20.53 21.78l-.87 4.5.62.44 3.85-3.01.12-3.11-3.72 1.18zM11.42 20.7l.11 3.11 3.86 3.01.62-.44-.87-4.5-3.72-1.18z"/>
        <path fill="#C0AC9D" d="M20.59 30.85l.04-1.23-.34-.29h-4.96l-.32.29.03 1.23-4.17-1.97 1.46 1.19 2.95 2.04h5.05l2.96-2.04 1.45-1.19-4.15 1.97z"/>
        <path fill="#161616" d="M20.28 26.72l-.62-.44h-3.7l-.62.44-.34 2.9.32-.29h4.96l.34.29-.34-2.9z"/>
        <path fill="#763E1A" d="M33.52 11.35l1.11-5.35L32.96 1l-12.68 9.4 4.87 4.11 6.89 2.01 1.52-1.78-.66-.48 1.05-.96-.81-.62 1.05-.8-.7-.54zM1 6l1.12 5.35-.72.54 1.06.8-.8.62 1.05.96-.67.48 1.52 1.78 6.89-2.01 4.87-4.11L2.66 1 1 6z"/>
        <path fill="#F5841F" d="M32.04 16.47l-6.89-2.01 2.08 3.14-3.17 6.16 4.18-.05h6.13l-2.33-7.24zM10.47 14.46l-6.89 2.01-2.29 7.24h6.12l4.17.05-3.16-6.16 2.05-3.14zM19.85 17.99l.44-7.59 2-5.4h-8.94l1.98 5.4.45 7.59.17 2.38.02 5.91h3.7l.01-5.91.17-2.38z"/>
      </svg>
    ),
    popular: true,
  },
  {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    icon: (
      <svg viewBox="0 0 32 32" className="w-8 h-8">
        <circle fill="#0052FF" cx="16" cy="16" r="16"/>
        <path fill="#fff" d="M16 6C10.477 6 6 10.477 6 16s4.477 10 10 10 10-4.477 10-10S21.523 6 16 6zm0 15c-2.761 0-5-2.239-5-5s2.239-5 5-5 5 2.239 5 5-2.239 5-5 5z"/>
      </svg>
    ),
    popular: true,
  },
  {
    id: 'walletconnect',
    name: 'WalletConnect',
    icon: (
      <svg viewBox="0 0 32 32" className="w-8 h-8">
        <rect fill="#3B99FC" width="32" height="32" rx="6"/>
        <path fill="#fff" d="M9.58 11.58c3.54-3.47 9.28-3.47 12.82 0l.43.42a.44.44 0 010 .63l-1.46 1.43a.23.23 0 01-.32 0l-.59-.58a6.47 6.47 0 00-8.95 0l-.63.62a.23.23 0 01-.32 0l-1.46-1.43a.44.44 0 010-.63l.48-.46zm15.84 2.95l1.3 1.27a.44.44 0 010 .63l-5.85 5.73a.46.46 0 01-.64 0l-4.15-4.07a.12.12 0 00-.16 0l-4.15 4.07a.46.46 0 01-.64 0l-5.85-5.73a.44.44 0 010-.63l1.3-1.27a.46.46 0 01.64 0l4.15 4.07c.04.04.12.04.16 0l4.15-4.07a.46.46 0 01.64 0l4.15 4.07c.04.04.12.04.16 0l4.15-4.07a.46.46 0 01.64 0z"/>
      </svg>
    ),
    popular: true,
  },
  {
    id: 'phantom',
    name: 'Phantom',
    icon: (
      <svg viewBox="0 0 128 128" className="w-8 h-8">
        <rect fill="#AB9FF2" width="128" height="128" rx="26"/>
        <path fill="#fff" d="M110.517 64.749C110.517 89.138 90.627 109 66.204 109c-19.76 0-36.534-12.954-42.252-30.845-.634-1.983.867-3.953 2.938-3.953h7.869c1.396 0 2.619.93 3.056 2.253 4.058 12.26 15.642 21.075 29.389 21.075 17.085 0 30.937-13.827 30.937-30.881 0-17.054-13.852-30.881-30.937-30.881-8.504 0-16.211 3.436-21.809 8.993l5.637 2.082c2.275.841 2.606 3.913.561 5.207l-16.06 10.16c-1.75 1.107-4.074-.082-4.074-2.084V27.993c0-2.248 2.605-3.493 4.354-2.08l5.844 4.72c7.683-7.104 17.934-11.45 29.147-11.45 24.423 0 44.197 19.78 44.197 44.166z"/>
      </svg>
    ),
    popular: false,
  },
  {
    id: 'trustwallet',
    name: 'Trust Wallet',
    icon: (
      <svg viewBox="0 0 32 32" className="w-8 h-8">
        <rect fill="#0500FF" width="32" height="32" rx="6"/>
        <path fill="#fff" d="M16 5.33c6.443 3.893 10.667 3.047 10.667 3.047s-.89 13.73-10.667 18.29C5.223 22.107 4.333 8.377 4.333 8.377S8.557 9.223 16 5.33z" strokeWidth="1.5" stroke="#fff" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    popular: false,
  },
  {
    id: 'ledger',
    name: 'Ledger',
    icon: (
      <svg viewBox="0 0 32 32" className="w-8 h-8">
        <rect fill="#000" width="32" height="32" rx="6"/>
        <path fill="#fff" d="M6 19.5v6h12.5v-1.5H7.5v-4.5H6zm0-7.5v6h1.5v-4.5h11V6H6v6zm13 13v-6h-1.5v4.5h-11V26h12.5v-1zM26 6h-6v1.5h4.5v4.5H26V6zm-7 13h1.5v-6H19v6zm7 0h-1.5v4.5h-4.5V25H26v-6z"/>
      </svg>
    ),
    popular: false,
  },
];

export default function ConnectPage() {
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = (walletId: string) => {
    setSelectedWallet(walletId);
    setIsConnecting(true);
    
    setTimeout(() => {
      setIsConnecting(false);
      alert(`${wallets.find(w => w.id === walletId)?.name} connected successfully!`);
    }, 2000);
  };

  const popularWallets = wallets.filter(w => w.popular);
  const otherWallets = wallets.filter(w => !w.popular);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <main className="container pt-32 pb-20">
        <motion.div 
          className="max-w-[480px] mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-[48px] font-semibold leading-[1.1] tracking-[-0.02em] text-black mb-4">
            Connect wallet
          </h1>
          
          <p className="text-[14px] text-[#666666] mb-10">
            Connect your wallet to start purchasing gift cards with your favorite cryptocurrencies.
          </p>

          <div className="space-y-6">
            <div>
              <h2 className="text-[12px] font-semibold text-[#666666] uppercase tracking-wide mb-4">
                Popular
              </h2>
              <div className="space-y-2">
                {popularWallets.map((wallet, index) => (
                  <motion.button
                    key={wallet.id}
                    onClick={() => handleConnect(wallet.id)}
                    disabled={isConnecting}
                    className={`
                      w-full h-16 px-5 rounded-[12px] font-semibold text-[14px] transition-all duration-200 border flex items-center justify-between
                      ${selectedWallet === wallet.id && isConnecting
                        ? 'bg-[#F2F2F2] border-black'
                        : 'bg-white border-[rgba(0,0,0,0.1)] hover:border-black hover:bg-[#F2F2F2]'
                      }
                    `}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className="flex items-center gap-4">
                      {wallet.icon}
                      <span className="text-black">{wallet.name}</span>
                    </div>
                    {selectedWallet === wallet.id && isConnecting ? (
                      <motion.div 
                        className="w-5 h-5 border-2 border-black border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                    ) : (
                      <svg className="w-5 h-5 text-[#666666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </motion.button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-[12px] font-semibold text-[#666666] uppercase tracking-wide mb-4">
                More wallets
              </h2>
              <div className="space-y-2">
                {otherWallets.map((wallet, index) => (
                  <motion.button
                    key={wallet.id}
                    onClick={() => handleConnect(wallet.id)}
                    disabled={isConnecting}
                    className={`
                      w-full h-16 px-5 rounded-[12px] font-semibold text-[14px] transition-all duration-200 border flex items-center justify-between
                      ${selectedWallet === wallet.id && isConnecting
                        ? 'bg-[#F2F2F2] border-black'
                        : 'bg-white border-[rgba(0,0,0,0.1)] hover:border-black hover:bg-[#F2F2F2]'
                      }
                    `}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + index * 0.05 }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className="flex items-center gap-4">
                      {wallet.icon}
                      <span className="text-black">{wallet.name}</span>
                    </div>
                    {selectedWallet === wallet.id && isConnecting ? (
                      <motion.div 
                        className="w-5 h-5 border-2 border-black border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                    ) : (
                      <svg className="w-5 h-5 text-[#666666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-[rgba(0,0,0,0.1)]">
            <p className="text-[14px] text-[#666666] text-center">
              New to wallets?{' '}
              <a href="https://ethereum.org/wallets" target="_blank" rel="noopener noreferrer" className="text-black hover:underline font-medium">
                Learn more about wallets
              </a>
            </p>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
