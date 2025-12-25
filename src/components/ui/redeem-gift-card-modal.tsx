"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShoppingBag, Loader, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { useAppKitAccount } from '@reown/appkit/react';
import { getWalletUtxos, signSpellTransactions, broadcastSpellTransactions } from '@/lib/charms/wallet';
import TransactionStatus, { TransactionStatus as TxStatus } from '@/components/ui/transaction-status';
import type { GiftCardNftMetadata } from '@/lib/charms/types';
import { useTransactionPolling } from '@/hooks/use-wallet-data';

interface RedeemGiftCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  giftCard: {
    id: string;
    brand: string;
    image: string;
    balance: number;
    originalAmount: number;
    tokenId: string;
    nftMetadata: GiftCardNftMetadata;
    utxoId?: string;
  };
}

export default function RedeemGiftCardModal({ isOpen, onClose, giftCard }: RedeemGiftCardModalProps) {
  const [redeemAmount, setRedeemAmount] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [commitTxid, setCommitTxid] = useState<string | undefined>();
  const [spellTxid, setSpellTxid] = useState<string | undefined>();
  const [txError, setTxError] = useState<string | undefined>();
  const { address } = useAppKitAccount();

  // Poll for transaction confirmation
  useTransactionPolling(commitTxid, spellTxid, () => {
    // Transaction confirmed - refresh wallet data
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('refreshWalletData'));
    }
  });

  const maxAmount = giftCard.balance;
  const redeemAmountNum = parseFloat(redeemAmount) || 0;
  const remainingBalance = maxAmount - redeemAmountNum;

  const handleRedeem = async () => {
    if (!redeemAmount || redeemAmountNum <= 0) {
      toast.error('Please enter a valid redemption amount');
      return;
    }

    if (redeemAmountNum > maxAmount) {
      toast.error(`Cannot redeem more than available balance ($${maxAmount.toFixed(2)})`);
      return;
    }

    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }

    setIsRedeeming(true);
    setTxStatus('creating-spell');
    setTxError(undefined);
    setCommitTxid(undefined);
    setSpellTxid(undefined);

    try {
      // Get UTXO containing this NFT
      const utxos = await getWalletUtxos(address, null);
      if (utxos.length === 0) {
        throw new Error('No UTXOs available');
      }

      // Create redeem spell - decreases balance while keeping NFT
      // Based on redeem-balance.yaml spell template
      // Spell JSON format per: https://docs.charms.dev/references/spell-json/
      const redeemSpell = {
        version: 8, // Protocol version (8 is current Charms protocol version)
        apps: {
          // App identifiers: NFT app ($00) and Token app ($01)
          // Format: "app_type/app_id/app_vk" per Charms Spell JSON reference
          "$00": `n/${giftCard.tokenId}/${giftCard.tokenId}`, // NFT app
          "$01": `t/${giftCard.tokenId}/${giftCard.tokenId}`, // Token app
        },
        // Input UTXOs containing charms (per Spell JSON reference)
        ins: [
          {
            utxo_id: giftCard.utxoId || `${utxos[0].txid}:${utxos[0].vout}`, // Format: "txid:vout"
            charms: {
              "$00": giftCard.nftMetadata, // NFT metadata
              "$01": Math.floor(giftCard.balance * 100), // Current token balance in cents
            },
          },
        ],
        // Output destinations for charms (per Spell JSON reference)
        outs: [
          {
            address: address, // Keep NFT in same wallet (Taproot address)
            charms: {
              "$00": {
                // NFT with updated remaining balance
                ...giftCard.nftMetadata,
                remaining_balance: Math.floor(remainingBalance * 100), // Updated balance in cents
              },
              "$01": Math.floor(remainingBalance * 100), // Remaining token balance in cents
            },
            sats: 1000, // Required: Bitcoin output value in satoshis
          },
        ],
      };

      // Call API to generate proof
      setTxStatus('generating-proof');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_URL}/api/gift-cards/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spell: redeemSpell,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate redemption proof');
      }

      const { proof } = await response.json();

      if (proof.commit_tx && proof.spell_tx) {
        setTxStatus('signing');
        toast.info('Please approve the redemption transaction in your wallet...');

        const utxo = utxos[0];
        toast.info('🔄 Please approve the transaction in your wallet popup...');
        const { commitTx: signedCommitTx, spellTx: signedSpellTx } = await signSpellTransactions(
          proof.commit_tx,
          proof.spell_tx,
          {
            wallet: null,
            address: address, // Pass address for PSBT conversion
            utxo: {
              txid: utxo.txid,
              vout: utxo.vout,
              amount: utxo.value,
              address: address,
            },
          }
        );

        setTxStatus('broadcasting');
        const { commitTxid, spellTxid } = await broadcastSpellTransactions(
          signedCommitTx,
          signedSpellTx
        );

        setCommitTxid(commitTxid);
        setSpellTxid(spellTxid);
        setTxStatus('confirming');

        toast.success(`✅ Redeemed $${redeemAmountNum.toFixed(2)} successfully!`);
        
        // Save to transaction history
        try {
          const txHistory = JSON.parse(localStorage.getItem('charmCardsTxHistory') || '[]');
          txHistory.push({
            type: 'redeem',
            brand: giftCard.brand,
            commitTxid,
            spellTxid,
            timestamp: Date.now(),
            amount: redeemAmountNum,
          });
          localStorage.setItem('charmCardsTxHistory', JSON.stringify(txHistory));
        } catch (e) {
          console.warn('Failed to save transaction history:', e);
        }
        
        setTimeout(() => {
          setTxStatus('success');
          setTimeout(() => {
            onClose();
            // Trigger refresh without page reload
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('refreshWalletData'));
            }
          }, 2000);
        }, 2000);
      } else {
        throw new Error('Redemption proof incomplete');
      }
    } catch (error: any) {
      setTxStatus('error');
      setTxError(error.message || 'Redemption failed');
      toast.error(error.message || 'Redemption failed');
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-[20px] font-black font-bricolage flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#2A9DFF]" />
            Redeem Gift Card
          </DialogTitle>
          <DialogDescription className="text-[13px] text-black/60">
            Spend part of your {giftCard.brand} gift card balance. The NFT will remain in your wallet with the updated balance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Gift Card Info */}
          <div className="p-4 bg-black/5 rounded-xl border border-black/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-white border border-black/10">
                <img src={giftCard.image} alt={giftCard.brand} className="w-full h-full object-contain p-2" />
              </div>
              <div>
                <h3 className="text-[15px] font-black text-black font-bricolage">{giftCard.brand}</h3>
                <p className="text-[13px] text-black/60">Available: ${giftCard.balance.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Redemption Amount */}
          <div className="space-y-2">
            <Label htmlFor="redeem-amount" className="text-[13px] font-semibold">
              Amount to Redeem
            </Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40">$</span>
              <Input
                id="redeem-amount"
                type="number"
                min="0.01"
                max={maxAmount}
                step="0.01"
                placeholder="0.00"
                value={redeemAmount}
                onChange={(e) => setRedeemAmount(e.target.value)}
                className="pl-8 font-semibold"
                disabled={isRedeeming}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-black/50">
              <span>Max: ${maxAmount.toFixed(2)}</span>
              <button
                onClick={() => setRedeemAmount(maxAmount.toFixed(2))}
                className="text-[#2A9DFF] hover:underline font-medium"
                disabled={isRedeeming}
              >
                Use Max
              </button>
            </div>
          </div>

          {/* Balance Preview */}
          {redeemAmountNum > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between text-[12px] mb-1">
                <span className="text-black/60">Redeeming:</span>
                <span className="font-semibold text-black">${redeemAmountNum.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-black/60">Remaining Balance:</span>
                <span className="font-semibold text-black">${remainingBalance.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Transaction Status */}
          {txStatus !== 'idle' && (
            <div className="mt-4">
              <TransactionStatus
                status={txStatus}
                error={txError}
                commitTxid={commitTxid}
                spellTxid={spellTxid}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isRedeeming}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRedeem}
              disabled={isRedeeming || !redeemAmount || redeemAmountNum <= 0 || redeemAmountNum > maxAmount}
              className="flex-1 bg-[#2A9DFF] text-white hover:bg-[#1A8DFF] disabled:opacity-50"
            >
              {isRedeeming ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Redeeming...
                </>
              ) : (
                <>
                  <DollarSign className="w-4 h-4 mr-2" />
                  Redeem ${redeemAmountNum > 0 ? redeemAmountNum.toFixed(2) : '0.00'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

