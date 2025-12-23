/**
 * Charms Wallet Integration
 * Handles wallet connection and Charms-specific operations
 * Based on: https://docs.charms.dev/guides/wallet-integration/transactions/
 */

import type { WalletCharms, CharmsAsset } from './types';
// Note: charms-wallet-js TransactionSigner requires PSBT format and mnemonic
// For browser wallets, we'll use wallet adapter methods when available
// import { TransactionSigner } from 'charms-wallet-js';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const NETWORK = process.env.NEXT_PUBLIC_BITCOIN_NETWORK || 'testnet4';

/**
 * Get Charms assets for a wallet address
 * Based on: https://docs.charms.dev/guides/wallet-integration/visualization/
 * 
 * This should scan UTXOs and extract Charms using charms_lib.wasm.
 * For now, returns empty structure - implement with WASM module in production.
 */
export async function getWalletCharms(address: string): Promise<WalletCharms> {
  // TODO: Implement full Charms extraction:
  // 1. Fetch UTXOs for address
  // 2. For each UTXO, fetch transaction data
  // 3. Use charms_lib.wasm to extract spells: wasm.extractAndVerifySpell(txJson, false)
  // 4. Parse spell data to extract NFT and token charms
  // 5. Return structured data
  
  // For now, return empty structure
  return {
    address,
    nfts: [],
    tokens: [],
  };
}

/**
 * Sign commit transaction (P2TR - Pay-to-Taproot)
 * Based on: https://docs.charms.dev/guides/wallet-integration/transactions/signing/
 * 
 * The commit transaction is a standard P2TR (Pay-to-Taproot) transaction.
 * It commits to the spell to be inscribed, creating a Taproot output spendable
 * by the spell transaction.
 * 
 * Attempts to sign using wallet-specific methods (Unisat, Xverse, Leather)
 * or falls back to manual signing instructions.
 */
export async function signCommitTransaction(
  commitTxHex: string,
  options: {
    wallet?: any; // Bitcoin wallet adapter from @reown/appkit
    mnemonic?: string; // Mnemonic for charms-wallet-js signing
    utxo?: { txid: string; vout: number; amount: number; address: string }; // UTXO being spent
  }
): Promise<string> {
  try {
    // Try wallet-specific signing methods
    if (typeof window !== 'undefined') {
      // Try Unisat wallet
      if ((window as any).unisat) {
        try {
          const unisat = (window as any).unisat;
          // Unisat uses signPsbt for PSBTs, but we have raw hex
          // Convert hex to PSBT or use signMessage/signPsbt if available
          if (typeof unisat.signPsbt === 'function') {
            // Note: This might need PSBT conversion first
            return await unisat.signPsbt(commitTxHex);
          }
        } catch (err: any) {
          console.warn('Unisat signing failed:', err);
        }
      }
      
      // Try Xverse wallet
      if ((window as any).XverseProviders?.BitcoinProvider) {
        try {
          const xverse = (window as any).XverseProviders.BitcoinProvider;
          if (typeof xverse.signPsbt === 'function') {
            return await xverse.signPsbt(commitTxHex);
          }
        } catch (err: any) {
          console.warn('Xverse signing failed:', err);
        }
      }
      
      // Try Leather wallet
      if ((window as any).btc) {
        try {
          const leather = (window as any).btc;
          if (typeof leather.signPsbt === 'function') {
            return await leather.signPsbt(commitTxHex);
          }
        } catch (err: any) {
          console.warn('Leather signing failed:', err);
        }
      }
    }
    
    // Fallback to wallet adapter if available
    if (options.wallet && typeof options.wallet.signTransaction === 'function') {
      const signedTx = await options.wallet.signTransaction(commitTxHex);
      return signedTx;
    }
    
    throw new Error('No signing method available. Wallet signing requires wallet-specific APIs or manual signing.');
  } catch (error: any) {
    throw new Error(`Failed to sign commit transaction: ${error.message}`);
  }
}

/**
 * Sign spell transaction
 * Based on: https://docs.charms.dev/guides/wallet-integration/transactions/signing/
 * 
 * The spell transaction spends the "spell commit output" created by the Commit Transaction.
 * The corresponding witness already contains the signature for spending this output.
 * The wallet needs to sign the rest of the transaction (other inputs/outputs if any).
 * 
 * Note: According to Charms docs, the spell transaction witness is already prepared
 * by the Prover API, so this may only need signing if there are additional inputs.
 */
