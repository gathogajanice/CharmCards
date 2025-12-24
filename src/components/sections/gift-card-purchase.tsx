"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { Bitcoin, Loader } from 'lucide-react';
import { useCharms } from '@/hooks/use-charms';
import { useAppKitAccount, useAppKit } from '@reown/appkit/react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { getWalletUtxos, signSpellTransactions, broadcastSpellTransactions, getWalletBalance } from '@/lib/charms/wallet';

const NETWORK = process.env.NEXT_PUBLIC_BITCOIN_NETWORK || 'testnet4';
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
      // Step 1: Verify balance (more reliable than UTXO fetching)
      const currentBalance = await getWalletBalance(address, null);
      if (!currentBalance || currentBalance <= 0) {
        setTxStatus('error');
        setTxError('Insufficient balance. Please fund your wallet with Testnet4 BTC.');
        toast.error('Insufficient balance. Please fund your wallet with Testnet4 BTC.');
        setIsMinting(false);
        return;
      }

      // Step 2: Try to get UTXO for spell creation (but don't fail if unavailable)
      let inUtxo: string | null = null;
      let utxos: Array<{ txid: string; vout: number; value: number }> = [];
      
      // Try to fetch UTXOs - but be lenient
      try {
        utxos = await getWalletUtxos(address, null);
        if (utxos.length > 0) {
          console.log(`Found ${utxos.length} UTXOs, using first one: ${utxos[0].txid}:${utxos[0].vout}`);
          inUtxo = `${utxos[0].txid}:${utxos[0].vout}`;
        } else {
          console.warn('No UTXOs found from wallet or mempool, but balance exists. Proceeding with balance check only.');
          // If we have balance but no UTXOs, we can still try - the Prover API might handle it
          // Or we can construct a dummy UTXO that will be resolved during PSBT creation
          toast.info('UTXOs not yet indexed, but balance confirmed. Proceeding with transaction...');
        }
      } catch (utxoError) {
        console.warn('UTXO fetch failed, but balance exists. Proceeding:', utxoError);
        toast.info('Proceeding with transaction (UTXOs will be resolved during signing)...');
      }

      // Step 3: Create spell and generate proof
      setTxStatus('generating-proof');
      toast.info('Creating spell and generating proof...');
      
      // If we don't have a UTXO, we need to provide one for the API
      // The API requires an inUtxo, so we'll need to get one or construct it
      if (!inUtxo) {
        // Try one more time with a longer wait
        console.log('Retrying UTXO fetch with longer wait...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        utxos = await getWalletUtxos(address, null);
        if (utxos.length > 0) {
          inUtxo = `${utxos[0].txid}:${utxos[0].vout}`;
        } else {
          // Last resort: we can't proceed without a UTXO for the API
          setTxStatus('error');
          const errorMsg = 'Unable to fetch UTXOs. Please wait a few moments for the network to sync, then try again.';
          setTxError(errorMsg);
          toast.error(errorMsg);
          toast.info('Your wallet shows a balance, but UTXOs need to be indexed. This usually takes 1-2 minutes after receiving funds.');
          setIsMinting(false);
          return;
        }
      }

      const { spell, proof } = await mintGiftCard({
        inUtxo: inUtxo!,
        recipientAddress: address,
        brand: name,
        image: imageUrl,
        initialAmount: Math.floor(currentAmount * 100), // Convert to cents
        expirationDate: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year
      });

      toast.success('Spell created! Proof generated. Please approve the transaction in your wallet...');
      
      // Step 4: Sign transactions (THIS TRIGGERS WALLET POPUP)
      if (proof.commit_tx && proof.spell_tx) {
        try {
          setTxStatus('signing');
          toast.info('🔄 Please approve the transaction in your wallet popup...');
          
          // Sign transactions - this will convert hex to PSBT and trigger wallet popup
          const { commitTx: signedCommitTx, spellTx: signedSpellTx } = await signSpellTransactions(
            proof.commit_tx,
            proof.spell_tx,
            {
              wallet: null, // Will use wallet-specific methods from window
              address: address, // Pass address for PSBT conversion
              utxo: utxos.length > 0 ? {
                txid: utxos[0].txid,
                vout: utxos[0].vout,
                amount: utxos[0].value,
                address: address,
              } : undefined,
            }
          );
          
          console.log('Transactions signed successfully!');
          toast.success('✅ Transactions signed! Broadcasting to network...');
          
          // Step 5: Broadcast transactions
          setTxStatus('broadcasting');
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
              image: imageUrl,
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
        } catch (signError: any) {
          setTxStatus('error');
          const errorMessage = signError.message || 'Signing failed';
          setTxError(errorMessage);
          
          if (errorMessage.includes('rejected') || errorMessage.includes('denied')) {
            toast.error('Transaction was rejected. Please try again and approve when prompted.');
          } else {
            toast.error(`Transaction signing failed: ${errorMessage}`);
            console.error('Signing error details:', signError);
            console.log('Commit TX (hex):', proof.commit_tx);
            console.log('Spell TX (hex):', proof.spell_tx);
          }
        }
      } else {
        setTxStatus('error');
        setTxError('Transactions not included in proof');
        toast.error('Proof generation failed - transactions not included in proof');
        console.error('Proof missing transactions:', proof);
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
