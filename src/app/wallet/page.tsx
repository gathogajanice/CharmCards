"use client";

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/sections/navbar';
import Footer from '@/components/sections/footer';
import { motion } from 'framer-motion';
import { Send, ExternalLink, Copy, Check, Wallet, Network, Bitcoin, RefreshCw, Trash2, Search, Filter, SortAsc, AlertTriangle, QrCode, BarChart3, CheckSquare, Square, Calendar } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppKitAccount } from '@reown/appkit/react';
import { getWalletUtxos, getWalletBalance } from '@/lib/charms/wallet';
import { detectNetworkFromAddress } from '@/lib/charms/network';
import { useNetworkCheck } from '@/hooks/use-network-check';
import type { GiftCardNftMetadata } from '@/lib/charms/types';
import { toast } from 'sonner';
import { useWalletBalance, useWalletCharms, useRefreshWalletData } from '@/hooks/use-wallet-data';
import TransferGiftCardModal from '@/components/ui/transfer-gift-card-modal';
import BurnGiftCardModal from '@/components/ui/burn-gift-card-modal';
import RedeemGiftCardModal from '@/components/ui/redeem-gift-card-modal';
import GiftCardDetailsModal from '@/components/ui/gift-card-details-modal';
import PartialTransferModal from '@/components/ui/partial-transfer-modal';

