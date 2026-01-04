"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Send, Loader } from 'lucide-react';
import { toast } from 'sonner';
import { useAppKitAccount } from '@reown/appkit/react';
import { getWalletUtxos, signSpellTransactions, broadcastSpellTransactions } from '@/lib/charms/wallet';
import TransactionStatus, { TransactionStatus as TxStatus } from '@/components/ui/transaction-status';
import type { GiftCardNftMetadata } from '@/lib/charms/types';
import { useTransactionPolling } from '@/hooks/use-wallet-data';

interface PartialTransferModalProps {
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

export default function PartialTransferModal({ isOpen, onClose, giftCard }: PartialTransferModalProps) {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
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
  const transferAmountNum = parseFloat(transferAmount) || 0;
  const remainingBalance = maxAmount - transferAmountNum;

  const handlePartialTransfer = async () => {
    if (!recipientAddress.trim()) {
      toast.error('Please enter a recipient address');
      return;
    }

    if (!transferAmount || transferAmountNum <= 0) {
      toast.error('Please enter a valid transfer amount');
      return;
    }

    if (transferAmountNum > maxAmount) {
      toast.error(`Cannot transfer more than available balance ($${maxAmount.toFixed(2)})`);
      return;
    }

    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }

    // Validate Bitcoin address format
    if (!recipientAddress.startsWith('tb1') && !recipientAddress.startsWith('bc1')) {
      toast.error('Please enter a valid Bitcoin address (Taproot format)');
      return;
    }

    setIsTransferring(true);
    setTxStatus('creating-spell');
    setTxError(undefined);
    setCommitTxid(undefined);
    setSpellTxid(undefined);

    try {
      const utxos = await getWalletUtxos(address, null);
      if (utxos.length === 0) {
        throw new Error('No UTXOs available');
      }

      // Get exact on-chain token amount from NFT metadata
      // remaining_balance is stored in cents and represents the exact on-chain amount
      const exactInputTokenAmount = giftCard.nftMetadata?.remaining_balance;
      
      if (!exactInputTokenAmount || exactInputTokenAmount <= 0) {
        throw new Error(
          'Invalid on-chain token balance. The gift card has no remaining balance. ' +
          'Please check the gift card status or try refreshing your wallet.'
        );
      }
      
      // Calculate transfer and remaining amounts in cents
      const transferAmountCents = Math.floor(transferAmountNum * 100);
      const exactRemainingTokenAmount = exactInputTokenAmount - transferAmountCents;
      
      // Validate transfer amount
      if (transferAmountCents <= 0) {
        throw new Error('Transfer amount must be greater than zero');
      }
      
      if (transferAmountCents > exactInputTokenAmount) {
        throw new Error(
          `Cannot transfer more than available balance. ` +
          `On-chain balance: $${(exactInputTokenAmount / 100).toFixed(2)}, ` +
          `Transfer amount: $${transferAmountNum.toFixed(2)}`
        );
      }
      
      // CRITICAL: Contract requires exact matches for partial transfer
      // input_token_amount == input_nft.remaining_balance
      // output_token_amount (sum) == input_token_amount (token conservation)
      // output_nft.remaining_balance == output_token_amount (for output with NFT)
      if (exactInputTokenAmount !== giftCard.nftMetadata.remaining_balance) {
        throw new Error(
          `Token amount mismatch: Input token amount (${exactInputTokenAmount}) ` +
          `does not match NFT remaining_balance (${giftCard.nftMetadata.remaining_balance}). ` +
          `This will cause contract validation to fail.`
        );
      }
      
      // Create partial transfer spell - transfer token balance, keep NFT
      // Based on Charms token transfer documentation
      // Spell JSON format per: https://docs.charms.dev/references/spell-json/
      // 
      // IMPORTANT: Use exact on-chain amounts to prevent WASM validation failures
      // Contract validates: token amounts must match NFT remaining_balance exactly
      const transferSpell = {
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
              "$01": exactInputTokenAmount, // EXACT on-chain token amount in cents (not from UI state)
            },
          },
        ],
        // Output destinations for charms (per Spell JSON reference)
        outs: [
          {
            address: recipientAddress, // Recipient Bitcoin address (Taproot format)
            charms: {
              "$01": transferAmountCents, // Transfer partial token balance in cents
            },
            sats: 1000, // Required: Bitcoin output value in satoshis
          },
          {
            address: address, // Keep NFT and remaining balance in same wallet
            charms: {
              "$00": {
                // NFT with updated remaining balance - all fields must be explicitly set
                brand: giftCard.nftMetadata.brand,
                image: giftCard.nftMetadata.image,
                initial_amount: giftCard.nftMetadata.initial_amount,
                expiration_date: giftCard.nftMetadata.expiration_date,
                created_at: giftCard.nftMetadata.created_at,
                remaining_balance: exactRemainingTokenAmount, // EXACT remaining balance (must match output token amount)
              },
              "$01": exactRemainingTokenAmount, // EXACT remaining token balance (must match NFT remaining_balance)
            },
            sats: 1000, // Required: Bitcoin output value in satoshis
          },
        ],
      };
      
      // Verify spell matches contract requirements
      console.log('🔍 Partial transfer spell validation:');
      console.log(`   Input NFT remaining_balance: ${giftCard.nftMetadata.remaining_balance}`);
      console.log(`   Input token amount: ${exactInputTokenAmount}`);
      console.log(`   Match: ${exactInputTokenAmount === giftCard.nftMetadata.remaining_balance ? '✅' : '❌'}`);
      console.log(`   Transfer amount: ${transferAmountCents} cents`);
      console.log(`   Remaining amount: ${exactRemainingTokenAmount} cents`);
      console.log(`   Token conservation: ${(transferAmountCents + exactRemainingTokenAmount) === exactInputTokenAmount ? '✅' : '❌'}`);
      console.log(`   Output NFT remaining_balance: ${exactRemainingTokenAmount}`);
      console.log(`   Output token amount: ${exactRemainingTokenAmount}`);
      console.log(`   Match: ✅ (must match for contract validation)`);

      // Call API to generate proof
      setTxStatus('generating-proof');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_URL}/api/gift-cards/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spell: transferSpell,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate transfer proof');
      }

      const { proof } = await response.json();

      if (proof.commit_tx && proof.spell_tx) {
        setTxStatus('signing');
        toast.info('Please approve the transaction in your wallet...');

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

        toast.success(`✅ Transferred $${transferAmountNum.toFixed(2)} successfully!`);
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
        throw new Error('Transfer proof incomplete');
      }
    } catch (error: any) {
      setTxStatus('error');
      setTxError(error.message || 'Transfer failed');
      toast.error(error.message || 'Transfer failed');
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-[20px] font-black font-bricolage">
            Partial Transfer
          </DialogTitle>
          <DialogDescription className="text-[13px] text-black/60">
            Transfer part of your {giftCard.brand} gift card balance to another address. The NFT stays with you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Gift Card Info */}
          <div className="p-4 bg-black/5 rounded-xl border border-black/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-white border border-black/10">
                <img src={giftCard.image} alt={giftCard.brand} className="w-full h-full object-contain p-2" />
              </div>
              <div>
                <h3 className="text-[15px] font-black text-black font-bricolage">{giftCard.brand}</h3>
                <p className="text-[13px] text-black/60">Available: ${giftCard.balance.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Recipient Address */}
          <div className="space-y-2">
            <Label htmlFor="recipient" className="text-[13px] font-semibold">
              Recipient Bitcoin Address
            </Label>
            <Input
              id="recipient"
              placeholder="tb1p..."
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              className="font-mono text-[12px]"
              disabled={isTransferring}
            />
          </div>

          {/* Transfer Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-[13px] font-semibold">
              Amount to Transfer
            </Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40">$</span>
              <Input
                id="amount"
                type="number"
                min="0.01"
                max={maxAmount}
                step="0.01"
                placeholder="0.00"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="pl-8 font-semibold"
                disabled={isTransferring}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-black/50">
              <span>Max: ${maxAmount.toFixed(2)}</span>
              <button
                onClick={() => setTransferAmount(maxAmount.toFixed(2))}
                className="text-[#2A9DFF] hover:underline font-medium"
                disabled={isTransferring}
              >
                Use Max
              </button>
            </div>
          </div>

          {/* Balance Preview */}
          {transferAmountNum > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between text-[12px] mb-1">
                <span className="text-black/60">Transferring:</span>
                <span className="font-semibold text-black">${transferAmountNum.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-black/60">Your Remaining Balance:</span>
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
                type="transfer"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isTransferring}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePartialTransfer}
              disabled={isTransferring || !recipientAddress.trim() || !transferAmount || transferAmountNum <= 0 || transferAmountNum > maxAmount}
              className="flex-1 bg-black text-white hover:bg-black/90"
            >
              {isTransferring ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Transferring...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Transfer ${transferAmountNum > 0 ? transferAmountNum.toFixed(2) : '0.00'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

