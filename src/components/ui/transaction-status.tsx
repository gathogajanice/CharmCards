"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, AlertCircle, ExternalLink, Bitcoin } from 'lucide-react';

export type TransactionStatus = 'idle' | 'creating-spell' | 'generating-proof' | 'signing' | 'broadcasting' | 'confirming' | 'success' | 'error';

interface TransactionStatusProps {
  status: TransactionStatus;
  commitTxid?: string;
  spellTxid?: string;
  confirmations?: number;
  error?: string;
}

export default function TransactionStatus({ 
  status, 
  commitTxid, 
  spellTxid, 
  confirmations = 0,
  error 
}: TransactionStatusProps) {
  const steps = [
    { id: 'creating-spell', label: 'Creating Spell', description: 'Preparing your gift card NFT' },
    { id: 'generating-proof', label: 'Generating Proof', description: 'Creating zero-knowledge proof' },
    { id: 'signing', label: 'Signing Transactions', description: 'Authorizing with your wallet' },
    { id: 'broadcasting', label: 'Broadcasting', description: 'Sending to Bitcoin network' },
    { id: 'confirming', label: 'Confirming', description: 'Waiting for network confirmation' },
  ];

  const getStatusIcon = (stepId: string) => {
    const currentIndex = steps.findIndex(s => s.id === status);
    const stepIndex = steps.findIndex(s => s.id === stepId);
    
    if (stepIndex < currentIndex || status === 'success') {
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    }
    if (stepIndex === currentIndex) {
      return <Loader2 className="w-5 h-5 text-[#2A9DFF] animate-spin" />;
    }
    return <div className="w-5 h-5 rounded-full border-2 border-black/10" />;
  };

  const NETWORK = process.env.NEXT_PUBLIC_BITCOIN_NETWORK || 'testnet4';
  const explorerBase = NETWORK === 'testnet4' 
    ? 'https://memepool.space/testnet4/tx/'
    : 'https://memepool.space/tx/';
  const charmsExplorerBase = 'https://explorer.charms.dev';

  return (
    <div className="w-full bg-white border border-black/5 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-[#2A9DFF]/10 flex items-center justify-center">
          <Bitcoin className="w-5 h-5 text-[#2A9DFF]" />
        </div>
        <div>
          <h3 className="text-[16px] font-black text-black font-bricolage">Transaction Status</h3>
          <p className="text-[12px] text-black/50">Powered by Charms Protocol</p>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {steps.map((step, index) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center gap-3"
          >
            {getStatusIcon(step.id)}
            <div className="flex-1">
              <p className={`text-[13px] font-semibold ${
                steps.findIndex(s => s.id === status) >= index || status === 'success'
                  ? 'text-black' 
                  : 'text-black/40'
              }`}>
                {step.label}
              </p>
              <p className="text-[11px] text-black/50">{step.description}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {status === 'success' && (commitTxid || spellTxid) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-green-50 border border-green-200 rounded-xl"
          >
            <div className="flex items-start gap-3 mb-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-green-900 mb-2">
                  Gift Card Minted Successfully!
                </p>
                <p className="text-[12px] text-green-700 mb-3">
                  Your Bitcoin NFT gift card is now on-chain. View it in your collection.
                </p>
                {confirmations > 0 && (
                  <p className="text-[11px] text-green-600 mb-3">
                    Confirmations: {confirmations}
                  </p>
                )}
                <div className="space-y-2">
                  {commitTxid && (
                    <div className="flex items-center gap-2">
                      <a
                        href={`${explorerBase}${commitTxid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-[11px] text-green-700 hover:text-green-900 font-medium"
                        title="View on Mempool.space"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="font-mono">Commit TX: {commitTxid.substring(0, 16)}...</span>
                      </a>
                      <a
                        href={`${charmsExplorerBase}/tx/${commitTxid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#2A9DFF] hover:text-[#1A8DFF] transition-colors"
                        title="View on Charms Explorer"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  {spellTxid && (
                    <div className="flex items-center gap-2">
                      <a
                        href={`${explorerBase}${spellTxid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-[11px] text-green-700 hover:text-green-900 font-medium"
                        title="View on Mempool.space"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="font-mono">Spell TX: {spellTxid.substring(0, 16)}...</span>
                      </a>
                      <a
                        href={`${charmsExplorerBase}/tx/${spellTxid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#2A9DFF] hover:text-[#1A8DFF] transition-colors"
                        title="View on Charms Explorer"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {status === 'error' && error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-50 border border-red-200 rounded-xl"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] font-semibold text-red-900 mb-1">Transaction Failed</p>
                <p className="text-[12px] text-red-700">{error}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

