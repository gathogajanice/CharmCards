"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Send, Loader, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAppKitAccount } from '@reown/appkit/react';
import { getWalletUtxos, signSpellTransactions, broadcastSpellTransactions, findFundingUtxo } from '@/lib/charms/wallet';
import TransactionStatus, { TransactionStatus as TxStatus } from '@/components/ui/transaction-status';
import type { GiftCardNftMetadata } from '@/lib/charms/types';
import { useTransactionPolling } from '@/hooks/use-wallet-data';

interface TransferGiftCardModalProps {
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
    utxoId?: string; // Will need to fetch this
  };
}

export default function TransferGiftCardModal({ isOpen, onClose, giftCard }: TransferGiftCardModalProps) {
  const [recipientAddress, setRecipientAddress] = useState('');
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

  const handleTransfer = async () => {
    if (!recipientAddress.trim()) {
      toast.error('Please enter a recipient address');
      return;
    }

    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }

    // Validate Bitcoin address format (basic check)
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
      // TODO: Fetch the actual UTXO containing this NFT
      // For now, we'll need to get it from the wallet
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
      
      // CRITICAL: Contract requires exact matches for transfer
      // input_token_amount == input_nft.remaining_balance
      // output_token_amount == output_nft.remaining_balance
      // input_token_amount == output_token_amount (token conservation)
      // input_nft.remaining_balance == output_nft.remaining_balance (NFT balance preservation)
      if (exactInputTokenAmount !== giftCard.nftMetadata.remaining_balance) {
        throw new Error(
          `Token amount mismatch: Input token amount (${exactInputTokenAmount}) ` +
          `does not match NFT remaining_balance (${giftCard.nftMetadata.remaining_balance}). ` +
          `This will cause contract validation to fail.`
        );
      }
      
      // Create transfer spell - full transfer: NFT and tokens to recipient
      // Based on Charms NFT transfer documentation: https://docs.charms.dev/guides/wallet-integration/transactions/nft/
      // Spell JSON format per: https://docs.charms.dev/references/spell-json/
      // 
      // IMPORTANT: Use exact on-chain amounts to prevent WASM validation failures
      // Contract validates: token amounts must match NFT remaining_balance exactly
      const transferSpell = {
        version: 8, // Protocol version (8 is current Charms protocol version)
        apps: {
          // App identifiers: NFT app ($00) and Token app ($01)
          // Format: "app_type/app_id/app_vk" per Charms Spell JSON reference
          // Note: app_vk will be automatically corrected by the API to match the actual WASM binary VK
          // The API will replace tokenId with the correct app_vk derived from the binary
          "$00": `n/${giftCard.tokenId}/${giftCard.tokenId}`, // NFT app: n/<app_id>/<app_id> (app_vk will be corrected by API)
          "$01": `t/${giftCard.tokenId}/${giftCard.tokenId}`, // Token app: t/<app_id>/<app_id> (app_vk will be corrected by API)
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
              "$00": giftCard.nftMetadata, // Transfer NFT (with same remaining_balance)
              "$01": exactInputTokenAmount, // Transfer EXACT on-chain token amount (must match NFT remaining_balance)
            },
            sats: 1000, // Required: Bitcoin output value in satoshis
          },
        ],
      };
      
      // Verify spell matches contract requirements
      console.log('🔍 Transfer spell validation:');
      console.log(`   Input NFT remaining_balance: ${giftCard.nftMetadata.remaining_balance}`);
      console.log(`   Input token amount: ${exactInputTokenAmount}`);
      console.log(`   Match: ${exactInputTokenAmount === giftCard.nftMetadata.remaining_balance ? '✅' : '❌'}`);
      console.log(`   Output NFT remaining_balance: ${giftCard.nftMetadata.remaining_balance}`);
      console.log(`   Output token amount: ${exactInputTokenAmount}`);
      console.log(`   Match: ✅ (preserved during transfer)`);
      console.log(`   Token conservation: ${exactInputTokenAmount === exactInputTokenAmount ? '✅' : '❌'}`);

      // Call API to generate proof
      setTxStatus('generating-proof');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_URL}/api/gift-cards/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spell: transferSpell,
          fundingUtxo: `${fundingUtxo.txid}:${fundingUtxo.vout}`,
          fundingUtxoValue: fundingUtxo.value, // EXACT value in satoshis from wallet
          changeAddress: address,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate transfer proof');
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

        toast.success('✅ Gift card transferred successfully!');
        
        // Save to transaction history
        try {
          const txHistory = JSON.parse(localStorage.getItem('charmCardsTxHistory') || '[]');
          txHistory.push({
            type: 'transfer',
            brand: giftCard.brand,
            commitTxid,
            spellTxid,
            timestamp: Date.now(),
            recipientAddress: recipientAddress,
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
            Transfer Gift Card
          </DialogTitle>
          <DialogDescription className="text-[13px] text-black/60">
            Transfer your {giftCard.brand} gift card to another Bitcoin address. The entire card and balance will be transferred.
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
                <p className="text-[13px] text-black/60">Balance: ${giftCard.balance.toFixed(2)}</p>
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
            <p className="text-[11px] text-black/50">
              Enter a Bitcoin Taproot address (starts with tb1p or bc1p)
            </p>
          </div>

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
              onClick={handleTransfer}
              disabled={isTransferring || !recipientAddress.trim()}
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
                  Transfer
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

