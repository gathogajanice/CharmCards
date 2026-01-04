"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ExternalLink, Wallet, Plus, X } from 'lucide-react';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface MintSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  brand: string;
  image: string;
  amount: number;
  commitTxid: string;
  spellTxid: string;
  onViewWallet: () => void;
  onMintAnother?: () => void;
}

export default function MintSuccessModal({
  isOpen,
  onClose,
  brand,
  image,
  amount,
  commitTxid,
  spellTxid,
  onViewWallet,
  onMintAnother,
}: MintSuccessModalProps) {
  const NETWORK = process.env.NEXT_PUBLIC_BITCOIN_NETWORK || 'testnet4';
  const explorerBase = NETWORK === 'testnet4' 
    ? 'https://memepool.space/testnet4/tx/'
    : 'https://memepool.space/tx/';
  const charmsExplorerBase = 'https://explorer.charms.dev';

  const copyTxid = (txid: string, type: 'commit' | 'spell') => {
    navigator.clipboard.writeText(txid);
    // toast will be handled by parent if needed
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-[24px] font-black font-bricolage text-center">
            🎉 Gift Card Minted!
          </DialogTitle>
          <DialogDescription className="text-[14px] text-black/60 text-center">
            Your {brand} gift card has been successfully minted on Bitcoin
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Success Animation */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="flex justify-center"
          >
            <div className="relative w-32 h-32 rounded-2xl overflow-hidden border-4 border-green-200 bg-white shadow-lg">
              <Image
                src={image}
                alt={brand}
                fill
                className="object-cover"
                unoptimized={image?.includes('wikimedia.org') || image?.includes('upload.wikimedia.org') || image?.includes('logos-world.net')}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=600&auto=format&fit=crop';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-green-500/20 to-transparent" />
              <div className="absolute top-2 right-2">
                <CheckCircle2 className="w-6 h-6 text-green-600 bg-white rounded-full" />
              </div>
            </div>
          </motion.div>

          {/* Card Details */}
          <div className="text-center space-y-2">
            <h3 className="text-[20px] font-black text-black font-bricolage">{brand}</h3>
            <p className="text-[32px] font-black text-[#2A9DFF] font-bricolage">${amount.toFixed(2)}</p>
            <p className="text-[12px] text-black/50">Bitcoin NFT Gift Card</p>
          </div>

          {/* Transaction Details */}
          <div className="p-4 bg-black/5 rounded-xl border border-black/10 space-y-3">
            <h4 className="text-[13px] font-semibold text-black mb-3">Transaction Details</h4>
            
            {commitTxid && (
              <div className="space-y-1">
                <p className="text-[11px] text-black/50 uppercase tracking-wider">Commit Transaction</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[11px] font-mono text-black/70 bg-white px-2 py-1 rounded border border-black/10 truncate">
                    {commitTxid.substring(0, 16)}...{commitTxid.substring(commitTxid.length - 8)}
                  </code>
                  <a
                    href={`${explorerBase}${commitTxid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 hover:bg-black/10 rounded transition-colors"
                    title="View on Mempool.space"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-black/60" />
                  </a>
                  <a
                    href={`${charmsExplorerBase}/tx/${commitTxid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 hover:bg-black/10 rounded transition-colors"
                    title="View on Charms Explorer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#2A9DFF]" />
                  </a>
                </div>
              </div>
            )}

            {spellTxid && (
              <div className="space-y-1">
                <p className="text-[11px] text-black/50 uppercase tracking-wider">Spell Transaction</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[11px] font-mono text-black/70 bg-white px-2 py-1 rounded border border-black/10 truncate">
                    {spellTxid.substring(0, 16)}...{spellTxid.substring(spellTxid.length - 8)}
                  </code>
                  <a
                    href={`${explorerBase}${spellTxid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 hover:bg-black/10 rounded transition-colors"
                    title="View on Mempool.space"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-black/60" />
                  </a>
                  <a
                    href={`${charmsExplorerBase}/tx/${spellTxid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 hover:bg-black/10 rounded transition-colors"
                    title="View on Charms Explorer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#2A9DFF]" />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            <Button
              onClick={onViewWallet}
              className="w-full h-12 bg-[#2A9DFF] text-white font-semibold rounded-full hover:bg-[#1A8DFF] transition-colors flex items-center justify-center gap-2"
            >
              <Wallet className="w-4 h-4" />
              View in Wallet
            </Button>
            
            {onMintAnother && (
              <Button
                onClick={onMintAnother}
                variant="outline"
                className="w-full h-12 border-2 border-black/10 text-black font-semibold rounded-full hover:bg-black/5 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Mint Another
              </Button>
            )}
            
            <Button
              onClick={onClose}
              variant="ghost"
              className="w-full h-10 text-black/60 hover:text-black hover:bg-black/5 transition-colors"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

