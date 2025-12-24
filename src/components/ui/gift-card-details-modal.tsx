"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { ExternalLink, Copy, Check, Send, Trash2, ShoppingBag, QrCode, Clock, Calendar, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { getMempoolTxUrl, getCharmsExplorerUrl, openInExplorer } from '@/lib/utils/explorer';
import * as QRCode from 'qrcode';

interface GiftCardDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  giftCard: {
    id: string;
    brand: string;
    image: string;
    balance: number;
    originalAmount: number;
    tokenId: string;
    expirationDate: string | null;
    createdAt: string | null;
    transactionHash?: string;
    commitTxid?: string;
    spellTxid?: string;
  };
  onTransfer?: () => void;
  onRedeem?: () => void;
  onBurn?: () => void;
}

export default function GiftCardDetailsModal({ 
  isOpen, 
  onClose, 
  giftCard,
  onTransfer,
  onRedeem,
  onBurn,
}: GiftCardDetailsModalProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Generate QR code
  useEffect(() => {
    if (isOpen && giftCard.tokenId) {
      const qrData = JSON.stringify({
        type: 'gift-card',
        tokenId: giftCard.tokenId,
        brand: giftCard.brand,
        balance: giftCard.balance,
      });
      
      QRCode.toDataURL(qrData, { width: 200, margin: 2 })
        .then(url => setQrCodeUrl(url))
        .catch(err => console.error('QR code generation failed:', err));
    }
  }, [isOpen, giftCard.tokenId, giftCard.brand, giftCard.balance]);

  const copyTokenId = () => {
    navigator.clipboard.writeText(giftCard.tokenId);
    setCopiedId(true);
    toast.success('Token ID copied!');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const isExpired = giftCard.expirationDate && new Date(giftCard.expirationDate) < new Date();
  const daysUntilExpiry = giftCard.expirationDate 
    ? Math.floor((new Date(giftCard.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[24px] font-black font-bricolage">
            {giftCard.brand} Gift Card Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Gift Card Image */}
          <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-gradient-to-br from-black/[0.01] to-transparent border border-black/10">
            <Image
              src={giftCard.image}
              alt={giftCard.brand}
              fill
              className="object-contain p-8"
            />
          </div>

          {/* Balance Info */}
          <div className="p-5 bg-black/5 rounded-xl border border-black/10">
            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-[36px] font-black text-black font-bricolage leading-none">
                ${giftCard.balance.toFixed(2)}
              </span>
              {giftCard.balance < giftCard.originalAmount && (
                <span className="text-[16px] text-black/30 line-through font-medium">
                  ${giftCard.originalAmount.toFixed(2)}
                </span>
              )}
            </div>
            {giftCard.balance > 0 && (
              <div className="w-full h-2 bg-black/5 rounded-full overflow-hidden mt-3">
                <div
                  className="h-full bg-black transition-all"
                  style={{ width: `${(giftCard.balance / giftCard.originalAmount) * 100}%` }}
                />
              </div>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-black/5 rounded-lg border border-black/10">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-black/60" />
                <span className="text-[11px] text-black/40 uppercase tracking-wider font-medium">Created</span>
              </div>
              <p className="text-[13px] font-semibold text-black">
                {giftCard.createdAt ? new Date(giftCard.createdAt).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div className={`p-4 rounded-lg border ${isExpired ? 'bg-red-50 border-red-200' : isExpiringSoon ? 'bg-yellow-50 border-yellow-200' : 'bg-black/5 border-black/10'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Clock className={`w-4 h-4 ${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-yellow-600' : 'text-black/60'}`} />
                <span className={`text-[11px] uppercase tracking-wider font-medium ${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-yellow-600' : 'text-black/40'}`}>
                  Expires
                </span>
              </div>
              <p className={`text-[13px] font-semibold ${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-yellow-600' : 'text-black'}`}>
                {giftCard.expirationDate 
                  ? (isExpired 
                      ? 'Expired' 
                      : daysUntilExpiry !== null 
                        ? `${daysUntilExpiry} days left`
                        : new Date(giftCard.expirationDate).toLocaleDateString())
                  : 'No expiration'}
              </p>
            </div>
          </div>

          {/* Token ID */}
          <div className="p-4 bg-black/5 rounded-lg border border-black/10">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] text-black/40 uppercase tracking-wider font-medium block mb-1">Token ID</span>
                <p className="text-[12px] font-mono text-black/60 truncate">{giftCard.tokenId}</p>
              </div>
              <button
                onClick={copyTokenId}
                className="p-2 hover:bg-black/10 rounded-lg transition-colors"
              >
                {copiedId ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 text-black/60" />
                )}
              </button>
            </div>
          </div>

          {/* Transaction Links */}
          {(giftCard.commitTxid || giftCard.spellTxid || giftCard.transactionHash) && (
            <div className="p-4 bg-black/5 rounded-lg border border-black/10">
              <span className="text-[11px] text-black/40 uppercase tracking-wider font-medium block mb-3">Transaction History</span>
              <div className="space-y-2">
                {giftCard.commitTxid && (
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-black/60">Commit TX:</span>
                    <div className="flex items-center gap-2">
                      <a
                        href={getMempoolTxUrl(giftCard.commitTxid)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-mono text-[#2A9DFF] hover:underline"
                      >
                        {giftCard.commitTxid.substring(0, 12)}...
                      </a>
                      <button
                        onClick={() => openInExplorer(giftCard.commitTxid!, 'mempool')}
                        className="p-1 hover:bg-black/10 rounded transition-colors"
                        title="View on Mempool"
                      >
                        <ExternalLink className="w-3 h-3 text-black/60" />
                      </button>
                      <button
                        onClick={() => openInExplorer(giftCard.commitTxid!, 'charms')}
                        className="p-1 hover:bg-black/10 rounded transition-colors"
                        title="View on Charms Explorer"
                      >
                        <ExternalLink className="w-3 h-3 text-[#2A9DFF]" />
                      </button>
                    </div>
                  </div>
                )}
                {giftCard.spellTxid && (
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-black/60">Spell TX:</span>
                    <div className="flex items-center gap-2">
                      <a
                        href={getMempoolTxUrl(giftCard.spellTxid)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-mono text-[#2A9DFF] hover:underline"
                      >
                        {giftCard.spellTxid.substring(0, 12)}...
                      </a>
                      <button
                        onClick={() => openInExplorer(giftCard.spellTxid!, 'mempool')}
                        className="p-1 hover:bg-black/10 rounded transition-colors"
                        title="View on Mempool"
                      >
                        <ExternalLink className="w-3 h-3 text-black/60" />
                      </button>
                      <button
                        onClick={() => openInExplorer(giftCard.spellTxid!, 'charms')}
                        className="p-1 hover:bg-black/10 rounded transition-colors"
                        title="View on Charms Explorer"
                      >
                        <ExternalLink className="w-3 h-3 text-[#2A9DFF]" />
                      </button>
                    </div>
                  </div>
                )}
                {giftCard.transactionHash && !giftCard.commitTxid && !giftCard.spellTxid && (
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-black/60">Transaction:</span>
                    <div className="flex items-center gap-2">
                      <a
                        href={getMempoolTxUrl(giftCard.transactionHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-mono text-[#2A9DFF] hover:underline"
                      >
                        {giftCard.transactionHash.substring(0, 12)}...
                      </a>
                      <button
                        onClick={() => openInExplorer(giftCard.transactionHash!, 'mempool')}
                        className="p-1 hover:bg-black/10 rounded transition-colors"
                        title="View on Mempool"
                      >
                        <ExternalLink className="w-3 h-3 text-black/60" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* QR Code */}
          {qrCodeUrl && (
            <div className="p-4 bg-black/5 rounded-lg border border-black/10 text-center">
              <span className="text-[11px] text-black/40 uppercase tracking-wider font-medium block mb-3">Share Gift Card</span>
              <div className="flex justify-center mb-3">
                <img src={qrCodeUrl} alt="Gift Card QR Code" className="w-32 h-32 rounded-lg border border-black/10 bg-white p-2" />
              </div>
              <p className="text-[11px] text-black/50">Scan to view gift card details</p>
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-black/10">
            {onRedeem && giftCard.balance > 0 && (
              <Button
                onClick={onRedeem}
                className="bg-[#2A9DFF] text-white hover:bg-[#1A8DFF]"
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                Redeem
              </Button>
            )}
            {onTransfer && (
              <Button
                onClick={onTransfer}
                variant="outline"
              >
                <Send className="w-4 h-4 mr-2" />
                Transfer
              </Button>
            )}
            {onBurn && (
              <Button
                onClick={onBurn}
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50 col-span-2"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Burn Forever
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

