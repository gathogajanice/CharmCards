"use client";

import React, { useState } from 'react';
import Navbar from '@/components/sections/navbar';
import Footer from '@/components/sections/footer';
import { motion } from 'framer-motion';
import { Send, ExternalLink, Copy, Check, DollarSign, Wallet, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Mock data for owned gift cards (NFTs)
const mockGiftCards = [
  {
    id: '1',
    brand: 'Amazon.com',
    image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T002841.206-1766179817903.png?width=8000&height=8000&resize=contain',
    balance: 85.50,
    originalAmount: 100,
    expirationDate: '2025-12-31',
    tokenId: '0x1234...5678',
    transactionHash: '0xabcd...efgh',
    purchaseDate: '2024-01-15',
    category: 'Shopping',
  },
  {
    id: '2',
    brand: 'Uber',
    image: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-13T134944.605-1766098833835.png?width=8000&height=8000&resize=contain',
    balance: 50.00,
    originalAmount: 50,
    expirationDate: null,
    tokenId: '0x2345...6789',
    transactionHash: '0xbcde...fghi',
    purchaseDate: '2024-02-20',
    category: 'Travel',
  },
];

export default function WalletPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const router = useRouter();

  const totalBalance = mockGiftCards.reduce((sum, card) => sum + card.balance, 0);
  const totalCards = mockGiftCards.length;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No expiration';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handleRedeem = (brand: string) => {
    router.push(`/gift-card/${brand.toLowerCase().replace(/\s+/g, '-')}`);
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <main className="container pt-24 sm:pt-28 md:pt-32 pb-16 max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-16">
        <nav className="flex items-center gap-2 text-[11px] sm:text-[12px] md:text-[13px] mb-8 sm:mb-10 md:mb-12 overflow-x-auto no-scrollbar whitespace-nowrap opacity-60">
          <Link href="/" className="hover:text-black transition-colors">Home</Link>
          <span>/</span>
          <span className="text-black font-semibold">My Wallet</span>
        </nav>

        {/* Header */}
        <div className="mb-8 sm:mb-10 md:mb-12">
          <h1 className="text-[32px] sm:text-[40px] md:text-[48px] font-bold leading-[1] tracking-[-0.04em] text-black mb-4 sm:mb-5 md:mb-6">
            Owned in<br />Your wallet
          </h1>
          <p className="text-[12px] sm:text-[13px] text-[#666666] leading-[1.6] max-w-2xl font-medium">
            View and manage your Bitcoin NFT gift cards. All gift cards are secured on Bitcoin and fully transferable.
          </p>
        </div>

        {/* Stats - Only show if user has cards */}
        {mockGiftCards.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-8 sm:mb-10 md:mb-12">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="bg-white border border-black/[0.04] rounded-full px-3 sm:px-4 py-2.5 sm:py-3 shadow-sm hover:shadow-md transition-shadow flex items-center gap-2 sm:gap-3"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#2A9DFF]/10 flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#2A9DFF]" fill="currentColor" />
              </div>
              <div>
                <span className="text-[8px] sm:text-[9px] font-black text-black uppercase tracking-[0.15em] block">Total Balance</span>
                <p className="text-[14px] sm:text-[16px] font-black text-black font-bricolage leading-none">${totalBalance.toFixed(2)}</p>
              </div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="bg-white border border-black/[0.04] rounded-full px-3 sm:px-4 py-2.5 sm:py-3 shadow-sm hover:shadow-md transition-shadow flex items-center gap-2 sm:gap-3"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#2A9DFF]/10 flex items-center justify-center flex-shrink-0">
                <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#2A9DFF]" fill="currentColor" />
              </div>
              <div>
                <span className="text-[8px] sm:text-[9px] font-black text-black uppercase tracking-[0.15em] block">Gift Cards</span>
                <p className="text-[14px] sm:text-[16px] font-black text-black font-bricolage leading-none">{totalCards}</p>
              </div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="bg-white border border-black/[0.04] rounded-full px-3 sm:px-4 py-2.5 sm:py-3 shadow-sm hover:shadow-md transition-shadow flex items-center gap-2 sm:gap-3"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#2A9DFF]/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#2A9DFF]" fill="currentColor" />
              </div>
              <div>
                <span className="text-[8px] sm:text-[9px] font-black text-black uppercase tracking-[0.15em] block">Active</span>
                <p className="text-[14px] sm:text-[16px] font-black text-black font-bricolage leading-none">{mockGiftCards.filter(c => c.balance > 0).length}</p>
              </div>
            </motion.div>
          </div>
        )}

        {/* Gift Cards - 3x2 Grid Layout */}
        {mockGiftCards.length === 0 ? (
          <div className="text-center py-20">
            <Wallet className="w-16 h-16 text-black/20 mx-auto mb-4" />
            <p className="text-black/60 text-[13px] mb-2 font-medium">No gift cards yet</p>
            <p className="text-black/40 text-[11px] font-medium">Purchase gift cards to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockGiftCards.map((card, index) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4 }}
                transition={{ 
                  duration: 0.4, 
                  delay: index * 0.1,
                  hover: { duration: 0.2 }
                }}
                className="bg-white border border-black/[0.04] rounded-[1.5rem] overflow-hidden shadow-sm hover:shadow-lg transition-all flex flex-col"
              >
                {/* Brand Image */}
                <div className="relative w-full h-[200px] bg-gradient-to-br from-black/[0.01] to-transparent border-b border-black/[0.04] overflow-hidden flex items-center justify-center p-6">
                  <Image
                    src={card.image}
                    alt={card.brand}
                    fill
                    className="object-contain p-4"
                  />
                  <div className="absolute top-4 right-4 bg-[#2A9DFF] text-white text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full">
                    NFT
                  </div>
                </div>

                {/* Card Info */}
                <div className="flex flex-col flex-1 p-6">
                  <div className="mb-4">
                    <h3 className="text-[20px] font-black text-black mb-2 font-bricolage">{card.brand}</h3>
                    <div className="flex items-center gap-2 text-[12px] text-[#666666] font-medium mb-4">
                      <span>{card.category}</span>
                      <span>•</span>
                      <span>{formatDate(card.expirationDate)}</span>
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="mb-4">
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-[28px] font-black text-black font-bricolage leading-none">
                        ${card.balance.toFixed(2)}
                      </span>
                      {card.balance < card.originalAmount && (
                        <span className="text-[14px] text-black/40 line-through font-medium">
                          ${card.originalAmount}
                        </span>
                      )}
                    </div>
                    {card.balance > 0 && (
                      <div className="w-full h-1.5 bg-black/[0.04] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#2A9DFF] transition-all"
                          style={{ width: `${(card.balance / card.originalAmount) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Token ID */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-[11px] text-[#666666] uppercase tracking-wider font-medium">Token ID:</span>
                    <button
                      onClick={() => copyToClipboard(card.tokenId, card.id)}
                      className="flex items-center gap-1 text-[11px] font-mono text-black hover:text-[#2A9DFF] transition-colors font-medium"
                    >
                      {copiedId === card.id ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>{card.tokenId}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 mt-auto">
                    <Link
                      href={`/gift-card/${card.brand.toLowerCase().replace(/\s+/g, '-')}`}
                      className="w-full h-10 bg-black text-white rounded-full font-black text-[12px] uppercase tracking-wider hover:bg-black/90 transition-colors flex items-center justify-center"
                    >
                      Redeem
                    </Link>
                    <div className="flex gap-2">
                      <button
                        className="flex-1 h-10 bg-white border border-black/[0.04] text-black rounded-full font-black text-[12px] uppercase tracking-wider hover:bg-black/5 transition-colors flex items-center justify-center gap-2"
                      >
                        <Send className="w-3 h-3" />
                        Transfer
                      </button>
                      <button
                        onClick={() => window.open(`https://blockstream.info/tx/${card.transactionHash}`, '_blank')}
                        className="h-10 w-10 bg-white border border-black/[0.04] text-black rounded-full hover:bg-black/5 transition-colors flex items-center justify-center"
                        title="View on Blockchain"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Footer Message */}
        {mockGiftCards.length > 0 && (
          <div className="mt-12 text-center">
            <p className="text-[12px] text-[#666666]">
              Powered by Bitcoin • Secured by Charms Protocol
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
