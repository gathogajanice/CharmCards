"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppKitAccount } from '@reown/appkit/react';
import { getWalletUtxos, signSpellTransactions, broadcastSpellTransactions } from '@/lib/charms/wallet';
import TransactionStatus, { TransactionStatus as TxStatus } from '@/components/ui/transaction-status';
import type { GiftCardNftMetadata } from '@/lib/charms/types';

interface BurnGiftCardModalProps {
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

// Standard Bitcoin Testnet4 burn address (unspendable Taproot address)
const BURN_ADDRESS = 'tb1p000000000000000000000000000000000000000000000000000000000000';

export default function BurnGiftCardModal({ isOpen, onClose, giftCard }: BurnGiftCardModalProps) {
  const [isBurning, setIsBurning] = useState(false);
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [commitTxid, setCommitTxid] = useState<string | undefined>();
  const [spellTxid, setSpellTxid] = useState<string | undefined>();
  const [txError, setTxError] = useState<string | undefined>();
  const [confirmed, setConfirmed] = useState(false);
  const { address } = useAppKitAccount();

  const handleBurn = async () => {
    if (!confirmed) {
      toast.error('Please confirm that you understand this action is permanent');
      return;
    }

    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }

    setIsBurning(true);
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

      // Create burn spell - transfer to burn address
      // Based on Charms NFT transfer documentation: https://docs.charms.dev/guides/wallet-integration/transactions/nft/
      // Spell JSON format per: https://docs.charms.dev/references/spell-json/
      const burnSpell = {
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
              "$01": Math.floor(giftCard.balance * 100), // Token balance in cents
            },
          },
        ],
        // Output destinations for charms (per Spell JSON reference)
        outs: [
          {
            address: BURN_ADDRESS, // Burn address - unspendable Taproot address
            charms: {
              "$00": giftCard.nftMetadata, // Burn NFT
              "$01": Math.floor(giftCard.balance * 100), // Burn token balance
            },
            sats: 1000, // Required: Bitcoin output value in satoshis
          },
        ],
      };

      // Call API to generate proof
      setTxStatus('generating-proof');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_URL}/api/gift-cards/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spell: burnSpell,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate burn proof');
      }

      const { proof } = await response.json();

      if (proof.commit_tx && proof.spell_tx) {
        setTxStatus('signing');
        toast.info('Please approve the burn transaction in your wallet...');

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

        toast.success('✅ Gift card burned successfully!');
        
        // Save to transaction history
        try {
          const txHistory = JSON.parse(localStorage.getItem('charmCardsTxHistory') || '[]');
          txHistory.push({
            type: 'burn',
            brand: giftCard.brand,
            commitTxid,
            spellTxid,
            timestamp: Date.now(),
            amount: giftCard.balance,
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
        throw new Error('Burn proof incomplete');
      }
    } catch (error: any) {
      setTxStatus('error');
      setTxError(error.message || 'Burn failed');
      toast.error(error.message || 'Burn failed');
    } finally {
      setIsBurning(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-[20px] font-black font-bricolage flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Burn Gift Card
          </DialogTitle>
          <DialogDescription className="text-[13px] text-black/60">
            This action will permanently burn your {giftCard.brand} gift card. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Warning Box */}
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-[14px] font-semibold text-red-900 mb-1">Permanent Deletion</h4>
                <p className="text-[12px] text-red-700 leading-relaxed">
                  Burning this gift card will permanently destroy both the NFT and the remaining balance (${giftCard.balance.toFixed(2)}). 
                  The card will be sent to an unspendable address and cannot be recovered.
                </p>
              </div>
            </div>
          </div>

          {/* Gift Card Info */}
          <div className="p-4 bg-black/5 rounded-xl border border-black/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-white border border-black/10">
                <img src={giftCard.image} alt={giftCard.brand} className="w-full h-full object-contain p-2" />
              </div>
              <div>
                <h3 className="text-[15px] font-black text-black font-bricolage">{giftCard.brand}</h3>
                <p className="text-[13px] text-black/60">Balance: ${giftCard.balance.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Confirmation Checkbox */}
          <div className="flex items-start gap-3 p-3 bg-black/5 rounded-lg border border-black/10">
            <input
              type="checkbox"
              id="confirm-burn"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-black/20 text-red-600 focus:ring-red-500"
              disabled={isBurning}
            />
            <label htmlFor="confirm-burn" className="text-[12px] text-black/70 leading-relaxed cursor-pointer">
              I understand that burning this gift card is permanent and irreversible. I will lose both the NFT and the ${giftCard.balance.toFixed(2)} balance forever.
            </label>
          </div>

          {/* Transaction Status */}
          {txStatus !== 'idle' && (
            <div className="mt-4">
              <TransactionStatus
                status={txStatus}
                error={txError}
                commitTxid={commitTxid}
                spellTxid={spellTxid}
                type="burn"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isBurning}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBurn}
              disabled={isBurning || !confirmed}
              className="flex-1 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isBurning ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Burning...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Burn Forever
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

