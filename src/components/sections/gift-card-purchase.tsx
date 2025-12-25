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

  // Ensure wallet authorization when connected
  useEffect(() => {
    const ensureAuthorization = async () => {
      if (!address || !isConnected) {
        return;
      }

      try {
        // Import and call ensureWalletAuthorization to proactively authorize
        // This prevents the "source has not been authorized yet" error
        const { ensureWalletAuthorization } = await import('@/lib/charms/wallet');
        await ensureWalletAuthorization();
      } catch (error: any) {
        // Silently suppress ALL errors - authorization errors are expected
        // User will be prompted when they actually use the wallet
        // Don't log or show errors - this is normal behavior
        if (error.message?.includes('not authorized') || error.message?.includes('not been authorized')) {
          // Expected - do nothing
        } else {
          // Only log unexpected errors for debugging
          console.log('Authorization check (non-critical):', error.message || error);
        }
      }
    };

    ensureAuthorization();
  }, [address, isConnected]);

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
        
        // Handle different error types with user-friendly messages
        if (error.message?.includes('not authorized') || error.message?.includes('not been authorized')) {
          // Authorization error - try to request it silently
          try {
            const { ensureWalletAuthorization } = await import('@/lib/charms/wallet');
            await ensureWalletAuthorization();
            // Retry balance fetch after authorization
            const balance = await getWalletBalance(address, null);
            setWalletBalance(balance);
            setBalanceCheckError(null);
          } catch (authError) {
            // Silently ignore - user will be prompted when they use wallet
            setBalanceCheckError(null); // Don't show error for expected authorization issues
          }
        } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
          setBalanceCheckError('Cannot connect to wallet. Please ensure your wallet is unlocked and try again.');
        } else if (error.message?.includes('API server')) {
          setBalanceCheckError('API server error. Please ensure the API server is running on port 3001.');
        } else {
          // Generic error - show message but don't block user
          setBalanceCheckError('Unable to check balance. You can still proceed with minting.');
        }
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
      // We prioritize wallet's own UTXO methods, which don't have CORS issues
      let inUtxo: string | null = null;
      let utxos: Array<{ txid: string; vout: number; value: number }> = [];
      
      // Try to fetch UTXOs from wallet (no CORS issues)
      try {
        utxos = await getWalletUtxos(address, null);
        if (utxos.length > 0) {
          console.log(`Found ${utxos.length} UTXOs from wallet, using first one: ${utxos[0].txid}:${utxos[0].vout}`);
          inUtxo = `${utxos[0].txid}:${utxos[0].vout}`;
        } else {
          console.warn('No UTXOs found from wallet, but balance exists. Will try wallet methods again during PSBT conversion.');
          // We'll proceed anyway - the PSBT converter will try wallet methods again
          // and the wallet should be able to provide UTXO info during signing
        }
      } catch (utxoError: any) {
        console.warn('UTXO fetch from wallet failed, but balance exists. Proceeding:', utxoError);
        // Don't fail here - we have balance, so we can proceed
        // The wallet should be able to provide UTXO info when signing
      }

      // Step 3: Create spell and generate proof
      setTxStatus('generating-proof');
      toast.info('Creating spell and generating proof...');
      
      // If we don't have a UTXO yet, we need one for the Prover API
      // Try wallet methods one more time with a short delay
      if (!inUtxo) {
        console.log('No UTXO yet, retrying wallet methods...');
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          utxos = await getWalletUtxos(address, null);
          if (utxos.length > 0) {
            inUtxo = `${utxos[0].txid}:${utxos[0].vout}`;
            console.log(`Got UTXO on retry: ${inUtxo}`);
          }
        } catch (retryError) {
          console.warn('Retry also failed:', retryError);
        }
      }
      
      // If we still don't have a UTXO, we can't proceed - the Prover API requires it
      if (!inUtxo) {
        setTxStatus('error');
        const errorMsg = 'Unable to fetch UTXOs from wallet. This may be due to:\n1. Wallet not fully synced\n2. Recent transaction not yet confirmed\n3. Wallet API limitations\n\nPlease try:\n- Wait 1-2 minutes for network sync\n- Refresh the page and reconnect wallet\n- Ensure you have confirmed transactions';
        setTxError(errorMsg);
        toast.error('Unable to fetch UTXOs from wallet');
        toast.info('Your wallet shows a balance, but UTXO information is needed. Please wait for network sync or try reconnecting your wallet.');
        setIsMinting(false);
        return;
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
      
      // Step 4: Sign transactions (THIS IS WHERE WALLET POPUP SHOULD APPEAR)
      // The wallet popup will appear when signSpellTransactions is called below
      // This happens during the "Signing Transactions" / "Authorizing with your wallet" stage
      if (proof.commit_tx && proof.spell_tx) {
        try {
          setTxStatus('signing');
          
          // Detect which wallet is connected for better user messaging
          let walletName = 'your wallet';
          try {
            const { detectConnectedWallet } = await import('@/lib/charms/network');
            const detected = await detectConnectedWallet();
            if (detected) {
              walletName = detected.charAt(0).toUpperCase() + detected.slice(1);
            }
          } catch (e) {
            console.warn('Could not detect wallet name:', e);
          }
          
          toast.info(`🔄 Opening ${walletName} popup... Please approve the transaction in your wallet.`);
          console.log('🔐 About to sign transactions - wallet popup should appear now...');
          console.log(`📱 Detected wallet: ${walletName}`);
          
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
          const explorerBase = 'https://memepool.space/testnet4/tx/';
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
                    <span className="font-medium">
                      {formatSats(costBreakdown.estimatedFeesSats)}
                      {costBreakdown.network === 'testnet' && (
                        <span className="text-[10px] text-green-600 ml-1 font-normal">(affordable)</span>
                      )}
                    </span>
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
