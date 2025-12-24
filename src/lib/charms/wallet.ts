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

// Cache for API responses to reduce redundant calls
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds cache

/**
 * Cached fetch utility to reduce API calls
 * Returns cached data if available and fresh, otherwise fetches new data
 */
async function cachedFetch(url: string, options?: RequestInit): Promise<Response> {
  const cacheKey = url; // Simple cache key based on URL
  const cached = apiCache.get(cacheKey);
  
  // Check if we have fresh cached data
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    // Return cached response
    return new Response(JSON.stringify(cached.data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // Fetch fresh data
  try {
    const response = await fetch(url, { ...options, cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      // Cache the response
      apiCache.set(cacheKey, { data, timestamp: Date.now() });
    }
    return response;
  } catch (error) {
    // If fetch fails but we have cached data, return it
    if (cached) {
      console.warn('Fetch failed, using cached data:', error);
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw error;
  }
}

/**
 * Get Charms assets for a wallet address
 * Based on: https://docs.charms.dev/guides/wallet-integration/visualization/
 * 
 * Scans UTXOs and extracts Charms by checking transaction outputs.
 * In production, use charms_lib.wasm for full extraction.
 */
export async function getWalletCharms(address: string): Promise<WalletCharms> {
  try {
    // 1. Fetch UTXOs for address
    const utxos = await getWalletUtxos(address, null);
    if (utxos.length === 0) {
      return { address, nfts: [], tokens: [] };
    }

    const nfts: CharmsAsset[] = [];
    const tokens: CharmsAsset[] = [];
    const processedTxids = new Set<string>();

    // 2. For each UTXO, fetch transaction data and check for Charms
    for (const utxo of utxos) {
      // Skip if we've already processed this transaction
      if (processedTxids.has(utxo.txid)) continue;
      processedTxids.add(utxo.txid);

      try {
        // Fetch transaction data from mempool.space
        const txUrl = NETWORK === 'testnet4'
          ? `https://mempool.space/testnet4/api/tx/${utxo.txid}`
          : `https://mempool.space/api/tx/${utxo.txid}`;
        
        const txResponse = await cachedFetch(txUrl);
        if (!txResponse.ok) continue;

        const tx = await txResponse.json();
        
        // Check if this transaction has Charms (spell transaction)
        // Charms transactions typically have Taproot outputs with witness data
        if (tx.vout && Array.isArray(tx.vout)) {
          for (const vout of tx.vout) {
            // Check if this output is to our address and might contain Charms
            if (vout.scriptpubkey_address === address || 
                (vout.scriptpubkey_type === 'v1_p2tr' && tx.vin && tx.vin.length > 0)) {
              
              // Try to extract Charm data from transaction
              // Look for gift card metadata in witness or other fields
              // This is a simplified extraction - full extraction requires WASM
              
              // Check if we can extract from localStorage (stored during minting)
              try {
                const txHistory = JSON.parse(localStorage.getItem('charmCardsTxHistory') || '[]');
                const mintTx = txHistory.find((h: any) => 
                  h.commitTxid === utxo.txid || h.spellTxid === utxo.txid
                );
                
                if (mintTx && mintTx.type === 'mint') {
                  // Try to fetch from API to get actual NFT data
                  // For now, construct from stored data
                  const appId = utxo.txid.substring(0, 16); // Simplified app_id
                  
                  // Check if this is an NFT (gift card)
                  const nftData = await tryExtractGiftCardFromUtxo(utxo, address);
                  if (nftData) {
                    nfts.push({
                      type: 'nft',
                      app_id: appId,
                      app_vk: appId, // Simplified
                      data: nftData,
                    });
                  }
                }
              } catch (e) {
                // Continue if localStorage parsing fails
              }
            }
          }
        }

        // Also check if we can get Charm data from API
        try {
          const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
          // The API might have a way to extract Charms, but for now we'll use localStorage
        } catch (e) {
          // API call failed, continue
        }
      } catch (error) {
        console.warn(`Failed to process UTXO ${utxo.txid}:${utxo.vout}:`, error);
        continue;
      }
    }

    // Also check localStorage for recently minted cards that might not be in UTXOs yet
    try {
      const txHistory = JSON.parse(localStorage.getItem('charmCardsTxHistory') || '[]');
      const recentMints = txHistory
        .filter((h: any) => h.type === 'mint' && Date.now() - h.timestamp < 300000) // Last 5 minutes
        .map((h: any) => {
          const appId = h.spellTxid?.substring(0, 16) || h.commitTxid?.substring(0, 16) || 'unknown';
          const brand = h.brand || 'Unknown';
          return {
            type: 'nft' as const,
            app_id: appId,
            app_vk: appId,
            data: {
              brand,
              image: h.image || getGiftCardImage(brand),
              initial_amount: Math.floor((h.amount || 0) * 100),
              remaining_balance: Math.floor((h.amount || 0) * 100),
              expiration_date: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
              created_at: Math.floor(h.timestamp / 1000),
            },
          };
        });
      
      // Merge with existing NFTs, avoiding duplicates
      for (const mint of recentMints) {
        if (!nfts.find(n => n.app_id === mint.app_id)) {
          nfts.push(mint);
        }
      }
    } catch (e) {
      console.warn('Failed to check localStorage for recent mints:', e);
    }

    return { address, nfts, tokens };
  } catch (error) {
    console.error('Failed to get wallet Charms:', error);
    return { address, nfts: [], tokens: [] };
  }
}

/**
 * Get gift card image URL from brand name
 * Maps brand names to their image URLs
 */
function getGiftCardImage(brand: string): string {
  // Map of brand names to image URLs
  const brandImages: Record<string, string> = {
    'Amazon.com': 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T002841.206-1766179817903.png?width=8000&height=8000&resize=contain',
    'DoorDash': 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/image-1766177180674.png',
    'Apple': 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/image-1766177192472.png',
    'Uber Eats': 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/image-1766177226936.png',
    'Uber': 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-13T134944.605-1766098833835.png?width=8000&height=8000&resize=contain',
    'Walmart': 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T005009.811-1766181015323.png?width=8000&height=8000&resize=contain',
    'Netflix': 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T010616.484-1766182009151.png?width=8000&height=8000&resize=contain',
    'Starbucks': 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T010825.448-1766182140763.png?width=8000&height=8000&resize=contain',
    'Nike': 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/Title-2025-12-20T004830.670-1766180915054.png?width=8000&height=8000&resize=contain',
    'Expedia': 'https://logos-world.net/wp-content/uploads/2021/08/Expedia-Logo.png',
  };
  
  return brandImages[brand] || '';
}

/**
 * Try to extract gift card NFT data from a UTXO
 * This is a simplified version - full extraction requires WASM module
 */
async function tryExtractGiftCardFromUtxo(
  utxo: { txid: string; vout: number; value: number },
  address: string
): Promise<any | null> {
  try {
    // Check localStorage for stored gift card data
    const txHistory = JSON.parse(localStorage.getItem('charmCardsTxHistory') || '[]');
    const relatedTx = txHistory.find((h: any) => 
      h.commitTxid === utxo.txid || h.spellTxid === utxo.txid
    );
    
    if (relatedTx && relatedTx.type === 'mint') {
      const brand = relatedTx.brand || 'Unknown';
      return {
        brand,
        image: relatedTx.image || getGiftCardImage(brand),
        initial_amount: Math.floor((relatedTx.amount || 0) * 100),
        remaining_balance: Math.floor((relatedTx.amount || 0) * 100),
        expiration_date: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
        created_at: Math.floor(relatedTx.timestamp / 1000),
      };
    }
    
    return null;
  } catch (e) {
    return null;
  }
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
    const response = await cachedFetch(explorerUrl);
    
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
        
        const balanceResponse = await cachedFetch(balanceUrl);
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