export async function signSpellTransaction(
  spellTxHex: string,
  options: {
    wallet?: any; // Bitcoin wallet adapter from @reown/appkit
    mnemonic?: string; // Mnemonic for charms-wallet-js signing
    utxo?: { txid: string; vout: number; amount: number; address: string }; // UTXO being spent
  }
): Promise<string> {
  try {
    // Try wallet-specific signing methods (same as commit transaction)
    if (typeof window !== 'undefined') {
      // Try Unisat wallet
      if ((window as any).unisat) {
        try {
          const unisat = (window as any).unisat;
          if (typeof unisat.signPsbt === 'function') {
            return await unisat.signPsbt(spellTxHex);
          }
        } catch (err: any) {
          console.warn('Unisat signing failed:', err);
        }
      }
      
      // Try Xverse wallet
      if ((window as any).XverseProviders?.BitcoinProvider) {
        try {
          const xverse = (window as any).XverseProviders.BitcoinProvider;
          if (typeof xverse.signPsbt === 'function') {
            return await xverse.signPsbt(spellTxHex);
          }
        } catch (err: any) {
          console.warn('Xverse signing failed:', err);
        }
      }
      
      // Try Leather wallet
      if ((window as any).btc) {
        try {
          const leather = (window as any).btc;
          if (typeof leather.signPsbt === 'function') {
            return await leather.signPsbt(spellTxHex);
          }
        } catch (err: any) {
          console.warn('Leather signing failed:', err);
        }
      }
    }
    
    // Fallback to wallet adapter if available
    if (options.wallet && typeof options.wallet.signTransaction === 'function') {
      const signedTx = await options.wallet.signTransaction(spellTxHex);
      return signedTx;
    }
    
    // Note: Spell transaction may already be signed by Prover API
    // Return as-is if no additional signing needed
    return spellTxHex;
  } catch (error: any) {
    throw new Error(`Failed to sign spell transaction: ${error.message}`);
  }
}

/**
 * Sign both commit and spell transactions
 * Supports both charms-wallet-js (with mnemonic) and wallet adapter methods
 */
export async function signSpellTransactions(
  commitTxHex: string,
  spellTxHex: string,
  options: {
    wallet?: any; // Bitcoin wallet adapter from @reown/appkit
    mnemonic?: string; // Mnemonic for charms-wallet-js signing
    utxo?: { txid: string; vout: number; amount: number; address: string }; // UTXO being spent
  }
): Promise<{ commitTx: string; spellTx: string }> {
  const commitTx = await signCommitTransaction(commitTxHex, options);
  const spellTx = await signSpellTransaction(spellTxHex, options);
  
  return { commitTx, spellTx };
}

/**
 * Broadcast a signed transaction to Bitcoin Testnet4
 */
