"use client";

import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import { Bitcoin, Loader, RefreshCw } from 'lucide-react';
import { useCharms } from '@/hooks/use-charms';
import { useAppKitAccount, useAppKit } from '@reown/appkit/react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { getWalletUtxos, signSpellTransactions, broadcastSpellTransactions, getWalletBalance } from '@/lib/charms/wallet';
import { getTaprootAddress } from '@/lib/charms/taproot-address';

const NETWORK = process.env.NEXT_PUBLIC_BITCOIN_NETWORK || 'testnet4';
import { useNetworkCheck } from '@/hooks/use-network-check';
import NetworkSwitchModal from '@/components/ui/network-switch-modal';
import { calculateTotalCostSats, hasSufficientBalance, formatSats, satsToBtc, MIN_FEE_BUFFER_SATS } from '@/lib/charms/fees';
import { useEffect } from 'react';
import TransactionStatus, { TransactionStatus as TxStatus } from '@/components/ui/transaction-status';
import { useRefreshWalletData } from '@/hooks/use-wallet-data';
import MintSuccessModal from '@/components/ui/mint-success-modal';

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
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [commitTxid, setCommitTxid] = useState<string | undefined>();
  const [spellTxid, setSpellTxid] = useState<string | undefined>();
  const [txError, setTxError] = useState<string | undefined>();
  const [isRetryingUtxos, setIsRetryingUtxos] = useState(false);
  const [utxoRetryAttempt, setUtxoRetryAttempt] = useState(0);
  const [utxoErrorStartTime, setUtxoErrorStartTime] = useState<number | null>(null);
  
  const { address, isConnected } = useAppKitAccount();
  const { open: openWallet } = useAppKit();
  const { mintGiftCard, isLoading: charmsLoading, error: charmsError } = useCharms();
  const router = useRouter();
  const { refreshAll } = useRefreshWalletData();
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
  const fetchBalance = useCallback(async (forceRefresh: boolean = false) => {
    if (!address || !isConnected) {
      setWalletBalance(null);
      return;
    }

    try {
      // If forcing refresh, invalidate React Query cache first
      if (forceRefresh) {
        refreshAll(address);
        // Small delay to ensure cache is cleared
        await new Promise(resolve => setTimeout(resolve, 100));
      }

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
  }, [address, isConnected, refreshAll]);

  useEffect(() => {
    fetchBalance(false);
  }, [fetchBalance]);

  // Manual refresh handler
  const handleRefreshBalance = async () => {
    setIsRefreshingBalance(true);
    try {
      await fetchBalance(true);
      toast.success('Balance refreshed');
    } catch (error) {
      toast.error('Failed to refresh balance');
    } finally {
      setIsRefreshingBalance(false);
    }
  };

  // Auto-refresh balance on window focus (catches cases where user adds bitcoin in another tab)
  useEffect(() => {
    const handleFocus = () => {
      if (address && isConnected) {
        fetchBalance(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [address, isConnected, fetchBalance]);

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

  // Manual UTXO retry function
  const handleRetryUtxos = useCallback(async () => {
    if (!address || !isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsRetryingUtxos(true);
    setUtxoRetryAttempt(0);
    setTxError(undefined);
    
    const maxRetries = 5;
    const retryDelays = [10000, 12000, 15000, 15000, 15000]; // 10s, 12s, 15s, 15s, 15s
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      setUtxoRetryAttempt(attempt + 1);
      toast.info(`Retrying UTXO fetch... (${attempt + 1}/${maxRetries})`);
      
      try {
        const utxos = await getWalletUtxos(address, null);
        
        if (utxos.length > 0) {
          toast.success(`✅ Found ${utxos.length} UTXO${utxos.length > 1 ? 's' : ''}! You can now mint.`);
          setTxError(undefined);
          setUtxoErrorStartTime(null);
          setIsRetryingUtxos(false);
          setUtxoRetryAttempt(0);
          return;
        } else {
          if (attempt < maxRetries - 1) {
            const delay = retryDelays[attempt];
            console.log(`⏳ Waiting ${delay}ms before next retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      } catch (error: any) {
        console.warn(`UTXO retry attempt ${attempt + 1} failed:`, error.message);
        if (attempt < maxRetries - 1) {
          const delay = retryDelays[attempt];
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed
    const elapsedTime = utxoErrorStartTime 
      ? Math.floor((Date.now() - utxoErrorStartTime) / 1000)
      : 0;
    const elapsedStr = elapsedTime > 60 
      ? `${Math.floor(elapsedTime / 60)} minute${Math.floor(elapsedTime / 60) > 1 ? 's' : ''} and ${elapsedTime % 60} second${elapsedTime % 60 !== 1 ? 's' : ''}`
      : `${elapsedTime} second${elapsedTime !== 1 ? 's' : ''}`;
    
    toast.error(`UTXOs still not available after ${maxRetries} retries. Please wait longer and try again.`);
    setTxError(`UTXOs still not available after ${maxRetries} manual retries (${elapsedStr} total).\n\nPlease wait 1-2 minutes for network sync, then try again.`);
    setIsRetryingUtxos(false);
  }, [address, isConnected, utxoErrorStartTime]);

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
    setTxStatus('creating-spell');
    setTxError(undefined);
    setCommitTxid(undefined);
    setSpellTxid(undefined);
    
    try {
      // Step 1: Force fresh balance fetch with retry logic (bypass cache)
      // This ensures we have the latest balance after user adds bitcoin
      console.log('🔄 Forcing fresh balance fetch (bypassing cache)...');
      refreshAll(address);
      await new Promise(resolve => setTimeout(resolve, 200)); // Small delay for cache invalidation
      
      let currentBalance: number | null = null;
      let balanceRetries = 0;
      const maxBalanceRetries = 3;
      
      // Retry balance fetching with delays to handle network sync
      while (balanceRetries < maxBalanceRetries && currentBalance === null) {
        try {
          currentBalance = await getWalletBalance(address, null);
          if (currentBalance !== null) {
            console.log(`✅ Balance fetched successfully on attempt ${balanceRetries + 1}`);
            break;
          }
        } catch (balanceError: any) {
          console.warn(`Balance fetch attempt ${balanceRetries + 1} failed:`, balanceError.message);
        }
        
        if (currentBalance === null && balanceRetries < maxBalanceRetries - 1) {
          // Wait before retry with exponential backoff
          const delay = 1000 * (balanceRetries + 1);
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        balanceRetries++;
      }
      
      // If still no balance after retries, try one more time with longer delay
      if (currentBalance === null) {
        console.log('⏳ Final balance fetch attempt after network sync delay...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for network sync
        currentBalance = await getWalletBalance(address, null);
      }
      
      // Comprehensive balance debugging
      const balanceSats = currentBalance ? Math.floor(currentBalance * 100_000_000) : 0;
      const giftCardAmountUSD = giftCardAmountCents / 100;
      
      console.log('🔍 ===== BALANCE CHECK DEBUG =====');
      console.log('📊 Raw Balance Data:', {
        address,
        rawBalance: currentBalance,
        balanceType: currentBalance !== null ? (currentBalance > 1 ? 'Possibly Sats (needs conversion)' : 'Likely BTC') : 'null',
      });
      console.log('💵 Balance Values:', {
        balanceBTC: currentBalance,
        balanceSats: balanceSats,
        balanceFormatted: currentBalance ? `${currentBalance.toFixed(8)} BTC (${balanceSats.toLocaleString()} sats)` : 'null',
      });
      console.log('🎁 Gift Card Details:', {
        giftCardAmountUSD: `$${giftCardAmountUSD.toFixed(2)}`,
        giftCardAmountCents,
        quantity,
        totalAmount: `$${total.toFixed(2)}`,
      });
      
      // Validate balance format and value
      let validatedBalance: number = currentBalance;
      
      if (currentBalance === null || currentBalance === undefined) {
        console.error('❌ Balance Check Failed: Balance is null or undefined');
        setTxStatus('error');
        const errorMsg = `Unable to fetch wallet balance after ${maxBalanceRetries} attempts.\n\nPossible causes:\n• Wallet is not connected or unlocked\n• Wallet is still syncing with the network\n• Network connection issues\n\nPlease try:\n• Click the "Refresh" button above\n• Ensure your wallet is unlocked\n• Wait a few seconds and try again\n• Refresh the page and reconnect your wallet`;
        setTxError(errorMsg);
        toast.error('Unable to fetch wallet balance');
        toast.info('Please click Refresh or ensure your wallet is connected and unlocked.');
        setIsMinting(false);
        return;
      }
      
      if (isNaN(currentBalance) || !isFinite(currentBalance)) {
        console.error('❌ Balance Check Failed: Invalid balance value (NaN or Infinity)', currentBalance);
        setTxStatus('error');
        const errorMsg = `Invalid balance value detected: ${currentBalance}\n\nThis usually indicates a wallet connection issue.\n\nPlease try:\n• Click the "Refresh" button above\n• Disconnect and reconnect your wallet\n• Refresh the page\n• Try a different wallet if the issue persists`;
        setTxError(errorMsg);
        toast.error('Invalid balance value detected');
        toast.info('Please refresh or reconnect your wallet.');
        setIsMinting(false);
        return;
      }
      
      // Validate balance is in BTC format (should be <= 21M for mainnet, but testnet can be any reasonable value)
      // If balance is suspiciously large (> 21M), it might be in sats and needs conversion
      const MAX_REASONABLE_BTC = 21_000_000; // Max Bitcoin supply
      if (currentBalance > MAX_REASONABLE_BTC) {
        console.warn('⚠️ Balance seems too large for BTC, attempting conversion from sats');
        const convertedBalance = currentBalance / 100_000_000;
        console.log('🔄 Converted balance:', {
          original: currentBalance,
          converted: convertedBalance,
          originalSats: currentBalance,
          convertedBTC: convertedBalance,
        });
        
        if (convertedBalance <= MAX_REASONABLE_BTC && convertedBalance > 0) {
          // Use converted balance
          validatedBalance = convertedBalance;
          console.log('✅ Using converted balance:', validatedBalance);
        } else {
          console.error('❌ Balance Check Failed: Balance exceeds maximum reasonable value even after conversion');
          setTxStatus('error');
          setTxError('Invalid balance value. Please check your wallet.');
          toast.error('Invalid balance value. Please check your wallet.');
          setIsMinting(false);
          return;
        }
      } else if (currentBalance <= 0) {
        console.error('❌ Balance Check Failed: Zero or negative balance');
        setTxStatus('error');
        const errorMsg = `Your wallet balance is ${currentBalance <= 0 ? 'zero' : 'negative'}.\n\nTo mint a gift card, you need:\n• Testnet4 BTC in your wallet\n• Sufficient balance to cover the gift card amount + network fees\n\nPlease:\n• Use the Testnet Faucet to get free testnet bitcoin\n• Or transfer Testnet4 BTC to your wallet address\n• Then click "Refresh" to update your balance`;
        setTxError(errorMsg);
        toast.error('Insufficient balance');
        toast.info('Please fund your wallet with Testnet4 BTC. Use the faucet or transfer funds.');
        setIsMinting(false);
        return;
      }
      
      // Balance is valid, update state and use validated balance
      const validatedBalanceSats = Math.floor(validatedBalance * 100_000_000);
      console.log('✅ Balance validation passed:', {
        originalBalance: currentBalance,
        validatedBalanceBTC: validatedBalance,
        validatedBalanceSats: validatedBalanceSats,
        isValid: true,
      });
      setWalletBalance(validatedBalance);

      // Step 2: Check if balance is sufficient using the validated balance
      if (costBreakdown) {
        const balanceCheck = hasSufficientBalance(validatedBalance, giftCardAmountCents);
        
        console.log('💰 Balance Check Calculation:', {
          input: {
            walletBalanceBTC: validatedBalance,
            walletBalanceSats: validatedBalanceSats,
            giftCardAmountCents,
          },
          calculation: {
            giftCardSats: costBreakdown.giftCardSats,
            estimatedFeesSats: costBreakdown.estimatedFeesSats,
            feeBufferSats: MIN_FEE_BUFFER_SATS,
            totalRequiredSats: balanceCheck.requiredSats,
          },
          result: {
            availableSats: balanceCheck.availableSats,
            requiredSats: balanceCheck.requiredSats,
            shortfallSats: balanceCheck.shortfallSats,
            sufficient: balanceCheck.sufficient,
            percentage: balanceCheck.availableSats > 0 
              ? `${((balanceCheck.availableSats / balanceCheck.requiredSats) * 100).toFixed(2)}%` 
              : '0%',
          },
        });
        
        if (!balanceCheck.sufficient) {
          console.error('❌ Insufficient Balance Detected:', {
            available: `${formatSats(balanceCheck.availableSats)} (${balanceCheck.availableSats.toLocaleString()} sats)`,
            required: `${formatSats(balanceCheck.requiredSats)} (${balanceCheck.requiredSats.toLocaleString()} sats)`,
            shortfall: `${formatSats(balanceCheck.shortfallSats)} (${balanceCheck.shortfallSats.toLocaleString()} sats)`,
          });
          setTxStatus('error');
          const errorMsg = `Insufficient balance to mint this gift card.\n\nRequired: ${formatSats(balanceCheck.requiredSats)}\nAvailable: ${formatSats(balanceCheck.availableSats)}\nShortfall: ${formatSats(balanceCheck.shortfallSats)}\n\nThis includes:\n• Gift card amount: ${formatSats(costBreakdown.giftCardSats)}\n• Network fees: ${formatSats(costBreakdown.estimatedFeesSats)}\n• Safety buffer: ${formatSats(MIN_FEE_BUFFER_SATS)}\n\nPlease:\n• Add more Testnet4 BTC to your wallet\n• Or select a smaller gift card amount\n• Then click "Refresh" to update your balance`;
          setTxError(errorMsg);
          toast.error(`Insufficient balance. Need ${formatSats(balanceCheck.shortfallSats)} more.`);
          toast.info('Please add more funds or select a smaller amount.');
          setIsMinting(false);
          return;
        } else {
          console.log('✅ Balance Check Passed: Sufficient funds available');
        }
      }
      console.log('🔍 ===== END BALANCE CHECK =====');

      // Step 3: Fetch UTXOs with retry logic and exponential backoff
      // New UTXOs from recent transactions may not be immediately available
      console.log('🔄 Fetching UTXOs with retry logic...');
      const startTime = Date.now();
      let inUtxo: string | null = null;
      let utxos: Array<{ txid: string; vout: number; value: number }> = [];
      const maxUtxoRetries = 8; // Increased retries for UTXOs since they take longer to sync
      const delays = [2000, 4000, 6000, 8000, 10000, 12000, 15000, 20000]; // Longer delays: 2s, 4s, 6s, 8s, 10s, 12s, 15s, 20s
      let lastUtxoError: string | null = null;
      
      for (let attempt = 0; attempt < maxUtxoRetries; attempt++) {
        try {
          console.log(`📦 UTXO fetch attempt ${attempt + 1}/${maxUtxoRetries}...`);
          utxos = await getWalletUtxos(address, null);
          
          if (utxos.length > 0) {
            console.log(`✅ Found ${utxos.length} UTXOs on attempt ${attempt + 1}`);
            inUtxo = `${utxos[0].txid}:${utxos[0].vout}`;
            console.log(`Using UTXO: ${inUtxo}`);
            break;
          } else {
            console.warn(`⚠️ No UTXOs found on attempt ${attempt + 1}, but balance exists (${validatedBalance} BTC)`);
            lastUtxoError = 'No UTXOs found in response';
            
            // If we have balance but no UTXOs, wait for network sync
            if (attempt < maxUtxoRetries - 1) {
              const delay = delays[attempt];
              console.log(`⏳ Waiting ${delay}ms for network sync before retry...`);
              toast.info(`Waiting for network sync... (${attempt + 1}/${maxUtxoRetries - 1})`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        } catch (utxoError: any) {
          console.warn(`UTXO fetch attempt ${attempt + 1} failed:`, utxoError.message);
          lastUtxoError = utxoError.message || 'Unknown error';
          
          // If not the last attempt, wait and retry
          if (attempt < maxUtxoRetries - 1) {
            const delay = delays[attempt];
            console.log(`⏳ Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      // Final attempt with longer delay if still no UTXOs
      if (!inUtxo && validatedBalance > 0) {
        console.log('⏳ Final UTXO fetch attempt after extended network sync delay (30s)...');
        toast.info('Waiting for network sync to detect new UTXOs...');
        await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
        
        try {
          utxos = await getWalletUtxos(address, null);
          if (utxos.length > 0) {
            inUtxo = `${utxos[0].txid}:${utxos[0].vout}`;
            console.log(`✅ Got UTXO on final attempt: ${inUtxo}`);
          }
        } catch (finalError: any) {
          console.warn('Final UTXO fetch attempt failed:', finalError);
          lastUtxoError = finalError.message || 'Final attempt failed';
        }
      }
      
      // If we still don't have a UTXO, provide detailed error guidance
      if (!inUtxo) {
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        const elapsedMinutes = Math.floor(elapsedSeconds / 60);
        const elapsedTimeStr = elapsedMinutes > 0 
          ? `${elapsedMinutes} minute${elapsedMinutes > 1 ? 's' : ''} and ${elapsedSeconds % 60} second${elapsedSeconds % 60 !== 1 ? 's' : ''}`
          : `${elapsedSeconds} second${elapsedSeconds !== 1 ? 's' : ''}`;
        
        setTxStatus('error');
        setUtxoErrorStartTime(Date.now());
        let errorMsg = `Unable to fetch UTXOs from wallet after ${elapsedTimeStr}.\n\n`;
        errorMsg += `Your wallet shows a balance of ${formatSats(Math.floor(validatedBalance * 100_000_000))}, but UTXO information is not yet available.\n\n`;
        errorMsg += `This usually happens when:\n`;
        errorMsg += `1. You just added bitcoin and the network hasn't synced yet\n`;
        errorMsg += `2. Your wallet is still syncing with the blockchain\n`;
        errorMsg += `3. Recent transactions haven't been confirmed\n`;
        if (elapsedSeconds < 120) {
          errorMsg += `\n⏰ Your transaction is very recent (${elapsedTimeStr} ago). Please wait a bit longer for network sync.\n`;
        }
        if (lastUtxoError) {
          errorMsg += `\nLast error: ${lastUtxoError}\n`;
        }
        errorMsg += `\nPlease try:\n`;
        errorMsg += `• Click "Wait and Retry UTXOs" below to manually retry\n`;
        errorMsg += `• Click the "Refresh" button above and wait 10-30 seconds\n`;
        errorMsg += `• Wait 1-2 minutes for network sync, then try again\n`;
        errorMsg += `• Refresh the page and reconnect your wallet\n`;
        errorMsg += `• Ensure your transactions are confirmed (not pending)`;
        
        setTxError(errorMsg);
        toast.error('UTXOs not available yet');
        toast.info('If you just added bitcoin, please wait for network sync (10-30 seconds) and click Refresh, then try again.');
        setIsMinting(false);
        return;
      }

      // Step 4: Create spell and generate proof
      setTxStatus('generating-proof');
      toast.info('Creating spell and generating proof...');

      // Get Taproot address - Charms requires Taproot addresses
      // Note: If user has non-Taproot address, the TaprootAddressModal should have appeared on connection
      let taprootAddress: string;
      try {
        taprootAddress = await getTaprootAddress(address);
      } catch (taprootError: any) {
        setTxStatus('error');
        const errorMsg = taprootError.message || 'Failed to get Taproot address from wallet';
        setTxError(
          'Taproot address required. Please switch your wallet to use Taproot addresses. ' +
          'If you see a modal, follow the instructions there. Otherwise, check your wallet settings.'
        );
        toast.error('Taproot address required');
        toast.info('Please switch your wallet to Taproot address type to continue minting.');
        setIsMinting(false);
        return;
      }

      const { spell, proof } = await mintGiftCard({
        inUtxo: inUtxo!,
        recipientAddress: taprootAddress,
        brand: name,
        image: imageUrl,
        initialAmount: Math.floor(currentAmount * 100), // Convert to cents
        expirationDate: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year
      });

      toast.success('Spell created! Proof generated. Please approve the transaction in your wallet...');
      
      // Step 5: Sign transactions (THIS IS WHERE WALLET POPUP SHOULD APPEAR)
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
          
          // Generate app_id for matching with blockchain data
          const appId = await (async () => {
            try {
              const crypto = await import('crypto');
              return crypto.createHash('sha256').update(inUtxo!).digest('hex');
            } catch {
              // Fallback to using spellTxid prefix
              return spellTxid.substring(0, 32);
            }
          })();
          
          // Store in localStorage for transaction history with enhanced metadata
          const mintedCardData = {
            type: 'mint',
            brand: name,
            image: imageUrl,
            commitTxid,
            spellTxid,
            timestamp: Date.now(),
            amount: currentAmount,
            appId, // For matching with blockchain data
            recipientAddress: taprootAddress,
            initialAmount: Math.floor(currentAmount * 100), // In cents
            expirationDate: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year
            createdAt: Math.floor(Date.now() / 1000),
          };
          
          try {
            const txHistory = JSON.parse(localStorage.getItem('charmCardsTxHistory') || '[]');
            txHistory.push(mintedCardData);
            localStorage.setItem('charmCardsTxHistory', JSON.stringify(txHistory));
            
            // Also store in a separate key for easy access to new mints
            localStorage.setItem('lastMintedCard', JSON.stringify(mintedCardData));
          } catch (e) {
            console.warn('Failed to save transaction history:', e);
          }
          
          // Mark as success - modal will handle redirect
          setTxStatus('success');
          
          // Trigger refresh immediately
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('refreshWalletData'));
          }
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
                {/* Manual UTXO Retry Button - Show when error is UTXO-related */}
                {txStatus === 'error' && txError && txError.includes('Unable to fetch UTXOs') && (
                  <div className="mt-4 p-4 bg-background border border-border rounded-[12px]">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-[14px] font-semibold text-foreground mb-1">
                          UTXOs Not Available Yet
                        </p>
                        {utxoRetryAttempt > 0 && (
                          <p className="text-[12px] text-foreground/60">
                            Retry attempt {utxoRetryAttempt} in progress...
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={handleRetryUtxos}
                      disabled={isRetryingUtxos || !isConnected || !address}
                      className="w-full h-10 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isRetryingUtxos ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          <span>Retrying UTXOs...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          <span>Wait and Retry UTXOs</span>
                        </>
                      )}
                    </button>
                    {utxoErrorStartTime && (
                      <p className="mt-2 text-[11px] text-foreground/50 text-center">
                        Waiting since {Math.floor((Date.now() - utxoErrorStartTime) / 1000)}s ago
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Fee Breakdown */}
            {isConnected && currentAmount > 0 && costBreakdown && (
              <div className="mb-6 p-4 bg-background border border-border rounded-[12px]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[14px] font-semibold text-foreground">Cost Breakdown</h3>
                  <button
                    onClick={handleRefreshBalance}
                    disabled={isRefreshingBalance}
                    className="flex items-center gap-1.5 text-[12px] text-foreground/60 hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Refresh balance"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRefreshingBalance ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
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

      {/* Mint Success Modal */}
      <MintSuccessModal
        isOpen={txStatus === 'success' && !!commitTxid && !!spellTxid}
        onClose={() => {
          setTxStatus('idle');
          setCommitTxid(undefined);
          setSpellTxid(undefined);
        }}
        brand={name}
        image={imageUrl}
        amount={currentAmount}
        commitTxid={commitTxid || ''}
        spellTxid={spellTxid || ''}
        onViewWallet={() => {
          // Store new card info for wallet page
          if (commitTxid && spellTxid) {
            const newCardData = {
              brand: name,
              image: imageUrl,
              amount: currentAmount,
              commitTxid,
              spellTxid,
              timestamp: Date.now(),
            };
            // Store in sessionStorage for wallet page to pick up
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('newMintedCard', JSON.stringify(newCardData));
            }
          }
          router.push('/wallet');
        }}
        onMintAnother={() => {
          setTxStatus('idle');
          setCommitTxid(undefined);
          setSpellTxid(undefined);
          // Scroll to top to show purchase form again
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </section>
  );
}
