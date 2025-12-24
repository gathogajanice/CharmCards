"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { Bitcoin, Loader } from 'lucide-react';
import { useCharms } from '@/hooks/use-charms';
import { useAppKitAccount, useAppKit } from '@reown/appkit/react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { getWalletUtxos, signSpellTransactions, broadcastSpellTransactions, getWalletBalance } from '@/lib/charms/wallet';
import { useNetworkCheck } from '@/hooks/use-network-check';
import NetworkSwitchModal from '@/components/ui/network-switch-modal';
import { calculateTotalCostSats, hasSufficientBalance, formatSats, satsToBtc } from '@/lib/charms/fees';
import { useEffect } from 'react';
import TransactionStatus, { TransactionStatus as TxStatus } from '@/components/ui/transaction-status';

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
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [balanceCheckError, setBalanceCheckError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [commitTxid, setCommitTxid] = useState<string | undefined>();
  const [spellTxid, setSpellTxid] = useState<string | undefined>();
  const [txError, setTxError] = useState<string | undefined>();
  
  const { address, isConnected } = useAppKitAccount();
  const { open: openWallet } = useAppKit();
  const { mintGiftCard, isLoading: charmsLoading, error: charmsError } = useCharms();
  const router = useRouter();
  const {
    currentNetwork,
    isOnCorrectNetwork,
    needsSwitch,
    showNetworkModal,
    setShowNetworkModal,
  } = useNetworkCheck();

  // Fetch wallet balance when connected
  useEffect(() => {
    const fetchBalance = async () => {
      if (!address || !isConnected) {
        setWalletBalance(null);
        return;
      }

      try {
        const balance = await getWalletBalance(address, null);
        setWalletBalance(balance);
        setBalanceCheckError(null);
      } catch (error: any) {
        console.warn('Failed to fetch wallet balance:', error);
        setBalanceCheckError('Unable to check balance');
      }
    };

    fetchBalance();
  }, [address, isConnected]);

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

  // Calculate fees and check balance
  const giftCardAmountCents = Math.floor(total * 100);
  const costBreakdown = currentAmount > 0 ? calculateTotalCostSats(giftCardAmountCents) : null;
  const balanceCheck = walletBalance !== null && costBreakdown 
    ? hasSufficientBalance(walletBalance, giftCardAmountCents)
    : null;

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

    // Check wallet balance before proceeding
    if (walletBalance !== null && costBreakdown) {
      const balanceCheck = hasSufficientBalance(walletBalance, giftCardAmountCents);
      if (!balanceCheck.sufficient) {
        toast.error(
          `Insufficient balance. Required: ${formatSats(balanceCheck.requiredSats)}, ` +
          `Available: ${formatSats(balanceCheck.availableSats)}. ` +
          `Shortfall: ${formatSats(balanceCheck.shortfallSats)}`
        );
        return;
      }
    }

    setIsMinting(true);
    setTxStatus('creating-spell');
    setTxError(undefined);
    setCommitTxid(undefined);
    setSpellTxid(undefined);
    
    try {
      // Get UTXO from wallet
      let inUtxo: string;
      if (address) {
        // Fetch UTXOs from mempool.space API (works with any Bitcoin address)
        const utxos = await getWalletUtxos(address, null);
        if (utxos.length === 0) {
          setTxStatus('error');
          setTxError('No UTXOs available. Please fund your wallet with Testnet4 BTC.');
          toast.error('No UTXOs available. Please fund your wallet with Testnet4 BTC.');
          setIsMinting(false);
          return;
        }
        // Use first available UTXO
        inUtxo = `${utxos[0].txid}:${utxos[0].vout}`;
      } else {
        setTxStatus('error');
        setTxError('Wallet not connected');
        toast.error('Wallet not connected');
        setIsMinting(false);
        return;
      }
      
      // Create spell and generate proof
      setTxStatus('generating-proof');
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
          
          setTxStatus('signing');
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
              setTxStatus('broadcasting');
              toast.info('Broadcasting transactions...');
              const { commitTxid, spellTxid } = await broadcastSpellTransactions(
                signedCommitTx,
                signedSpellTx
              );
              
              setCommitTxid(commitTxid);
              setSpellTxid(spellTxid);
              setTxStatus('confirming');
              
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
              
              // Store in localStorage for transaction history
              try {
                const txHistory = JSON.parse(localStorage.getItem('charmCardsTxHistory') || '[]');
                txHistory.push({
                  type: 'mint',
                  brand: name,
                  image: imageUrl, // Store image URL for wallet display
                  commitTxid,
                  spellTxid,
                  timestamp: Date.now(),
                  amount: currentAmount,
                });
                localStorage.setItem('charmCardsTxHistory', JSON.stringify(txHistory));
              } catch (e) {
                console.warn('Failed to save transaction history:', e);
              }
              
              // Mark as success after a short delay
              setTimeout(() => {
                setTxStatus('success');
                // Trigger refresh and redirect to collection page after 3 seconds
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('refreshWalletData'));
                  setTimeout(() => {
                    router.push('/wallet');
                  }, 3000);
                }
              }, 2000);
            } else {
              throw new Error('Transactions were not signed');
            }
          } catch (signError: any) {
            setTxStatus('error');
            setTxError(signError.message || 'Signing failed');
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
          setTxStatus('error');
          setTxError(signError.message || 'Transaction error');
          console.error('Signing/broadcasting error:', signError);
          toast.error(`Transaction error: ${signError.message}`);
          console.log('\n=== ERROR DETAILS ===');
          console.log('Commit TX (hex):', proof.commit_tx);
          console.log('Spell TX (hex):', proof.spell_tx);
          console.log('Error:', signError);
        }
      } else {
        setTxStatus('error');
        setTxError('Transactions not included in proof');
        toast.success('Spell created! Proof generated.');
        console.log('Spell:', spell);
        console.log('Proof:', proof);
        toast.warning('Transactions not included in proof. Check API response.');
      }
    } catch (error: any) {
      setTxStatus('error');
      setTxError(error.message || 'Failed to create gift card');
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

            {/* Transaction Status */}
            {txStatus !== 'idle' && (
              <div className="mb-6">
                <TransactionStatus
                  status={txStatus}
                  commitTxid={commitTxid}
                  spellTxid={spellTxid}
                  error={txError}
                />
              </div>
            )}

            {/* Fee Breakdown */}
            {isConnected && currentAmount > 0 && costBreakdown && (
              <div className="mb-6 p-4 bg-background border border-border rounded-[12px]">
                <h3 className="text-[14px] font-semibold text-foreground mb-3">Cost Breakdown</h3>
                <div className="space-y-2 text-[13px]">
                  <div className="flex justify-between text-foreground/80">
                    <span>Gift Card Amount:</span>
                    <span className="font-medium">${total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-foreground/80">
                    <span>Estimated Network Fees:</span>
                    <span className="font-medium">{formatSats(costBreakdown.estimatedFeesSats)}</span>
                  </div>
                  <div className="pt-2 border-t border-border flex justify-between text-foreground font-semibold">
                    <span>Total Required:</span>
                    <span>{formatSats(costBreakdown.minimumRequiredSats)}</span>
                  </div>
                  {walletBalance !== null && balanceCheck && (
                    <div className={`pt-2 text-[12px] ${balanceCheck.sufficient ? 'text-green-600' : 'text-red-600'}`}>
                      {balanceCheck.sufficient ? (
                        <span>✓ Sufficient balance ({formatSats(balanceCheck.availableSats)} available)</span>
                      ) : (
                        <span>
                          ✗ Insufficient balance. Need {formatSats(balanceCheck.shortfallSats)} more.
                        </span>
                      )}
                    </div>
                  )}
                  {balanceCheckError && (
                    <div className="pt-2 text-[12px] text-foreground/60">
                      {balanceCheckError}
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={handleMintGiftCard}
              disabled={isMinting || charmsLoading || !isConnected}
              className="w-full h-12 bg-foreground text-background font-semibold rounded-full flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
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
