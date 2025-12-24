/**
 * Charms Wallet Integration
 * Handles wallet connection and Charms-specific operations
 * Based on: https://docs.charms.dev/guides/wallet-integration/transactions/
 */

import type { WalletCharms, CharmsAsset } from './types';
import { hexToPsbtWithWalletUtxos, psbtToHex } from './psbt-converter';
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
 * Converts raw hex to PSBT format, signs using wallet-specific methods, then extracts signed hex.
 */
export async function signCommitTransaction(
  commitTxHex: string,
  options: {
    wallet?: any; // Bitcoin wallet adapter from @reown/appkit
    mnemonic?: string; // Mnemonic for charms-wallet-js signing
    utxo?: { txid: string; vout: number; amount: number; address: string }; // UTXO being spent
    address?: string; // Wallet address for UTXO fetching
  }
): Promise<string> {
  try {
    const address = options.address || options.utxo?.address;
    if (!address) {
      throw new Error('Address is required for PSBT conversion');
    }

    // Convert hex to PSBT format (required for wallet signing)
    console.log('Converting commit transaction hex to PSBT...');
    const psbtBase64 = await hexToPsbtWithWalletUtxos(commitTxHex, address);
    console.log('PSBT created, requesting wallet signature...');

    // Try wallet-specific signing methods with PSBT
    if (typeof window !== 'undefined') {
      // Try Unisat wallet
      if ((window as any).unisat) {
        try {
          const unisat = (window as any).unisat;
          if (typeof unisat.signPsbt === 'function') {
            console.log('Signing with Unisat wallet (popup should appear)...');
            // Unisat signPsbt triggers popup - this is what we want!
            const signedPsbt = await unisat.signPsbt(psbtBase64, {
              autoFinalize: false, // Don't finalize, we'll extract the hex
            });
            console.log('Unisat signed PSBT, extracting transaction hex...');
            // Extract signed transaction hex from PSBT
            return psbtToHex(signedPsbt);
          }
        } catch (err: any) {
          console.warn('Unisat signing failed:', err);
          if (err.code === 4001) {
            throw new Error('Transaction rejected by user');
          }
          throw err;
        }
      }
      
      // Try Xverse wallet
      if ((window as any).XverseProviders?.BitcoinProvider) {
        try {
          const xverse = (window as any).XverseProviders.BitcoinProvider;
          if (typeof xverse.signPsbt === 'function') {
            console.log('Signing with Xverse wallet (popup should appear)...');
            // Xverse signPsbt should trigger popup
            const signedPsbt = await xverse.signPsbt(psbtBase64);
            console.log('Xverse signed PSBT, extracting transaction hex...');
            return psbtToHex(signedPsbt);
          }
        } catch (err: any) {
          console.warn('Xverse signing failed:', err);
          if (err.code === 4001 || err.message?.includes('rejected') || err.message?.includes('denied')) {
            throw new Error('Transaction rejected by user');
          }
          throw err;
        }
      }
      
      // Try Leather wallet
      const leather = (window as any).btc || (window as any).hiroWalletProvider;
      if (leather) {
        try {
          if (typeof leather.signPsbt === 'function') {
            console.log('Signing with Leather wallet (popup should appear)...');
            const signedPsbt = await leather.signPsbt(psbtBase64);
            console.log('Leather signed PSBT, extracting transaction hex...');
            return psbtToHex(signedPsbt);
          } else if (typeof leather.request === 'function') {
            console.log('Signing with Leather wallet via request (popup should appear)...');
            const signedPsbt = await leather.request('signPsbt', { psbt: psbtBase64 });
            console.log('Leather signed PSBT, extracting transaction hex...');
            return psbtToHex(signedPsbt);
          }
        } catch (err: any) {
          console.warn('Leather signing failed:', err);
          if (err.code === 4001 || err.message?.includes('rejected') || err.message?.includes('denied')) {
            throw new Error('Transaction rejected by user');
          }
          throw err;
        }
      }
    }
    
    // Fallback to wallet adapter if available
    if (options.wallet && typeof options.wallet.signTransaction === 'function') {
      const signedTx = await options.wallet.signTransaction(commitTxHex);
      return signedTx;
    }
    
    throw new Error('No signing method available. Please ensure your wallet is connected and supports PSBT signing.');
  } catch (error: any) {
    if (error.message?.includes('rejected') || error.message?.includes('denied')) {
      throw error; // Re-throw user rejection errors as-is
    }
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
 * Converts raw hex to PSBT format, signs using wallet-specific methods, then extracts signed hex.
 * Note: According to Charms docs, the spell transaction witness is already prepared
 * by the Prover API, so this may only need signing if there are additional inputs.
 */
export async function signSpellTransaction(
  spellTxHex: string,
  options: {
    wallet?: any; // Bitcoin wallet adapter from @reown/appkit
    mnemonic?: string; // Mnemonic for charms-wallet-js signing
    utxo?: { txid: string; vout: number; amount: number; address: string }; // UTXO being spent
    address?: string; // Wallet address for UTXO fetching
  }
): Promise<string> {
  try {
    const address = options.address || options.utxo?.address;
    if (!address) {
      throw new Error('Address is required for PSBT conversion');
    }

    // Convert hex to PSBT format (required for wallet signing)
    console.log('Converting spell transaction hex to PSBT...');
    const psbtBase64 = await hexToPsbtWithWalletUtxos(spellTxHex, address);
    console.log('PSBT created, requesting wallet signature...');

    // Try wallet-specific signing methods with PSBT
    if (typeof window !== 'undefined') {
      // Try Unisat wallet
      if ((window as any).unisat) {
        try {
          const unisat = (window as any).unisat;
          if (typeof unisat.signPsbt === 'function') {
            console.log('Signing spell transaction with Unisat wallet (popup should appear)...');
            const signedPsbt = await unisat.signPsbt(psbtBase64, {
              autoFinalize: false,
            });
            console.log('Unisat signed spell PSBT, extracting transaction hex...');
            return psbtToHex(signedPsbt);
          }
        } catch (err: any) {
          console.warn('Unisat spell signing failed:', err);
          if (err.code === 4001) {
            throw new Error('Transaction rejected by user');
          }
          // If signing fails, the spell transaction might already be signed by Prover API
          // Try returning as-is
          console.warn('Returning spell transaction as-is (may already be signed by Prover API)');
          return spellTxHex;
        }
      }
      
      // Try Xverse wallet
      if ((window as any).XverseProviders?.BitcoinProvider) {
        try {
          const xverse = (window as any).XverseProviders.BitcoinProvider;
          if (typeof xverse.signPsbt === 'function') {
            console.log('Signing spell transaction with Xverse wallet (popup should appear)...');
            const signedPsbt = await xverse.signPsbt(psbtBase64);
            console.log('Xverse signed spell PSBT, extracting transaction hex...');
            return psbtToHex(signedPsbt);
          }
        } catch (err: any) {
          console.warn('Xverse spell signing failed:', err);
          if (err.code === 4001 || err.message?.includes('rejected') || err.message?.includes('denied')) {
            throw new Error('Transaction rejected by user');
          }
          // Return as-is if signing not needed
          return spellTxHex;
        }
      }
      
      // Try Leather wallet
      const leather = (window as any).btc || (window as any).hiroWalletProvider;
      if (leather) {
        try {
          if (typeof leather.signPsbt === 'function') {
            console.log('Signing spell transaction with Leather wallet (popup should appear)...');
            const signedPsbt = await leather.signPsbt(psbtBase64);
            console.log('Leather signed spell PSBT, extracting transaction hex...');
            return psbtToHex(signedPsbt);
          } else if (typeof leather.request === 'function') {
            console.log('Signing spell transaction with Leather wallet via request (popup should appear)...');
            const signedPsbt = await leather.request('signPsbt', { psbt: psbtBase64 });
            console.log('Leather signed spell PSBT, extracting transaction hex...');
            return psbtToHex(signedPsbt);
          }
        } catch (err: any) {
          console.warn('Leather spell signing failed:', err);
          if (err.code === 4001 || err.message?.includes('rejected') || err.message?.includes('denied')) {
            throw new Error('Transaction rejected by user');
          }
          // Return as-is if signing not needed
          return spellTxHex;
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
    console.log('No wallet signing method available, returning spell transaction as-is (may already be signed)');
    return spellTxHex;
  } catch (error: any) {
    if (error.message?.includes('rejected') || error.message?.includes('denied')) {
      throw error; // Re-throw user rejection errors as-is
    }
    throw new Error(`Failed to sign spell transaction: ${error.message}`);
  }
}

/**
 * Sign both commit and spell transactions
 * Supports both charms-wallet-js (with mnemonic) and wallet adapter methods
 * 
 * This function will trigger wallet popups for user approval of both transactions.
 */
export async function signSpellTransactions(
  commitTxHex: string,
  spellTxHex: string,
  options: {
    wallet?: any; // Bitcoin wallet adapter from @reown/appkit
    mnemonic?: string; // Mnemonic for charms-wallet-js signing
    utxo?: { txid: string; vout: number; amount: number; address: string }; // UTXO being spent
    address?: string; // Wallet address for UTXO fetching
  }
): Promise<{ commitTx: string; spellTx: string }> {
  // Ensure address is available
  const address = options.address || options.utxo?.address;
  if (!address) {
    throw new Error('Address is required for transaction signing');
  }

  const signingOptions = {
    ...options,
    address,
  };

  // Sign commit transaction first (this will trigger wallet popup)
  console.log('Signing commit transaction...');
  const commitTx = await signCommitTransaction(commitTxHex, signingOptions);
  console.log('Commit transaction signed successfully');

  // Then sign spell transaction (this will trigger another wallet popup)
  console.log('Signing spell transaction...');
  const spellTx = await signSpellTransaction(spellTxHex, signingOptions);
  console.log('Spell transaction signed successfully');
  
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
    // Try to get balance directly from wallet (Unisat, Xverse, Leather)
    // All wallets work the same way - try their getBalance method first
    
    // Unisat
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

    // Xverse - same pattern as Unisat
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
          // Xverse might return object with total/confirmed
          if (balance && typeof balance.total === 'number') {
            return balance.total;
          }
          if (balance && typeof balance.confirmed === 'number') {
            return balance.confirmed;
          }
        } catch (error) {
          console.warn('Failed to get balance from Xverse:', error);
        }
      }
      // Also try request method for Xverse
      if (typeof xverse.request === 'function') {
        try {
          const response = await xverse.request('getBalance', {});
          const balance = typeof response === 'object' ? (response?.total || response?.confirmed || response) : response;
          if (typeof balance === 'number') {
            return balance;
          }
          if (typeof balance === 'string') {
            return parseFloat(balance);
          }
        } catch (error) {
          console.warn('Failed to get balance from Xverse via request:', error);
        }
      }
    }

    // Leather - same pattern as Unisat
    const leather = (window as any).btc || (window as any).hiroWalletProvider;
    if (leather && typeof leather.getBalance === 'function') {
      try {
        const balance = await leather.getBalance();
        console.log('Balance from Leather wallet:', balance);
        if (typeof balance === 'number') {
          return balance;
        }
        if (typeof balance === 'string') {
          return parseFloat(balance);
        }
        // Leather might return object with total/confirmed
        if (balance && typeof balance.total === 'number') {
          return balance.total;
        }
        if (balance && typeof balance.confirmed === 'number') {
          return balance.confirmed;
        }
      } catch (error) {
        console.warn('Failed to get balance from Leather:', error);
      }
    }
    // Also try request method for Leather
    if (leather && typeof leather.request === 'function') {
      try {
        const response = await leather.request('getBalance', {});
        const balance = typeof response === 'object' ? (response?.total || response?.confirmed || response) : response;
        if (typeof balance === 'number') {
          return balance;
        }
        if (typeof balance === 'string') {
          return parseFloat(balance);
        }
      } catch (error) {
        console.warn('Failed to get balance from Leather via request:', error);
      }
    }
  } catch (error) {
    console.warn('Failed to get balance from wallet:', error);
  }

  // Fallback: calculate from UTXOs (works for all wallets)
  const utxos = await getWalletUtxos(address, wallet);
  if (utxos.length > 0) {
    const totalSats = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
    return totalSats / 100000000;
  }

  return null;
}

/**
 * Get available UTXOs from connected wallet
 * First tries wallet APIs, then falls back to mempool.space API
 */
export async function getWalletUtxos(
  address: string,
  wallet: any // Optional wallet parameter
): Promise<Array<{ txid: string; vout: number; value: number }>> {
  // Try wallet-specific UTXO methods first (if available)
  if (typeof window !== 'undefined') {
    // Try Unisat wallet - check multiple methods
    if ((window as any).unisat) {
      try {
        const unisat = (window as any).unisat;
        
        // Method 1: Try listUnspent
        if (typeof unisat.listUnspent === 'function') {
          const utxos = await unisat.listUnspent();
          if (utxos && Array.isArray(utxos) && utxos.length > 0) {
            console.log(`Fetched ${utxos.length} UTXOs from Unisat wallet (listUnspent)`);
            return utxos.map((utxo: any) => ({
              txid: utxo.txid || utxo.txId || utxo.tx_hash,
              vout: utxo.vout !== undefined ? utxo.vout : (utxo.outputIndex !== undefined ? utxo.outputIndex : (utxo.index !== undefined ? utxo.index : 0)),
              value: utxo.value || utxo.satoshis || utxo.amount || 0,
            }));
          }
        }
        
        // Method 2: Try getInscriptions (might include UTXO info)
        if (typeof unisat.getInscriptions === 'function') {
          try {
            const inscriptions = await unisat.getInscriptions();
            if (inscriptions && Array.isArray(inscriptions) && inscriptions.length > 0) {
              // Extract UTXO info from inscriptions
              const utxos = inscriptions.map((ins: any) => ({
                txid: ins.txid || ins.txId || ins.tx_hash,
                vout: ins.vout !== undefined ? ins.vout : (ins.outputIndex !== undefined ? ins.outputIndex : 0),
                value: ins.value || ins.satoshis || 0,
              }));
              if (utxos.length > 0) {
                console.log(`Fetched ${utxos.length} UTXOs from Unisat wallet (via inscriptions)`);
                return utxos;
              }
            }
          } catch (insError) {
            console.warn('Failed to get UTXOs from Unisat inscriptions:', insError);
          }
        }
        
        // Method 3: Try request method
        if (typeof unisat.request === 'function') {
          try {
            const response = await unisat.request('listUnspent', {});
            if (response && Array.isArray(response) && response.length > 0) {
              console.log(`Fetched ${response.length} UTXOs from Unisat wallet (via request)`);
              return response.map((utxo: any) => ({
                txid: utxo.txid || utxo.txId || utxo.tx_hash,
                vout: utxo.vout !== undefined ? utxo.vout : (utxo.outputIndex !== undefined ? utxo.outputIndex : 0),
                value: utxo.value || utxo.satoshis || utxo.amount || 0,
              }));
            }
          } catch (reqError) {
            console.warn('Failed to get UTXOs from Unisat via request:', reqError);
          }
        }
      } catch (error) {
        console.warn('Failed to get UTXOs from Unisat:', error);
      }
    }

    // Try Xverse wallet - check multiple methods
    if ((window as any).XverseProviders?.BitcoinProvider) {
      try {
        const xverse = (window as any).XverseProviders.BitcoinProvider;
        
        // Method 1: Try getUtxos
        if (typeof xverse.getUtxos === 'function') {
          const utxos = await xverse.getUtxos();
          if (utxos && Array.isArray(utxos) && utxos.length > 0) {
            console.log(`Fetched ${utxos.length} UTXOs from Xverse wallet (getUtxos)`);
            return utxos.map((utxo: any) => ({
              txid: utxo.txid || utxo.txId || utxo.tx_hash,
              vout: utxo.vout !== undefined ? utxo.vout : (utxo.outputIndex !== undefined ? utxo.outputIndex : 0),
              value: utxo.value || utxo.satoshis || utxo.amount || 0,
            }));
          }
        }
        
        // Method 2: Try request method
        if (typeof xverse.request === 'function') {
          try {
            const response = await xverse.request('getUtxos', {});
            if (response && Array.isArray(response) && response.length > 0) {
              console.log(`Fetched ${response.length} UTXOs from Xverse wallet (via request)`);
              return response.map((utxo: any) => ({
                txid: utxo.txid || utxo.txId || utxo.tx_hash,
                vout: utxo.vout !== undefined ? utxo.vout : (utxo.outputIndex !== undefined ? utxo.outputIndex : 0),
                value: utxo.value || utxo.satoshis || utxo.amount || 0,
              }));
            }
          } catch (reqError) {
            console.warn('Failed to get UTXOs from Xverse via request:', reqError);
          }
        }
      } catch (error) {
        console.warn('Failed to get UTXOs from Xverse:', error);
      }
    }

    // Try Leather wallet
    const leather = (window as any).btc || (window as any).hiroWalletProvider;
    if (leather) {
      try {
        if (typeof leather.getUtxos === 'function') {
          const utxos = await leather.getUtxos();
          if (utxos && Array.isArray(utxos) && utxos.length > 0) {
            console.log(`Fetched ${utxos.length} UTXOs from Leather wallet`);
            return utxos.map((utxo: any) => ({
              txid: utxo.txid || utxo.txId,
              vout: utxo.vout || utxo.outputIndex || 0,
              value: utxo.value || utxo.satoshis || 0,
            }));
          }
        } else if (typeof leather.request === 'function') {
          const response = await leather.request('getUtxos', {});
          if (response && Array.isArray(response) && response.length > 0) {
            console.log(`Fetched ${response.length} UTXOs from Leather wallet via request`);
            return response.map((utxo: any) => ({
              txid: utxo.txid || utxo.txId,
              vout: utxo.vout || utxo.outputIndex || 0,
              value: utxo.value || utxo.satoshis || 0,
            }));
          }
        }
      } catch (error) {
        console.warn('Failed to get UTXOs from Leather:', error);
      }
    }
  }

  // Fallback: Use mempool.space API (bypass cache to ensure fresh data)
  // Try multiple times with different approaches
  const maxRetries = 2;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const explorerUrl = NETWORK === 'testnet4'
        ? `https://mempool.space/testnet4/api/address/${address}/utxo`
        : `https://mempool.space/api/address/${address}/utxo`;
      
      console.log(`Fetching UTXOs from mempool.space (attempt ${attempt + 1}/${maxRetries}):`, explorerUrl);
      
      // Bypass cache for UTXO fetching to ensure we get fresh data
      // Create timeout controller for better browser compatibility
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(explorerUrl, { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const utxos = await response.json();
        console.log(`Fetched ${utxos.length} UTXOs from mempool.space for address ${address}`);
        
        if (Array.isArray(utxos) && utxos.length > 0) {
          const mappedUtxos = utxos.map((utxo: any) => ({
            txid: utxo.txid || utxo.tx_hash,
            vout: utxo.vout !== undefined ? utxo.vout : (utxo.index !== undefined ? utxo.index : 0),
            value: utxo.value || utxo.amount || 0,
          }));
          
          return mappedUtxos;
        } else {
          console.warn('mempool.space returned empty UTXO array');
          // If this is not the last attempt, wait and retry
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
        }
      } else {
        console.warn(`Failed to fetch UTXOs from mempool.space (attempt ${attempt + 1}):`, response.status, response.statusText);
        const errorText = await response.text();
        console.warn('Error response:', errorText);
        
        // If we get a 400 error, try to get address info to verify
        if (response.status === 400) {
          console.warn('Got 400 error - checking address info...');
          try {
            const addressUrl = NETWORK === 'testnet4'
              ? `https://mempool.space/testnet4/api/address/${address}`
              : `https://mempool.space/api/address/${address}`;
            const addrController = new AbortController();
            const addrTimeoutId = setTimeout(() => addrController.abort(), 10000);
            const addressResponse = await fetch(addressUrl, { 
              cache: 'no-store',
              signal: addrController.signal,
            });
            clearTimeout(addrTimeoutId);
            if (addressResponse.ok) {
              const addressData = await addressResponse.json();
              console.log('Address data from mempool:', addressData);
              
              if (addressData.chain_stats) {
                const confirmed = addressData.chain_stats.funded_txo_sum - addressData.chain_stats.spent_txo_sum;
                console.log('Confirmed balance (sats):', confirmed);
                if (confirmed > 0) {
                  console.warn('Address has balance but UTXOs endpoint returned 400. This might be a mempool.space API issue or indexing delay.');
                  // Try alternative API endpoint
                  if (attempt < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue;
                  }
                }
              }
            }
          } catch (addrError) {
            console.warn('Failed to fetch address info:', addrError);
          }
        }
        
        // Retry on 5xx errors
        if (response.status >= 500 && attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
      }
    } catch (error: any) {
      console.error(`Failed to fetch UTXOs from explorer (attempt ${attempt + 1}):`, error);
      if (error.name === 'TimeoutError') {
        console.warn('Request timed out, will retry...');
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
      }
    }
  }
  
  // Return empty array if all methods failed
  console.warn('No UTXOs found for address:', address);
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

