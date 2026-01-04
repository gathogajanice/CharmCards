"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShoppingBag, Loader, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { useAppKitAccount } from '@reown/appkit/react';
import { getWalletUtxos, signSpellTransactions, broadcastSpellTransactions, findFundingUtxo } from '@/lib/charms/wallet';
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

  // Auto-set redeem amount to full balance when modal opens (default, but partial redeems are supported)
  useEffect(() => {
    if (isOpen && maxAmount > 0) {
      setRedeemAmount(maxAmount.toFixed(2));
    }
  }, [isOpen, maxAmount]);

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

      // Extract NFT UTXO ID to exclude it from funding UTXO search
      const nftUtxoId = giftCard.utxoId || (utxos[0] ? `${utxos[0].txid}:${utxos[0].vout}` : null);
      
      // Find a plain Bitcoin UTXO for funding (exclude the NFT UTXO)
      setTxStatus('creating-spell');
      const fundingUtxo = await findFundingUtxo(address, nftUtxoId ? [nftUtxoId] : []);
      
      if (!fundingUtxo) {
        throw new Error(
          'No plain Bitcoin UTXO available for funding. ' +
          'Please fund your wallet with some Bitcoin (not charms) to pay for transaction fees. ' +
          'You need at least 1000 satoshis for fees.'
        );
      }
      
      console.log(`✅ Found funding UTXO: ${fundingUtxo.txid}:${fundingUtxo.vout} (${fundingUtxo.value} sats)`);

      // Get exact on-chain token amount from NFT metadata
      // remaining_balance is stored in cents and represents the exact on-chain amount
      const exactInputTokenAmount = giftCard.nftMetadata?.remaining_balance;
      
      if (!exactInputTokenAmount || exactInputTokenAmount <= 0) {
        throw new Error(
          'Invalid on-chain token balance. The gift card has no remaining balance. ' +
          'Please check the gift card status or try refreshing your wallet.'
        );
      }
      
      // Validate tokenId format
      if (!giftCard.tokenId || giftCard.tokenId.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(giftCard.tokenId)) {
        throw new Error(
          `Invalid tokenId format: "${giftCard.tokenId}". ` +
          `tokenId must be a 64-character hexadecimal string (the app_id from mint). ` +
          `This should match the app_id generated during the original mint operation.`
        );
      }
      
      // Calculate redeem amount in cents
      const redeemAmountCents = Math.floor(redeemAmountNum * 100);
      
      // Validate redeem amount is within bounds
      if (redeemAmountCents <= 0) {
        throw new Error('Redeem amount must be greater than 0');
      }
      
      if (redeemAmountCents > exactInputTokenAmount) {
        throw new Error(
          `Cannot redeem more than available balance. ` +
          `On-chain balance: $${(exactInputTokenAmount / 100).toFixed(2)}, ` +
          `Requested: $${redeemAmountNum.toFixed(2)}.`
        );
      }
      
      console.log(`📊 Token amounts: Input=${exactInputTokenAmount} cents, Redeem=${redeemAmountCents} cents`);
      console.log(`   Partial redeem supported: NFT will be consumed, ${redeemAmountCents} cents will be output`);
      
      // Validate input token amount matches NFT remaining balance
      if (exactInputTokenAmount !== giftCard.nftMetadata.remaining_balance) {
        throw new Error(
          `Token amount mismatch: Input token amount (${exactInputTokenAmount}) ` +
          `does not match NFT remaining_balance (${giftCard.nftMetadata.remaining_balance}). ` +
          `This will cause contract validation to fail.`
        );
      }
      
      // Create redeem spell - burn-only: consume NFT, output only redeemed tokens
      // Based on burn-only redeem pattern
      // Spell JSON format per: https://docs.charms.dev/references/spell-json/
      // 
      // IMPORTANT: Use exact on-chain amounts to prevent WASM validation failures
      // Contract validates: output_token_amount > 0 and output_token_amount <= input_nft.remaining_balance
      const redeemSpell = {
        version: 8, // Protocol version (8 is current Charms protocol version)
        apps: {
          // App identifiers: NFT app ($00) and Token app ($01)
          // Format: "app_type/app_id/app_vk" per Charms Spell JSON reference
          // Note: app_vk will be automatically corrected by the API to match the actual WASM binary VK
          // The API will replace tokenId with the correct app_vk derived from the binary
          "$00": `n/${giftCard.tokenId}/${giftCard.tokenId}`, // NFT app: n/<app_id>/<app_id> (app_vk will be corrected by API)
          "$01": `t/${giftCard.tokenId}/${giftCard.tokenId}`, // Token app: t/<app_id>/<app_id> (app_vk will be corrected by API)
        },
        // Omit public_inputs - contract expects empty Data (assert_eq!(x, &empty))
        // Input UTXOs containing charms (per Spell JSON reference)
        ins: [
          {
            utxo_id: giftCard.utxoId || `${utxos[0].txid}:${utxos[0].vout}`, // Format: "txid:vout"
            charms: {
              "$00": giftCard.nftMetadata, // NFT metadata (will be consumed/burned)
              "$01": exactInputTokenAmount, // EXACT on-chain token amount in cents (not from UI state)
            },
          },
        ],
        // Output destinations for charms (per Spell JSON reference)
        // Redeem: NO NFT output, only token output for redeemed amount
        // Contract validates: output_token_amount > 0 and output_token_amount <= input_nft.remaining_balance
        outs: [
          {
            address: address, // Output to same wallet (Taproot address)
            charms: {
              // "$00" (NFT) is omitted - NFT is consumed, not recreated
              "$01": redeemAmountCents, // Output redeemed amount (partial redeems supported)
            },
            sats: 1000, // Required: Bitcoin output value in satoshis
          },
        ],
      };
      
      // Verify spell matches contract requirements for redeem
      console.log('🔍 Redeem spell validation:');
      console.log(`   Input NFT remaining_balance: ${giftCard.nftMetadata.remaining_balance}`);
      console.log(`   Input token amount: ${exactInputTokenAmount}`);
      console.log(`   Match: ${exactInputTokenAmount === giftCard.nftMetadata.remaining_balance ? '✅' : '❌'}`);
      console.log(`   Redeemed amount: ${redeemAmountCents} cents`);
      console.log(`   Output token amount: ${redeemAmountCents} (redeemed value)`);
      console.log(`   NFT output: ❌ (NFT consumed, not recreated)`);
      console.log(`   Redeemed amount > 0: ${redeemAmountCents > 0 ? '✅' : '❌'}`);
      console.log(`   Redeemed amount <= input balance: ${redeemAmountCents <= exactInputTokenAmount ? '✅' : '❌'}`);

      // Call API to generate proof
      setTxStatus('generating-proof');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      
      const response = await fetch(`${API_URL}/api/gift-cards/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spell: redeemSpell,
          fundingUtxo: `${fundingUtxo.txid}:${fundingUtxo.vout}`,
          fundingUtxoValue: fundingUtxo.value, // EXACT value in satoshis from wallet
          changeAddress: address,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        throw new Error(errorData.error || 'Failed to generate redemption proof');
      }

      const { proof } = await response.json();

      // Check if Prover API already broadcast transactions
      // Charms Prover API broadcasts internally as part of /spells/prove
      // If proof response includes TXIDs and broadcasted flag, skip signing and broadcasting
      if (proof.broadcasted && proof.commit_txid && proof.spell_txid) {
        // Prover API already broadcast - use TXIDs from response
        console.log('✅ Transactions already broadcast by Charms Prover API');
        console.log(`   Commit TXID: ${proof.commit_txid}`);
        console.log(`   Spell TXID: ${proof.spell_txid}`);
        console.log('   Package submission performed internally by Charms Prover API. No separate broadcast step required.');
        
        setCommitTxid(proof.commit_txid);
        setSpellTxid(proof.spell_txid);
        setTxStatus('confirming');
        
        toast.success('✅ Transactions broadcast by Charms Prover API!');
      } else if (proof.commit_tx && proof.spell_tx) {
        // Fallback: Prover API didn't broadcast (shouldn't happen, but handle gracefully)
        console.warn('⚠️ Prover API response missing broadcasted flag or TXIDs');
        console.warn('   This should not happen with Charms Prover API');
        console.warn('   Attempting fallback: sign and broadcast');
        
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
          signedSpellTx,
          {
            alreadyBroadcasted: proof.broadcasted || false,
            commitTxid: proof.commit_txid,
            spellTxid: proof.spell_txid,
          }
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
            Redeem part or all of your {giftCard.brand} gift card balance. The NFT will be consumed and the redeemed amount will be sent to your wallet.
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
                placeholder={maxAmount.toFixed(2)}
                value={redeemAmount}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  if (val >= 0 && val <= maxAmount) {
                    setRedeemAmount(e.target.value);
                  } else if (val > maxAmount) {
                    setRedeemAmount(maxAmount.toFixed(2));
                  }
                }}
                className="pl-8 font-semibold"
                disabled={isRedeeming}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-black/50">
              <span className="text-black/40">Max: ${maxAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Balance Preview - Simplified */}
          {redeemAmountNum > 0 && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-black/70 font-medium">Redeeming:</span>
                <span className="font-bold text-black">${redeemAmountNum.toFixed(2)}</span>
              </div>
              {redeemAmountNum < maxAmount && (
                <div className="mt-2 pt-2 border-t border-orange-200">
                  <span className="text-[11px] text-orange-700">
                    ⚠️ Remaining ${(maxAmount - redeemAmountNum).toFixed(2)} will be lost (NFT will be consumed)
                  </span>
                </div>
              )}
              {redeemAmountNum === maxAmount && (
                <div className="mt-2 pt-2 border-t border-orange-200">
                  <span className="text-[11px] text-orange-700">
                    ⚠️ NFT will be consumed after redemption
                  </span>
                </div>
              )}
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
                type="redeem"
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

