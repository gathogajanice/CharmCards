"use client";

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/sections/navbar';
import Footer from '@/components/sections/footer';
import { motion } from 'framer-motion';
import { Send, ExternalLink, Copy, Check, Wallet, Network, Bitcoin, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppKitAccount } from '@reown/appkit/react';
import { getWalletUtxos, getWalletBalance } from '@/lib/charms/wallet';
import { detectNetworkFromAddress } from '@/lib/charms/network';
import { useNetworkCheck } from '@/hooks/use-network-check';

export default function WalletPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const router = useRouter();
  const { address, isConnected } = useAppKitAccount();
  const { currentNetwork } = useNetworkCheck();

  // Fetch wallet balance - try wallet first, then UTXOs
  useEffect(() => {
    const fetchBalance = async () => {
      if (!address || !isConnected) {
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
          // Sum all UTXO values (in satoshis, convert to BTC)
          const totalSats = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
          const totalBTC = totalSats / 100000000; // Convert satoshis to BTC
          console.log('Balance from UTXOs:', totalBTC, 'BTC (', totalSats, 'sats)');
          setBalance(totalBTC);
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

  // Detect network from address
  const network = address ? detectNetworkFromAddress(address) : 'unknown';
  const networkDisplayName = network === 'testnet4' ? 'Bitcoin Testnet4' : 
                            network === 'mainnet' ? 'Bitcoin Mainnet' :
                            network === 'testnet' ? 'Bitcoin Testnet' : 'Unknown';

  const giftCards: any[] = []; // Empty array - will be populated from on-chain data
  const totalBalance = 0; // Will be calculated from actual gift cards
  const totalCards = 0;

  // Format balance to show up to 2 decimal places, removing trailing zeros
  const formatBalance = (bal: number | null): string => {
    if (bal === null || bal === undefined) return '0';
    // Round to 2 decimal places and remove trailing zeros
    const rounded = Math.round(bal * 100) / 100;
    return rounded.toFixed(2).replace(/\.?0+$/, '');
  };

  // Manual refresh balance function
  const refreshBalance = async () => {
    if (!address || !isConnected) return;
    
    setIsLoadingBalance(true);
    try {
      // First try to get balance directly from wallet (most accurate)
      let walletBalance = await getWalletBalance(address, null);
      
      if (walletBalance !== null && walletBalance !== undefined) {
        console.log('Refreshed balance from wallet:', walletBalance);
        setBalance(walletBalance);
      } else {
        // Fallback: calculate from UTXOs
        console.log('Wallet balance not available, calculating from UTXOs...');
        const utxos = await getWalletUtxos(address, null);
        const totalSats = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
        const totalBTC = totalSats / 100000000;
        console.log('Refreshed balance from UTXOs:', totalBTC, 'BTC');
        setBalance(totalBTC);
      }
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    } finally {
      setIsLoadingBalance(false);
    }
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
          <h1 className="text-[40px] sm:text-[48px] md:text-[56px] font-black leading-[0.95] tracking-[-0.02em] text-black mb-3 sm:mb-4 font-bricolage">
            Collection
          </h1>
          <p className="text-[13px] sm:text-[14px] text-black/50 leading-[1.5] max-w-xl font-medium">
            Your Bitcoin NFT gift cards. Secured on-chain and fully transferable.
          </p>
        </div>

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
                ) : balance !== null ? (
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

        {/* Gift Cards Grid */}
        {giftCards.length === 0 ? (
          <div className="text-center py-24">
            <Wallet className="w-12 h-12 text-black/10 mx-auto mb-4" />
            <p className="text-black/50 text-[14px] mb-1 font-medium">No gift cards yet</p>
            <p className="text-black/30 text-[12px] font-medium">Purchase gift cards to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {giftCards.map((card, index) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -2 }}
                transition={{ 
                  duration: 0.3, 
                  delay: index * 0.05,
                  hover: { duration: 0.15 }
                }}
                className="bg-white border border-black/5 rounded-2xl overflow-hidden hover:border-black/10 transition-all group"
              >
                {/* Brand Image */}
                <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-black/[0.01] to-transparent overflow-hidden">
                  <Image
                    src={card.image}
                    alt={card.brand}
                    fill
                    className="object-contain p-6 group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 right-3 bg-black text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                    NFT
                  </div>
                </div>

                {/* Card Info */}
                <div className="p-5">
                  <div className="mb-4">
                    <h3 className="text-[18px] font-black text-black mb-1.5 font-bricolage">{card.brand}</h3>
                    <div className="flex items-center gap-1.5 text-[11px] text-black/40 font-medium">
                      <span>{card.category}</span>
                      <span>•</span>
                      <span>{formatDate(card.expirationDate)}</span>
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
                    <Link
                      href={`/gift-card/${card.brand.toLowerCase().replace(/\s+/g, '-')}`}
                      className="w-full h-9 bg-black text-white rounded-lg font-black text-[11px] uppercase tracking-wider hover:bg-black/90 transition-colors flex items-center justify-center"
                    >
                      Redeem
                    </Link>
                    <div className="flex gap-2">
                      <button
                        className="flex-1 h-9 bg-white border border-black/10 text-black rounded-lg font-medium text-[11px] uppercase tracking-wider hover:bg-black/5 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Send className="w-3 h-3" />
                        Transfer
                      </button>
                      <button
                        onClick={() => window.open(`https://blockstream.info/tx/${card.transactionHash}`, '_blank')}
                        className="h-9 w-9 bg-white border border-black/10 text-black rounded-lg hover:bg-black/5 transition-colors flex items-center justify-center"
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

      </main>

      <Footer />
    </div>
  );
}
