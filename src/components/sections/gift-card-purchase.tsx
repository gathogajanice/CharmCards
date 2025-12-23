"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { ShoppingCart, Bitcoin, Loader } from 'lucide-react';
import { useCharms } from '@/hooks/use-charms';
import { useAppKitAccount, useAppKit } from '@reown/appkit/react';
import { toast } from 'sonner';
import { getWalletUtxos, signSpellTransactions, broadcastSpellTransactions } from '@/lib/charms/wallet';
import { useNetworkCheck } from '@/hooks/use-network-check';
import NetworkSwitchModal from '@/components/ui/network-switch-modal';

interface GiftCardPurchaseProps {
  name: string;
  imageUrl: string;
  denominations: number[];
  customRange?: { min: number; max: number };
  discount?: string;
}

export default function GiftCardPurchase({ name, imageUrl, denominations, customRange, discount }: GiftCardPurchaseProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(denominations[0]);
  const [customAmount, setCustomAmount] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [imageError, setImageError] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  
  const { address, isConnected } = useAppKitAccount();
  const { open: openWallet } = useAppKit();
  const { mintGiftCard, isLoading: charmsLoading, error: charmsError } = useCharms();
  const {
    currentNetwork,
    isOnCorrectNetwork,
    needsSwitch,
    showNetworkModal,
    setShowNetworkModal,
  } = useNetworkCheck();

  const handleCustomAmount = (value: string) => {
    setCustomAmount(value);
    setSelectedAmount(null);
  };

  const handleSelectDenomination = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const currentAmount = selectedAmount || (customAmount ? parseFloat(customAmount) : 0);
  const discountedPrice = discount ? currentAmount * (1 - parseFloat(discount) / 100) : currentAmount;
  const total = discountedPrice * quantity;

  const handleMintGiftCard = async () => {
    if (!isConnected || !address) {
      toast.error('Please connect your Bitcoin wallet first');
      return;
    }

    // Check network before proceeding
    if (needsSwitch) {
      setShowNetworkModal(true);
      toast.error('Please switch to Bitcoin Testnet4 to continue');
      return;
    }

    if (!isOnCorrectNetwork) {
      toast.error('Please ensure your wallet is connected to Bitcoin Testnet4');
      return;
    }

    if (!currentAmount || currentAmount <= 0) {
      toast.error('Please select a valid amount');
      return;
    }

    setIsMinting(true);
    try {
      // Get UTXO from wallet
      let inUtxo: string;
      if (address) {
        // Fetch UTXOs from mempool.space API (works with any Bitcoin address)
        const utxos = await getWalletUtxos(address, null);
        if (utxos.length === 0) {
          toast.error('No UTXOs available. Please fund your wallet with Testnet4 BTC.');
          return;
        }
        // Use first available UTXO
        inUtxo = `${utxos[0].txid}:${utxos[0].vout}`;
      } else {
        toast.error('Wallet not connected');
        return;
      }
      
      // Create spell and generate proof
      const { spell, proof } = await mintGiftCard({
        inUtxo,
        recipientAddress: address,
        brand: name,
        image: imageUrl,
        initialAmount: Math.floor(currentAmount * 100), // Convert to cents
        expirationDate: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year
      });

      toast.success('Spell created! Proof generated. Signing transactions...');
      
      // If proof contains transactions, sign and broadcast them
      if (proof.commit_tx && proof.spell_tx) {
        try {
          // Get UTXO info for signing
          const utxos = await getWalletUtxos(address, null);
          if (utxos.length === 0) {
            throw new Error('No UTXOs available for signing');
          }
          
          const utxo = utxos[0];
          const utxoForSigning = {
            txid: utxo.txid,
            vout: utxo.vout,
            amount: utxo.value,
            address: address,
          };
          
          toast.info('Attempting to sign transactions...');
          
          // Try to sign transactions using the signSpellTransactions function
          // This will attempt wallet-specific methods automatically
          try {
            const { commitTx: signedCommitTx, spellTx: signedSpellTx } = await signSpellTransactions(
              proof.commit_tx,
              proof.spell_tx,
              {
                wallet: null, // Will use wallet-specific methods from window
                utxo: utxoForSigning,
              }
            );
            
            // Check if transactions were actually signed (not just returned as-is)
            const wasSigned = signedCommitTx !== proof.commit_tx || signedSpellTx !== proof.spell_tx;
            
            if (wasSigned || signedCommitTx || signedSpellTx) {
              toast.info('Broadcasting transactions...');
              const { commitTxid, spellTxid } = await broadcastSpellTransactions(
                signedCommitTx,
                signedSpellTx
              );
              
              toast.success(`✅ Gift card minted successfully!`);
              toast.success(`Commit TX: ${commitTxid.substring(0, 16)}...`);
              toast.success(`Spell TX: ${spellTxid.substring(0, 16)}...`);
              
              // Open explorer links
              const explorerBase = 'https://mempool.space/testnet4/tx/';
              console.log(`\n✅ Transactions broadcast successfully!`);
              console.log(`Commit TX: ${explorerBase}${commitTxid}`);
              console.log(`Spell TX: ${explorerBase}${spellTxid}`);
              
              // Store transaction IDs for reference
              (window as any).lastMintTxids = { commitTxid, spellTxid };
            } else {
              throw new Error('Transactions were not signed');
            }
          } catch (signError: any) {
            // If signing failed, provide manual instructions
            console.log('\n⚠️ Automatic signing not available. Manual signing required.');
            console.log('Commit TX (hex):', proof.commit_tx);
            console.log('Spell TX (hex):', proof.spell_tx);
            console.log('UTXO:', utxoForSigning);
            console.log('\n=== MANUAL SIGNING INSTRUCTIONS ===');
            console.log('Note: Bitcoin wallets typically require PSBT format for signing.');
            console.log('The Prover API returns raw transaction hex, which may need conversion.');
            console.log('\nOptions:');
            console.log('1. Use Charms CLI to sign: charms spell sign <spell.yaml>');
            console.log('2. Convert hex to PSBT and use wallet\'s signPsbt method');
            console.log('3. Use a Bitcoin node with RPC access for signing');
            console.log('\nAfter signing, broadcast using:');
            console.log('broadcastSpellTransactions(commitTx, spellTx)');
            console.log('\nView on explorer: https://mempool.space/testnet4/tx/<txid>');
            
            toast.warning('Transactions prepared but require manual signing. Check console for details.');
            toast.info('See console for transaction hex and signing instructions.');
          }
        } catch (signError: any) {
          console.error('Signing/broadcasting error:', signError);
          toast.error(`Transaction error: ${signError.message}`);
          console.log('\n=== ERROR DETAILS ===');
          console.log('Commit TX (hex):', proof.commit_tx);
          console.log('Spell TX (hex):', proof.spell_tx);
          console.log('Error:', signError);
        }
      } else {
        toast.success('Spell created! Proof generated.');
        console.log('Spell:', spell);
        console.log('Proof:', proof);
        toast.warning('Transactions not included in proof. Check API response.');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create gift card');
      console.error('Minting error:', error);
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <section className="bg-background py-12">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12">
          <div className="relative aspect-[4/3] rounded-[12px] overflow-hidden bg-surface">
            <Image
              src={imageError ? 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=600&auto=format&fit=crop' : imageUrl}
              alt={name}
              fill
              className="object-cover"
              onError={() => setImageError(true)}
            />
            {discount && (
              <div className="absolute top-4 left-4 bg-accent text-accent-foreground text-[13px] font-semibold px-3 py-1.5 rounded-full">
                {discount} OFF
              </div>
            )}
          </div>

          <div>
            <h1 className="text-[32px] font-semibold text-foreground tracking-[-0.01em] mb-2">
              {name} Gift Card
            </h1>
            
            {discount && (
              <p className="text-accent text-[14px] font-medium mb-6">
                Save {discount} on this gift card
              </p>
            )}

            <div className="mb-8">
              <label className="text-[14px] font-medium text-foreground mb-3 block">
                Select Amount
              </label>
              <div className="flex flex-wrap gap-2">
                {denominations.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleSelectDenomination(amount)}
                    className={`h-10 px-5 rounded-full text-[14px] font-medium border transition-all ${
                      selectedAmount === amount
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-foreground border-border hover:border-foreground'
                    }`}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
            </div>

            {customRange && (
              <div className="mb-8">
                <label className="text-[14px] font-medium text-foreground mb-3 block">
                  Or enter custom amount (${customRange.min} - ${customRange.max})
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <input
                    type="number"
                    min={customRange.min}
                    max={customRange.max}
                    value={customAmount}
                    onChange={(e) => handleCustomAmount(e.target.value)}
                    placeholder={`${customRange.min} - ${customRange.max}`}
                    className="w-full h-12 pl-8 pr-4 bg-background border border-border rounded-[8px] text-foreground text-[14px] placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="mb-8">
              <label className="text-[14px] font-medium text-foreground mb-3 block">
                Quantity
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground hover:border-foreground transition-colors"
                >
                  -
                </button>
                <span className="w-12 text-center text-foreground font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground hover:border-foreground transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Price display removed - testing on-chain only */}

            <div className="flex gap-3">
              <button className="flex-1 h-12 bg-primary text-primary-foreground font-semibold rounded-full flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                <ShoppingCart size={18} />
                Add to Cart
              </button>
              <button
                onClick={handleMintGiftCard}
                disabled={isMinting || charmsLoading || !isConnected}
                className="flex-1 h-12 bg-foreground text-background font-semibold rounded-full flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isMinting || charmsLoading ? (
                  <>
                    <Loader size={18} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Bitcoin size={18} />
                    Mint with Charms
                  </>
                )}
              </button>
            </div>

            <p className="text-center text-muted-foreground text-[13px] mt-4">
              Pay with 100+ cryptocurrencies
            </p>
          </div>
        </div>
      </div>

      {/* Network Switch Modal */}
      <NetworkSwitchModal
        isOpen={showNetworkModal}
        onClose={() => setShowNetworkModal(false)}
        currentNetwork={currentNetwork === 'mainnet' ? 'Mainnet' : currentNetwork === 'testnet' ? 'Testnet' : currentNetwork}
        requiredNetwork="Testnet4"
      />
    </section>
  );
}