export async function broadcastTransaction(signedTxHex: string): Promise<string> {
  try {
    // Use mempool.space API for broadcasting to Testnet4
    const broadcastUrl = NETWORK === 'testnet4' 
      ? 'https://mempool.space/testnet4/api/tx'
      : 'https://mempool.space/api/tx';
    
    const response = await fetch(broadcastUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: signedTxHex,
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Broadcast failed: ${error}`);
    }
    
    const txid = await response.text();
    return txid.trim();
  } catch (error: any) {
    throw new Error(`Failed to broadcast transaction: ${error.message}`);
  }
}

/**
 * Broadcast both commit and spell transactions as a package
 * Based on: https://docs.charms.dev/guides/wallet-integration/transactions/broadcasting/
 * 
 * Transactions must be broadcast as a package to ensure atomicity.
 * The commit transaction creates the Taproot output that the spell transaction spends.
 */
export async function broadcastSpellTransactions(
  commitTxHex: string,
  spellTxHex: string
): Promise<{ commitTxid: string; spellTxid: string }> {
  try {
    // According to Charms docs, transactions should be broadcast as a package
    // Some Bitcoin nodes support package relay (BIP 330)
    // For now, we'll broadcast commit first, then spell immediately after
    // In production, use a Bitcoin node that supports package relay
    
    // Broadcast commit transaction first
    const commitTxid = await broadcastTransaction(commitTxHex);
    
    // Immediately broadcast spell transaction (don't wait for confirmation)
    // The spell transaction depends on the commit transaction being in mempool
    const spellTxid = await broadcastTransaction(spellTxHex);
    
    return { commitTxid, spellTxid };
  } catch (error: any) {
    throw new Error(`Failed to broadcast spell transactions: ${error.message}`);
  }
}

/**
 * Get wallet balance directly from wallet if available, otherwise from explorer
 */
export async function getWalletBalance(
  address: string,
  wallet?: any
): Promise<number | null> {
  if (typeof window === 'undefined') return null;

  try {
    // Try to get balance directly from wallet (Unisat, Xverse, etc.)
    if ((window as any).unisat && typeof (window as any).unisat.getBalance === 'function') {
      try {
        const balance = await (window as any).unisat.getBalance();
        console.log('Balance from Unisat wallet:', balance);
        // Unisat returns balance in BTC format
        if (typeof balance === 'number') {
          return balance;
        }
        if (typeof balance === 'string') {
          return parseFloat(balance);
        }
        if (balance && typeof balance.total === 'number') {
          return balance.total;
        }
        if (balance && typeof balance.confirmed === 'number') {
          return balance.confirmed;
        }
      } catch (error) {
        console.warn('Failed to get balance from Unisat:', error);
      }
    }

    // Try Xverse
    if ((window as any).XverseProviders?.BitcoinProvider) {
      const xverse = (window as any).XverseProviders.BitcoinProvider;
      if (typeof xverse.getBalance === 'function') {
        try {
          const balance = await xverse.getBalance();
          console.log('Balance from Xverse wallet:', balance);
          if (typeof balance === 'number') {
            return balance;
          }
          if (typeof balance === 'string') {
            return parseFloat(balance);
          }
        } catch (error) {
          console.warn('Failed to get balance from Xverse:', error);
        }
      }
    }

    // Try Leather
    if ((window as any).btc && typeof (window as any).btc.getBalance === 'function') {
      try {
        const balance = await (window as any).btc.getBalance();
        console.log('Balance from Leather wallet:', balance);
        if (typeof balance === 'number') {
          return balance;
        }
        if (typeof balance === 'string') {
          return parseFloat(balance);
        }
      } catch (error) {
        console.warn('Failed to get balance from Leather:', error);
      }
    }
  } catch (error) {
    console.warn('Failed to get balance from wallet:', error);
  }

  // Fallback: calculate from UTXOs
  const utxos = await getWalletUtxos(address, wallet);
  if (utxos.length > 0) {
    const totalSats = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
    return totalSats / 100000000;
  }

  return null;
}

/**
 * Get available UTXOs from connected wallet
 * Uses mempool.space API to fetch UTXOs for any Bitcoin address
 */
export async function getWalletUtxos(
  address: string,
  wallet: any // Optional wallet parameter (not currently used)
): Promise<Array<{ txid: string; vout: number; value: number }>> {
  try {
    // Use mempool.space API to fetch UTXOs
    // This works for any Bitcoin address on Testnet4
    const explorerUrl = NETWORK === 'testnet4'
      ? `https://mempool.space/testnet4/api/address/${address}/utxo`
      : `https://mempool.space/api/address/${address}/utxo`;
    
    console.log('Fetching UTXOs from:', explorerUrl);
    const response = await fetch(explorerUrl, {
      cache: 'no-store', // Always fetch fresh data
    });
    
    if (response.ok) {
      const utxos = await response.json();
      console.log(`Fetched ${utxos.length} UTXOs for address ${address}`);
      
      const mappedUtxos = utxos.map((utxo: any) => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
      }));
      
      // Also try to get address balance directly as a fallback
      try {
        const balanceUrl = NETWORK === 'testnet4'
          ? `https://mempool.space/testnet4/api/address/${address}`
          : `https://mempool.space/api/address/${address}`;
        
        const balanceResponse = await fetch(balanceUrl, { cache: 'no-store' });
        if (balanceResponse.ok) {
          const addressData = await balanceResponse.json();
          console.log('Address data from mempool:', addressData);
          
          // Log balance info for debugging
          if (addressData.chain_stats) {
            const confirmed = addressData.chain_stats.funded_txo_sum - addressData.chain_stats.spent_txo_sum;
            console.log('Confirmed balance (sats):', confirmed);
          }
          if (addressData.mempool_stats) {
            const unconfirmed = addressData.mempool_stats.funded_txo_sum - addressData.mempool_stats.spent_txo_sum;
            console.log('Unconfirmed balance (sats):', unconfirmed);
          }
        }
      } catch (balanceError) {
        console.warn('Failed to fetch address balance:', balanceError);
      }
      
      return mappedUtxos;
    } else {
      console.warn('Failed to fetch UTXOs:', response.status, response.statusText);
      const errorText = await response.text();
      console.warn('Error response:', errorText);
    }
  } catch (error) {
    console.error('Failed to fetch UTXOs from explorer:', error);
  }
  
  // Fallback: return empty array
  return [];
}

/**
 * Check if wallet supports Charms
 * Charms requires Bitcoin wallets with Taproot (P2TR) support
 */
export function supportsCharms(wallet: any): boolean {
  // Check if wallet is a Bitcoin wallet and supports transaction signing
  // Charms works with any Bitcoin wallet that supports Taproot
  return wallet && typeof wallet.signTransaction === 'function';
}

