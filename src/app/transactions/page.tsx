"use client";

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/sections/navbar';
import Footer from '@/components/sections/footer';
import { motion } from 'framer-motion';
import { ExternalLink, Copy, Check, ArrowLeft, Filter, Search, Calendar, Send, ShoppingBag, Trash2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { getMempoolTxUrl, getCharmsExplorerUrl, openInExplorer } from '@/lib/utils/explorer';
import { toast } from 'sonner';

interface Transaction {
  type: 'mint' | 'transfer' | 'redeem' | 'burn';
  brand?: string;
  commitTxid?: string;
  spellTxid?: string;
  transactionHash?: string;
  timestamp: number;
  amount?: number;
  recipientAddress?: string;
  status?: 'pending' | 'confirmed' | 'failed';
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'mint' | 'transfer' | 'redeem' | 'burn'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    // Load transaction history from localStorage
    try {
      const txHistory = JSON.parse(localStorage.getItem('charmCardsTxHistory') || '[]');
      setTransactions(txHistory.sort((a: Transaction, b: Transaction) => b.timestamp - a.timestamp));
    } catch (e) {
      console.error('Failed to load transaction history:', e);
    }
  }, []);

  const filteredTransactions = transactions.filter(tx => {
    if (filterType !== 'all' && tx.type !== filterType) return false;
    if (searchQuery && !tx.brand?.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !tx.commitTxid?.includes(searchQuery) && !tx.spellTxid?.includes(searchQuery)) {
      return false;
    }
    return true;
  });

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'mint': return Sparkles;
      case 'transfer': return Send;
      case 'redeem': return ShoppingBag;
      case 'burn': return Trash2;
      default: return Calendar;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'mint': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'transfer': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'redeem': return 'bg-green-100 text-green-700 border-green-200';
      case 'burn': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const copyTxId = (txid: string, id: string) => {
    navigator.clipboard.writeText(txid);
    setCopiedId(id);
    toast.success('Transaction ID copied!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <main className="container pt-24 sm:pt-28 md:pt-32 pb-16 max-w-7xl mx-auto px-6 sm:px-8">
        <nav className="flex items-center gap-2 text-[11px] sm:text-[12px] md:text-[13px] mb-8 sm:mb-10 md:mb-12 overflow-x-auto no-scrollbar whitespace-nowrap opacity-60">
          <Link href="/" className="hover:text-black transition-colors">Home</Link>
          <span>/</span>
          <Link href="/wallet" className="hover:text-black transition-colors">Collection</Link>
          <span>/</span>
          <span className="text-black font-semibold">Transaction History</span>
        </nav>

        {/* Header */}
        <div className="mb-10 sm:mb-12 md:mb-16">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/wallet"
              className="p-2 hover:bg-black/5 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-black/60" />
            </Link>
            <div>
              <h1 className="text-[40px] sm:text-[48px] md:text-[56px] font-black leading-[0.95] tracking-[-0.02em] text-black mb-3 sm:mb-4 font-bricolage">
                Transaction History
              </h1>
              <p className="text-[13px] sm:text-[14px] text-black/50 leading-[1.5] max-w-xl font-medium">
                View all your gift card transactions on Bitcoin blockchain. Track mints, transfers, redemptions, and burns.
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
            <input
              type="text"
              placeholder="Search by brand or transaction ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 bg-white border border-black/10 rounded-lg text-[13px] text-black placeholder:text-black/40 focus:outline-none focus:border-black/20"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40 pointer-events-none" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="h-10 pl-10 pr-8 bg-white border border-black/10 rounded-lg text-[13px] text-black focus:outline-none focus:border-black/20 appearance-none cursor-pointer"
            >
              <option value="all">All Transactions</option>
              <option value="mint">Mint</option>
              <option value="transfer">Transfer</option>
              <option value="redeem">Redeem</option>
              <option value="burn">Burn</option>
            </select>
          </div>
        </div>

        {/* Transactions List */}
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-24">
            <Calendar className="w-12 h-12 text-black/10 mx-auto mb-4" />
            <p className="text-black/50 text-[14px] mb-1 font-medium">
              {transactions.length === 0 ? 'No transactions yet' : 'No transactions match your filters'}
            </p>
            <p className="text-black/30 text-[12px] font-medium">
              {transactions.length === 0 ? 'Mint gift cards to see transaction history' : 'Try adjusting your search or filters'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map((tx, index) => {
              const Icon = getTransactionIcon(tx.type);
              const colorClass = getTransactionColor(tx.type);
              
              return (
                <motion.div
                  key={`${tx.commitTxid || tx.spellTxid || tx.transactionHash}-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-5 bg-white border border-black/5 rounded-xl hover:border-black/10 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-3 rounded-xl border ${colorClass}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`text-[12px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${colorClass}`}>
                            {tx.type}
                          </span>
                          {tx.brand && (
                            <span className="text-[15px] font-black text-black font-bricolage">
                              {tx.brand}
                            </span>
                          )}
                          {tx.amount && (
                            <span className="text-[14px] font-semibold text-black">
                              ${tx.amount.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-black/50 mb-3">
                          {new Date(tx.timestamp).toLocaleString()}
                        </p>
                        
                        {/* Transaction IDs */}
                        <div className="space-y-2">
                          {tx.commitTxid && (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-black/40 font-medium">Commit TX:</span>
                              <button
                                onClick={() => copyTxId(tx.commitTxid!, `commit-${index}`)}
                                className="text-[11px] font-mono text-[#2A9DFF] hover:underline flex items-center gap-1"
                              >
                                {tx.commitTxid.substring(0, 16)}...
                                {copiedId === `commit-${index}` ? (
                                  <Check className="w-3 h-3 text-green-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                              <button
                                onClick={() => openInExplorer(tx.commitTxid!, 'mempool')}
                                className="p-1 hover:bg-black/5 rounded transition-colors"
                                title="View on Mempool.space"
                              >
                                <ExternalLink className="w-3 h-3 text-black/60" />
                              </button>
                              <button
                                onClick={() => openInExplorer(tx.commitTxid!, 'charms')}
                                className="p-1 hover:bg-black/5 rounded transition-colors"
                                title="View on Charms Explorer"
                              >
                                <ExternalLink className="w-3 h-3 text-[#2A9DFF]" />
                              </button>
                            </div>
                          )}
                          {tx.spellTxid && (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-black/40 font-medium">Spell TX:</span>
                              <button
                                onClick={() => copyTxId(tx.spellTxid!, `spell-${index}`)}
                                className="text-[11px] font-mono text-[#2A9DFF] hover:underline flex items-center gap-1"
                              >
                                {tx.spellTxid.substring(0, 16)}...
                                {copiedId === `spell-${index}` ? (
                                  <Check className="w-3 h-3 text-green-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                              <button
                                onClick={() => openInExplorer(tx.spellTxid!, 'mempool')}
                                className="p-1 hover:bg-black/5 rounded transition-colors"
                                title="View on Mempool.space"
                              >
                                <ExternalLink className="w-3 h-3 text-black/60" />
                              </button>
                              <button
                                onClick={() => openInExplorer(tx.spellTxid!, 'charms')}
                                className="p-1 hover:bg-black/5 rounded transition-colors"
                                title="View on Charms Explorer"
                              >
                                <ExternalLink className="w-3 h-3 text-[#2A9DFF]" />
                              </button>
                            </div>
                          )}
                          {tx.transactionHash && !tx.commitTxid && !tx.spellTxid && (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-black/40 font-medium">TX:</span>
                              <button
                                onClick={() => copyTxId(tx.transactionHash!, `tx-${index}`)}
                                className="text-[11px] font-mono text-[#2A9DFF] hover:underline flex items-center gap-1"
                              >
                                {tx.transactionHash.substring(0, 16)}...
                                {copiedId === `tx-${index}` ? (
                                  <Check className="w-3 h-3 text-green-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                              <button
                                onClick={() => openInExplorer(tx.transactionHash!, 'mempool')}
                                className="p-1 hover:bg-black/5 rounded transition-colors"
                                title="View on Mempool.space"
                              >
                                <ExternalLink className="w-3 h-3 text-black/60" />
                              </button>
                            </div>
                          )}
                        </div>
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
    </div>
  );
}