export default function WalletPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedCardForTransfer, setSelectedCardForTransfer] = useState<any | null>(null);
  const [burnModalOpen, setBurnModalOpen] = useState(false);
  const [selectedCardForBurn, setSelectedCardForBurn] = useState<any | null>(null);
  const [redeemModalOpen, setRedeemModalOpen] = useState(false);
  const [selectedCardForRedeem, setSelectedCardForRedeem] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'balance' | 'date' | 'brand' | 'expiration'>('date');
  const [filterBy, setFilterBy] = useState<'all' | 'active' | 'expired' | 'low-balance'>('all');
  const [showStats, setShowStats] = useState(true);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedCardForDetails, setSelectedCardForDetails] = useState<any | null>(null);
  const [partialTransferModalOpen, setPartialTransferModalOpen] = useState(false);
  const [selectedCardForPartialTransfer, setSelectedCardForPartialTransfer] = useState<any | null>(null);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const router = useRouter();
  const { address, isConnected } = useAppKitAccount();
  const { currentNetwork } = useNetworkCheck();

  // Use React Query hooks for optimized data fetching
  const { data: balance, isLoading: isLoadingBalance } = useWalletBalance(address, isConnected);
  const { data: walletCharms, isLoading: isLoadingCards } = useWalletCharms(address, isConnected);
  const { refreshAll } = useRefreshWalletData();

  // Listen for refresh events from modals
  useEffect(() => {
    const handleRefresh = () => {
      refreshAll(address);
    };
    
    window.addEventListener('refreshWalletData', handleRefresh);
    return () => {
      window.removeEventListener('refreshWalletData', handleRefresh);
    };
  }, [address, refreshAll]);

  // Convert wallet Charms to gift cards format
  const giftCards = walletCharms?.nfts
    .filter(nft => nft.data) // Only NFTs with gift card data
    .map((nft, index) => {
      const data = nft.data as GiftCardNftMetadata;
      return {
        id: `${nft.app_id}-${index}`,
        brand: data.brand,
        image: data.image,
        balance: data.remaining_balance / 100, // Convert cents to dollars
        originalAmount: data.initial_amount / 100,
        expirationDate: data.expiration_date ? new Date(data.expiration_date * 1000).toISOString() : null,
        createdAt: data.created_at ? new Date(data.created_at * 1000).toISOString() : null,
        tokenId: nft.app_id,
        transactionHash: '', // Will need to fetch from transaction data
        category: '', // Can be extracted from brand or metadata if available
      };
    }) || [];

  // Detect network from address
  const network = address ? detectNetworkFromAddress(address) : 'unknown';
  const networkDisplayName = network === 'testnet4' ? 'Bitcoin Testnet4' : 
                            network === 'mainnet' ? 'Bitcoin Mainnet' :
                            network === 'testnet' ? 'Bitcoin Testnet' : 'Unknown';

  // Filter and sort gift cards
  const filteredCards = giftCards.filter(card => {
    // Search filter
    if (searchQuery && !card.brand.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Status filter
    if (filterBy === 'expired') {
      if (!card.expirationDate) return false;
      return new Date(card.expirationDate) < new Date();
    }
    if (filterBy === 'active') {
      if (!card.expirationDate) return true;
      return new Date(card.expirationDate) >= new Date() && card.balance > 0;
    }
    if (filterBy === 'low-balance') {
      return card.balance < card.originalAmount * 0.1; // Less than 10% remaining
    }
    
    return true;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'balance':
        return b.balance - a.balance;
      case 'brand':
        return a.brand.localeCompare(b.brand);
      case 'expiration':
        if (!a.expirationDate && !b.expirationDate) return 0;
        if (!a.expirationDate) return 1;
        if (!b.expirationDate) return -1;
        return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
      case 'date':
      default:
        if (!a.createdAt && !b.createdAt) return 0;
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  // Calculate totals from filtered gift cards
  const totalBalance = filteredCards.reduce((sum, card) => sum + card.balance, 0);
  const totalCards = filteredCards.length;
  const totalOriginalValue = filteredCards.reduce((sum, card) => sum + card.originalAmount, 0);
  const expiredCards = filteredCards.filter(card => {
    if (!card.expirationDate) return false;
    return new Date(card.expirationDate) < new Date();
  }).length;
  const expiringSoon = filteredCards.filter(card => {
    if (!card.expirationDate) return false;
    const daysUntilExpiry = (new Date(card.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  }).length;

  // Format balance to show up to 2 decimal places, removing trailing zeros
  const formatBalance = (bal: number | null): string => {
    if (bal === null || bal === undefined) return '0';
    // Round to 2 decimal places and remove trailing zeros
    const rounded = Math.round(bal * 100) / 100;
    return rounded.toFixed(2).replace(/\.?0+$/, '');
  };

  // Manual refresh function using React Query
  const refreshBalance = () => {
    refreshAll(address);
  };

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
      
      <main className="container pt-24 sm:pt-28 md:pt-32 pb-16 max-w-7xl mx-auto px-6 sm:px-8">
        <nav className="flex items-center gap-2 text-[11px] sm:text-[12px] md:text-[13px] mb-8 sm:mb-10 md:mb-12 overflow-x-auto no-scrollbar whitespace-nowrap opacity-60">
          <Link href="/" className="hover:text-black transition-colors">Home</Link>
          <span>/</span>
          <span className="text-black font-semibold">Collection</span>
        </nav>

        {/* Header */}
        <div className="mb-10 sm:mb-12 md:mb-16">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[40px] sm:text-[48px] md:text-[56px] font-black leading-[0.95] tracking-[-0.02em] text-black mb-3 sm:mb-4 font-bricolage">
                Collection
              </h1>
              <p className="text-[13px] sm:text-[14px] text-black/50 leading-[1.5] max-w-xl font-medium">
                Your Bitcoin NFT gift cards. Secured on-chain and fully transferable.
              </p>
            </div>
            <Link
              href="/transactions"
              className="px-4 py-2 bg-black/5 hover:bg-black/10 border border-black/10 rounded-lg text-[12px] font-semibold text-black transition-colors flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              View History
            </Link>
          </div>
        </div>

        {/* Collection Statistics */}
        {showStats && giftCards.length > 0 && (
          <div className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-black/5 rounded-xl border border-black/10">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-black/60" />
                <span className="text-[11px] text-black/40 uppercase tracking-wider font-medium">Total Value</span>
              </div>
              <p className="text-[20px] font-black text-black font-bricolage">
                ${totalBalance.toFixed(2)}
              </p>
              <p className="text-[10px] text-black/40 mt-1">of ${totalOriginalValue.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-black/5 rounded-xl border border-black/10">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-black/60" />
                <span className="text-[11px] text-black/40 uppercase tracking-wider font-medium">Cards</span>
              </div>
              <p className="text-[20px] font-black text-black font-bricolage">
                {totalCards}
              </p>
              <p className="text-[10px] text-black/40 mt-1">gift cards</p>
            </div>
            {expiredCards > 0 && (
              <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-[11px] text-red-600 uppercase tracking-wider font-medium">Expired</span>
                </div>
                <p className="text-[20px] font-black text-red-600 font-bricolage">
                  {expiredCards}
                </p>
                <p className="text-[10px] text-red-500 mt-1">cards expired</p>
              </div>
            )}
            {expiringSoon > 0 && (
              <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <span className="text-[11px] text-yellow-600 uppercase tracking-wider font-medium">Expiring</span>
                </div>
                <p className="text-[20px] font-black text-yellow-600 font-bricolage">
                  {expiringSoon}
                </p>
                <p className="text-[10px] text-yellow-600 mt-1">within 30 days</p>
              </div>
            )}
          </div>
        )}

        {/* Wallet Info - Network and Balance */}
        {isConnected && address && (
          <div className="mb-8 p-6 bg-black/5 rounded-2xl border border-black/10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Network className="w-4 h-4 text-black/60" />
                  <span className="text-[11px] text-black/40 uppercase tracking-wider font-medium">Network</span>
                </div>
                <p className="text-[18px] font-black text-black font-bricolage">
                  {networkDisplayName}
                  {network === 'testnet4' && (
                    <span className="ml-2 text-[12px] text-black/50 font-normal">(Bitcoin Testnet4 Beta in Unisat)</span>
                  )}
                </p>
                {address && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] text-black/40 font-mono">{address.slice(0, 8)}...{address.slice(-6)}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(address);
                        setCopiedId('address');
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      className="text-black/40 hover:text-black transition-colors"
                    >
                      {copiedId === 'address' ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-2 mb-2">
                  <Bitcoin className="w-4 h-4 text-black/60" />
                  <span className="text-[11px] text-black/40 uppercase tracking-wider font-medium">Balance</span>
                  <button
                    onClick={refreshBalance}
                    disabled={isLoadingBalance}
                    className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors disabled:opacity-50"
                    title="Refresh balance"
                  >
                    <RefreshCw className={`w-3 h-3 text-black/60 ${isLoadingBalance ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                {isLoadingBalance ? (
                  <p className="text-[18px] font-black text-black font-bricolage">Loading...</p>
                ) : balance !== null && balance !== undefined ? (
                  <p className="text-[18px] font-black text-black font-bricolage">
                    {formatBalance(balance)} BTC
                  </p>
                ) : (
                  <p className="text-[18px] font-black text-black/40 font-bricolage">—</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Batch Operations Bar */}
        {selectedCards.size > 0 && (
          <div className="mb-4 p-4 bg-[#2A9DFF]/10 border border-[#2A9DFF]/20 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-semibold text-black">
                  {selectedCards.size} card{selectedCards.size > 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    // Batch transfer - would need to implement
                    toast.info('Batch transfer coming soon');
                  }}
                  className="px-4 py-2 bg-[#2A9DFF] text-white rounded-lg text-[12px] font-semibold hover:bg-[#1A8DFF] transition-colors"
                >
                  Transfer Selected
                </button>
                <button
                  onClick={() => {
                    // Batch burn - would need to implement
                    toast.info('Batch burn coming soon');
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-[12px] font-semibold hover:bg-red-700 transition-colors"
                >
                  Burn Selected
                </button>
                <button
                  onClick={() => setSelectedCards(new Set())}
                  className="px-4 py-2 bg-white border border-black/10 text-black rounded-lg text-[12px] font-semibold hover:bg-black/5 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search, Filter, and Sort Controls */}
        {giftCards.length > 0 && (
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
              <input
                type="text"
                placeholder="Search by brand..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-white border border-black/10 rounded-lg text-[13px] text-black placeholder:text-black/40 focus:outline-none focus:border-black/20"
              />
            </div>
            
            {/* Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40 pointer-events-none" />
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as any)}
                className="h-10 pl-10 pr-8 bg-white border border-black/10 rounded-lg text-[13px] text-black focus:outline-none focus:border-black/20 appearance-none cursor-pointer"
              >
                <option value="all">All Cards</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="low-balance">Low Balance</option>
              </select>
            </div>
            
            {/* Sort */}
            <div className="relative">
              <SortAsc className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-10 pl-10 pr-8 bg-white border border-black/10 rounded-lg text-[13px] text-black focus:outline-none focus:border-black/20 appearance-none cursor-pointer"
              >
                <option value="date">Newest First</option>
                <option value="balance">Balance (High)</option>
                <option value="brand">Brand (A-Z)</option>
                <option value="expiration">Expiring Soon</option>
              </select>
            </div>
          </div>
        )}

        {/* Gift Cards Grid */}
        {isLoadingCards ? (
          <div className="text-center py-24">
            <RefreshCw className="w-12 h-12 text-black/10 mx-auto mb-4 animate-spin" />
            <p className="text-black/50 text-[14px] mb-1 font-medium">Loading your gift cards...</p>
          </div>
        ) : giftCards.length === 0 ? (
          <div className="text-center py-24">
            <Wallet className="w-12 h-12 text-black/10 mx-auto mb-4" />
            <p className="text-black/50 text-[14px] mb-1 font-medium">No gift cards yet</p>
            <p className="text-black/30 text-[12px] font-medium">Mint gift cards to get started</p>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="text-center py-24">
            <Search className="w-12 h-12 text-black/10 mx-auto mb-4" />
            <p className="text-black/50 text-[14px] mb-1 font-medium">No cards match your filters</p>
            <p className="text-black/30 text-[12px] font-medium">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredCards.map((card, index) => {
              // Check expiration status
              const isExpired = card.expirationDate && new Date(card.expirationDate) < new Date();
              const daysUntilExpiry = card.expirationDate 
                ? Math.floor((new Date(card.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null;
              const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0;
              const isSelected = selectedCards.has(card.id);
              
              return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -2 }}
                transition={{ 
                  duration: 0.3, 
                  delay: index * 0.05
                }}
                className={`bg-white border rounded-2xl overflow-hidden transition-all group cursor-pointer ${
                  isSelected ? 'border-[#2A9DFF] border-2 shadow-lg' : 'border-black/5 hover:border-black/10'
                }`}
                onClick={(e) => {
                  // Toggle selection on checkbox click, open details otherwise
                  const target = e.target as HTMLElement;
                  if (target.closest('.batch-checkbox')) {
                    const newSelected = new Set(selectedCards);
                    if (isSelected) {
                      newSelected.delete(card.id);
                    } else {
                      newSelected.add(card.id);
                    }
                    setSelectedCards(newSelected);
                  } else {
                    setSelectedCardForDetails({
                      ...card,
                      nftMetadata: {
                        brand: card.brand,
                        image: card.image,
                        initial_amount: Math.floor(card.originalAmount * 100),
                        remaining_balance: Math.floor(card.balance * 100),
                        expiration_date: card.expirationDate ? Math.floor(new Date(card.expirationDate).getTime() / 1000) : undefined,
                        created_at: card.createdAt ? Math.floor(new Date(card.createdAt).getTime() / 1000) : undefined,
                      },
                    });
                    setDetailsModalOpen(true);
                  }
                }}
              >
                {/* Brand Image */}
                <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-black/[0.01] to-transparent overflow-hidden">
                  {/* Batch Selection Checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newSelected = new Set(selectedCards);
                      if (isSelected) {
                        newSelected.delete(card.id);
                      } else {
                        newSelected.add(card.id);
                      }
                      setSelectedCards(newSelected);
                    }}
                    className="absolute top-3 left-3 z-20 p-1.5 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white transition-colors batch-checkbox"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-[#2A9DFF]" />
                    ) : (
                      <Square className="w-4 h-4 text-black/40" />
                    )}
                  </button>
                  <Image
                    src={card.image}
                    alt={card.brand}
                    fill
                    className="object-contain p-6 group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 right-3 flex flex-col gap-1.5">
                    <div className="bg-black text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                      NFT
                    </div>
                    {isExpired && (
                      <div className="bg-red-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                        Expired
                      </div>
                    )}
                    {isExpiringSoon && !isExpired && (
                      <div className="bg-yellow-500 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                        Expiring Soon
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Info */}
                <div className="p-5">
                  <div className="mb-4">
                    <h3 className="text-[18px] font-black text-black mb-1.5 font-bricolage">{card.brand}</h3>
                    <div className="flex items-center gap-1.5 text-[11px] text-black/40 font-medium">
                      {card.category && <><span>{card.category}</span><span>•</span></>}
                      <span className={isExpired ? 'text-red-600 font-semibold' : isExpiringSoon ? 'text-yellow-600 font-semibold' : ''}>
                        {formatDate(card.expirationDate)}
                      </span>
                      {daysUntilExpiry !== null && daysUntilExpiry > 0 && !isExpired && (
                        <>
                          <span>•</span>
                          <span className={isExpiringSoon ? 'text-yellow-600 font-semibold' : ''}>
                            {daysUntilExpiry}d left
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="mb-4">
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-[26px] font-black text-black font-bricolage leading-none">
                        ${card.balance.toFixed(2)}
                      </span>
                      {card.balance < card.originalAmount && (
                        <span className="text-[13px] text-black/30 line-through font-medium">
                          ${card.originalAmount}
                        </span>
                      )}
                    </div>
                    {card.balance > 0 && (
                      <div className="w-full h-1 bg-black/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-black transition-all"
                          style={{ width: `${(card.balance / card.originalAmount) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Token ID */}
                  <div className="flex items-center gap-2 mb-4 pb-4 border-b border-black/5">
                    <span className="text-[10px] text-black/40 uppercase tracking-wider font-medium">Token:</span>
                    <button
                      onClick={() => copyToClipboard(card.tokenId, card.id)}
                      className="flex items-center gap-1 text-[10px] font-mono text-black/60 hover:text-black transition-colors"
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
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCardForRedeem({
                          ...card,
                          nftMetadata: {
                            brand: card.brand,
                            image: card.image,
                            initial_amount: Math.floor(card.originalAmount * 100),
                            remaining_balance: Math.floor(card.balance * 100),
                            expiration_date: card.expirationDate ? Math.floor(new Date(card.expirationDate).getTime() / 1000) : undefined,
                            created_at: card.createdAt ? Math.floor(new Date(card.createdAt).getTime() / 1000) : undefined,
                          },
                        });
                        setRedeemModalOpen(true);
                      }}
                      disabled={card.balance <= 0}
                      className="w-full h-9 bg-black text-white rounded-lg font-black text-[11px] uppercase tracking-wider hover:bg-black/90 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Redeem
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCardForTransfer({
                            ...card,
                            nftMetadata: {
                              brand: card.brand,
                              image: card.image,
                              initial_amount: Math.floor(card.originalAmount * 100),
                              remaining_balance: Math.floor(card.balance * 100),
                              expiration_date: card.expirationDate ? Math.floor(new Date(card.expirationDate).getTime() / 1000) : undefined,
                              created_at: card.createdAt ? Math.floor(new Date(card.createdAt).getTime() / 1000) : undefined,
                            },
                          });
                          setTransferModalOpen(true);
                        }}
                        className="flex-1 h-9 bg-white border border-black/10 text-black rounded-lg font-medium text-[11px] uppercase tracking-wider hover:bg-black/5 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Send className="w-3 h-3" />
                        Transfer
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCardForPartialTransfer({
                            ...card,
                            nftMetadata: {
                              brand: card.brand,
                              image: card.image,
                              initial_amount: Math.floor(card.originalAmount * 100),
                              remaining_balance: Math.floor(card.balance * 100),
                              expiration_date: card.expirationDate ? Math.floor(new Date(card.expirationDate).getTime() / 1000) : undefined,
                              created_at: card.createdAt ? Math.floor(new Date(card.createdAt).getTime() / 1000) : undefined,
                            },
                          });
                          setPartialTransferModalOpen(true);
                        }}
                        className="h-9 w-9 bg-white border border-black/10 text-black rounded-lg hover:bg-black/5 transition-colors flex items-center justify-center"
                        title="Partial Transfer"
                        disabled={card.balance <= 0}
                      >
                        <Send className="w-3 h-3 rotate-45" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCardForBurn({
                            ...card,
                            nftMetadata: {
                              brand: card.brand,
                              image: card.image,
                              initial_amount: Math.floor(card.originalAmount * 100),
                              remaining_balance: Math.floor(card.balance * 100),
                              expiration_date: card.expirationDate ? Math.floor(new Date(card.expirationDate).getTime() / 1000) : undefined,
                              created_at: card.createdAt ? Math.floor(new Date(card.createdAt).getTime() / 1000) : undefined,
                            },
                          });
                          setBurnModalOpen(true);
                        }}
                        className="h-9 w-9 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center"
                        title="Delete (Burn Forever)"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (card.transactionHash) {
                            window.open(`https://mempool.space/testnet4/tx/${card.transactionHash}`, '_blank');
                          } else {
                            toast.info('Transaction hash not available');
                          }
                        }}
                        className="h-9 w-9 bg-white border border-black/10 text-black rounded-lg hover:bg-black/5 transition-colors flex items-center justify-center"
                        title="View on Blockchain"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
            })}
          </div>
        )}

      </main>

      <Footer />

      {/* Transfer Modal */}
      {selectedCardForTransfer && (
        <TransferGiftCardModal
          isOpen={transferModalOpen}
          onClose={() => {
            setTransferModalOpen(false);
            setSelectedCardForTransfer(null);
          }}
          giftCard={selectedCardForTransfer}
        />
      )}

      {/* Burn Modal */}
      {selectedCardForBurn && (
        <BurnGiftCardModal
          isOpen={burnModalOpen}
          onClose={() => {
            setBurnModalOpen(false);
            setSelectedCardForBurn(null);
          }}
          giftCard={selectedCardForBurn}
        />
      )}

      {/* Redeem Modal */}
      {selectedCardForRedeem && (
        <RedeemGiftCardModal
          isOpen={redeemModalOpen}
          onClose={() => {
            setRedeemModalOpen(false);
            setSelectedCardForRedeem(null);
          }}
          giftCard={selectedCardForRedeem}
        />
      )}

      {/* Details Modal */}
      {selectedCardForDetails && (
        <GiftCardDetailsModal
          isOpen={detailsModalOpen}
          onClose={() => {
            setDetailsModalOpen(false);
            setSelectedCardForDetails(null);
          }}
          giftCard={selectedCardForDetails}
          onTransfer={() => {
            setDetailsModalOpen(false);
            setSelectedCardForTransfer(selectedCardForDetails);
            setTransferModalOpen(true);
          }}
          onRedeem={() => {
            setDetailsModalOpen(false);
            setSelectedCardForRedeem(selectedCardForDetails);
            setRedeemModalOpen(true);
          }}
          onBurn={() => {
            setDetailsModalOpen(false);
            setSelectedCardForBurn(selectedCardForDetails);
            setBurnModalOpen(true);
          }}
        />
      )}

      {/* Partial Transfer Modal */}
      {selectedCardForPartialTransfer && (
        <PartialTransferModal
          isOpen={partialTransferModalOpen}
          onClose={() => {
            setPartialTransferModalOpen(false);
            setSelectedCardForPartialTransfer(null);
          }}
          giftCard={selectedCardForPartialTransfer}
        />
      )}
    </div>
  );
}
