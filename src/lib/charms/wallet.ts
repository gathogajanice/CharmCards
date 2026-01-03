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
        // Fetch transaction data from memepool.space
        const txUrl = NETWORK === 'testnet4'
          ? `https://memepool.space/testnet4/api/tx/${utxo.txid}`
          : `https://memepool.space/api/tx/${utxo.txid}`;
        
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
    // Extended duration: show cards from localStorage until blockchain confirms (or permanently if appId matches)
    try {
      const txHistory = JSON.parse(localStorage.getItem('charmCardsTxHistory') || '[]');
      const recentMints = txHistory
        .filter((h: any) => {
          if (h.type !== 'mint') return false;
          // Show if minted in last 24 hours OR if we have appId and it doesn't match any existing NFT
          const isRecent = Date.now() - h.timestamp < 24 * 60 * 60 * 1000; // Last 24 hours
          const hasAppId = h.appId && !nfts.find(n => n.app_id === h.appId);
          return isRecent || hasAppId;
        })
        .map((h: any) => {
          // Use appId from storage if available, otherwise generate from txid
          const appId = h.appId || h.spellTxid?.substring(0, 32) || h.commitTxid?.substring(0, 32) || 'unknown';
          const brand = h.brand || 'Unknown';
          return {
            type: 'nft' as const,
            app_id: appId,
            app_vk: appId,
            data: {
              brand,
              image: h.image || getGiftCardImage(brand),
              initial_amount: h.initialAmount || Math.floor((h.amount || 0) * 100),
              remaining_balance: h.initialAmount || Math.floor((h.amount || 0) * 100),
              expiration_date: h.expirationDate || Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
              created_at: h.createdAt || Math.floor(h.timestamp / 1000),
            },
            // Store transaction IDs for reference
            commitTxid: h.commitTxid,
            spellTxid: h.spellTxid,
          };
        });
      
      // Merge with existing NFTs, avoiding duplicates by app_id
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
    'Expedia': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Expedia_logo.svg/2560px-Expedia_logo.svg.png',
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
/**
 * Ensure wallet is authorized for the current origin
 * This explicitly requests authorization if not already granted
 * Exported so components can proactively check authorization on page load
 * 
 * Improved version that:
 * - Checks all wallets, not just the first one found
 * - Handles cases where extensions exist but aren't authorized yet
 * - Better error handling for edge cases
 * - Prevents "source has not been authorized yet" errors
 */
export async function ensureWalletAuthorization(): Promise<void> {
  if (typeof window === 'undefined') return;

  const authorizationPromises: Promise<void>[] = [];

  // Helper to check if error indicates authorization is needed
  const needsAuthorization = (error: any): boolean => {
    if (!error) return false;
    const message = error.message || error.toString() || '';
    return (
      message.includes('not authorized') ||
      message.includes('not been authorized') ||
      message.includes('not connected') ||
      error.code === 4001 || // User rejected
      error.code === -32002 // Request already pending
    );
  };

  // Check and request authorization for Unisat
  if ((window as any).unisat) {
    const unisat = (window as any).unisat;
    authorizationPromises.push(
      (async () => {
        try {
          // Try to get accounts - if this succeeds, wallet is already authorized
          const accounts = await unisat.getAccounts();
          if (accounts && accounts.length > 0) {
            // Wallet is authorized and has accounts
            return;
          }
        } catch (e: any) {
          // If getAccounts fails, check if it's an authorization error
          if (needsAuthorization(e)) {
            try {
              // Request authorization - this may trigger popup if user hasn't authorized
              // Note: This is non-blocking and won't show popup unless user interacts
              await unisat.requestAccounts();
            } catch (requestError: any) {
              // Silently handle - user may not have authorized yet, which is fine
              // The important thing is we've attempted authorization
              if (!needsAuthorization(requestError)) {
                console.debug('Unisat authorization check:', requestError.message || 'Unknown error');
              }
            }
          }
        }
      })()
    );
  }

  // Check and request authorization for Xverse
  const xverse = (window as any).XverseProviders?.BitcoinProvider || 
                 (window as any).XverseProviders ||
                 (window as any).xverse;
  if (xverse) {
    authorizationPromises.push(
      (async () => {
        try {
          if (typeof xverse.getAccounts === 'function') {
            const accounts = await xverse.getAccounts();
            if (accounts && accounts.length > 0) {
              // Wallet is authorized
              return;
            }
          }
        } catch (e: any) {
          if (needsAuthorization(e)) {
            try {
              // Try different methods to request authorization
              if (typeof xverse.request === 'function') {
                await xverse.request('getAccounts', {});
              } else if (typeof xverse.requestAccounts === 'function') {
                await xverse.requestAccounts();
              } else if (typeof xverse.getAccounts === 'function') {
                // Last resort - try getAccounts again
                await xverse.getAccounts();
              }
            } catch (requestError: any) {
              if (!needsAuthorization(requestError)) {
                console.debug('Xverse authorization check:', requestError.message || 'Unknown error');
              }
            }
          }
        }
      })()
    );
  }

  // Check and request authorization for Leather
  const leather = (window as any).btc || (window as any).hiroWalletProvider;
  if (leather) {
    authorizationPromises.push(
      (async () => {
        try {
          if (typeof leather.getAccounts === 'function') {
            const accounts = await leather.getAccounts();
            if (accounts && accounts.length > 0) {
              // Wallet is authorized
              return;
            }
          }
        } catch (e: any) {
          if (needsAuthorization(e)) {
            try {
              // Try different methods to request authorization
              if (typeof leather.request === 'function') {
                await leather.request('getAccounts', {});
              } else if (typeof leather.requestAccounts === 'function') {
                await leather.requestAccounts();
              } else if (typeof leather.getAccounts === 'function') {
                await leather.getAccounts();
              }
            } catch (requestError: any) {
              if (!needsAuthorization(requestError)) {
                console.debug('Leather authorization check:', requestError.message || 'Unknown error');
              }
            }
          }
        }
      })()
    );
  }

  // Execute all authorization checks in parallel
  // Don't throw errors - authorization failures are expected if user hasn't connected
  try {
    await Promise.allSettled(authorizationPromises);
  } catch (error) {
    // This should rarely happen, but if it does, it's not critical
    console.debug('Wallet authorization check completed with some errors (this is normal)');
  }
}

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
    // Ensure wallet is authorized before signing
    await ensureWalletAuthorization();

    const address = options.address || options.utxo?.address;
    if (!address) {
      throw new Error('Address is required for PSBT conversion');
    }

    // Convert hex to PSBT format (required for wallet signing)
    console.log('Converting commit transaction hex to PSBT...');
    let psbtBase64: string;
    try {
      psbtBase64 = await hexToPsbtWithWalletUtxos(commitTxHex, address);
      console.log('✅ PSBT created successfully');
      console.log(`📦 PSBT length: ${psbtBase64.length}, first 50 chars: ${psbtBase64.substring(0, 50)}`);
      
      // Validate PSBT format before sending to wallet
      try {
        const { Psbt } = await import('bitcoinjs-lib');
        const network = process.env.NEXT_PUBLIC_BITCOIN_NETWORK === 'testnet4' || process.env.NEXT_PUBLIC_BITCOIN_NETWORK === 'testnet'
          ? { messagePrefix: '\x18Bitcoin Signed Message:\n', bech32: 'tb', bip32: { public: 0x043587cf, private: 0x04358394 }, pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef }
          : require('bitcoinjs-lib').networks.bitcoin;
        Psbt.fromBase64(psbtBase64, { network });
        console.log('✅ PSBT format validated');
      } catch (validateError: any) {
        console.error('❌ PSBT validation failed:', validateError);
        throw new Error(`Invalid PSBT format: ${validateError.message}. Cannot send to wallet.`);
      }
      
      console.log('📱 Requesting wallet signature...');
    } catch (psbtError: any) {
      console.error('❌ PSBT conversion failed:', psbtError);
      throw new Error(`Failed to convert transaction to PSBT: ${psbtError.message}. Please ensure your wallet is connected and has UTXOs.`);
    }

    // Try wallet-specific signing methods with PSBT
    if (typeof window !== 'undefined') {
      // Try Unisat wallet
      if ((window as any).unisat) {
        try {
          const unisat = (window as any).unisat;
          if (typeof unisat.signPsbt === 'function') {
            console.log('🔐 Signing commit transaction with Unisat wallet...');
            console.log('📱 WALLET POPUP SHOULD APPEAR NOW - Please approve in your wallet');
            // Unisat signPsbt triggers popup - this is what we want!
            try {
              const signedResponse = await unisat.signPsbt(psbtBase64, {
                autoFinalize: false, // Don't finalize, we'll extract the hex
              });
              console.log('✅ Unisat signed commit PSBT');
              console.log(`📦 Response type: ${typeof signedResponse}`);
              console.log(`📦 Response:`, signedResponse);
              
              // Unisat might return an object or a string
              let signedPsbt: string;
              if (typeof signedResponse === 'string') {
                signedPsbt = signedResponse;
              } else if (signedResponse && typeof signedResponse === 'object') {
                // Check common property names
                signedPsbt = signedResponse.psbt || signedResponse.hex || signedResponse.txHex || 
                            signedResponse.signedPsbt || signedResponse.result || 
                            JSON.stringify(signedResponse);
                console.log(`📦 Extracted PSBT/hex from object: ${signedPsbt.substring(0, 100)}...`);
              } else {
                throw new Error(`Unexpected response format from Unisat: ${typeof signedResponse}`);
              }
              
              console.log(`📦 Signed PSBT/hex length: ${signedPsbt.length}`);
              console.log(`📦 First 100 chars: ${signedPsbt.substring(0, 100)}`);
              
              // Extract signed transaction hex from PSBT (or transaction hex if wallet returned it directly)
              return psbtToHex(signedPsbt);
            } catch (extractError: any) {
              // If extraction fails, try with autoFinalize: true (wallet might return hex directly)
              if (extractError.message?.includes('Invalid Magic Number') || extractError.message?.includes('PSBT extraction') || extractError.message?.includes('Invalid format')) {
                console.log('⚠️ PSBT extraction failed, trying with autoFinalize: true...');
                console.log(`   Error: ${extractError.message}`);
                try {
                  const signedResult = await unisat.signPsbt(psbtBase64, {
                    autoFinalize: true, // Let wallet finalize and return transaction hex
                  });
                  console.log('✅ Unisat signed with autoFinalize: true');
                  console.log(`📦 Result type: ${typeof signedResult}, value:`, signedResult);
                  
                  // Handle object response
                  let resultString: string;
                  if (typeof signedResult === 'string') {
                    resultString = signedResult;
                  } else if (signedResult && typeof signedResult === 'object') {
                    resultString = signedResult.psbt || signedResult.hex || signedResult.txHex || 
                                  signedResult.signedPsbt || signedResult.result || 
                                  JSON.stringify(signedResult);
                  } else {
                    throw new Error(`Unexpected response format: ${typeof signedResult}`);
                  }
                  
                  // If autoFinalize is true, Unisat should return a finalized transaction hex
                  // Check if it's already a transaction hex (not a PSBT)
                  const trimmedResult = resultString.trim();
                  const isHex = /^[0-9a-fA-F]+$/.test(trimmedResult);
                  
                  // If it looks like a transaction hex (starts with version bytes, not PSBT magic)
                  if (isHex && !trimmedResult.toLowerCase().startsWith('70736274ff') && trimmedResult.length > 200) {
                    try {
                      // Try to parse as transaction hex directly
                      const { Transaction } = await import('bitcoinjs-lib');
                      const network = process.env.NEXT_PUBLIC_BITCOIN_NETWORK === 'testnet4' || process.env.NEXT_PUBLIC_BITCOIN_NETWORK === 'testnet'
                        ? { messagePrefix: '\x18Bitcoin Signed Message:\n', bech32: 'tb', bip32: { public: 0x043587cf, private: 0x04358394 }, pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef }
                        : require('bitcoinjs-lib').networks.bitcoin;
                      const tx = Transaction.fromHex(trimmedResult);
                      console.log('✅ Unisat returned finalized transaction hex directly (autoFinalize: true)');
                      return trimmedResult;
                    } catch (txError) {
                      // Not a valid transaction hex, continue to PSBT parsing
                      console.log('   Not a valid transaction hex, trying PSBT format...');
                    }
                  }
                  
                  // Otherwise, try to extract from PSBT
                  return psbtToHex(resultString);
                } catch (retryError: any) {
                  console.error('❌ Retry with autoFinalize: true also failed:', retryError);
                  throw new Error(`PSBT extraction failed with both autoFinalize: false and true. Original error: ${extractError.message}, Retry error: ${retryError.message}`);
                }
              }
              throw extractError;
            }
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
            console.log('🔐 Signing commit transaction with Xverse wallet...');
            console.log('📱 WALLET POPUP SHOULD APPEAR NOW - Please approve in your wallet');
            // Xverse signPsbt should trigger popup
            const signedPsbt = await xverse.signPsbt(psbtBase64);
            console.log('✅ Xverse signed commit PSBT, extracting transaction hex...');
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
    
    // Provide helpful error message
    const walletDetected = (window as any).unisat ? 'Unisat' : 
                          (window as any).XverseProviders?.BitcoinProvider ? 'Xverse' :
                          (window as any).btc ? 'Leather' : 'No wallet';
    
    throw new Error(
      `No signing method available. Detected: ${walletDetected}. ` +
      `Please ensure your wallet is connected, unlocked, and supports PSBT signing. ` +
      `If using ${walletDetected}, try refreshing the page and reconnecting.`
    );
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
 * IMPORTANT: The spell transaction witness is PRE-SIGNED by the Prover API.
 * The Prover API includes a valid witness (signature + proof) for spending the "spell commit output"
 * created by the Commit Transaction. The wallet only needs to sign any ADDITIONAL inputs/outputs
 * that are not part of the spell commit output.
 * 
 * According to Charms documentation:
 * - The spell transaction spends the "spell commit output" created by the Commit Transaction
 * - The witness for this input already contains a valid signature for spending this output
 * - The wallet's role is to sign the remaining parts of the transaction (other inputs/outputs if any)
 * 
 * This function:
 * 1. Converts transaction hex to PSBT format (required for wallet signing)
 * 2. Attempts to sign using wallet-specific methods (Unisat, Xverse, Leather)
 * 3. If signing fails or is not needed, returns the transaction as-is (already signed by Prover API)
 * 
 * @param spellTxHex - The spell transaction hex from Prover API (may already be fully signed)
 * @param options - Signing options including wallet, address, and UTXO information
 * @returns Signed transaction hex (may be unchanged if already fully signed by Prover API)
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
    // Ensure wallet is authorized before signing
    await ensureWalletAuthorization();

    const address = options.address || options.utxo?.address;
    if (!address) {
      throw new Error('Address is required for PSBT conversion');
    }

    // Convert hex to PSBT format (required for wallet signing)
    // Note: The spell transaction witness is pre-signed by Prover API, but we still need
    // to convert to PSBT format to allow the wallet to sign any additional inputs/outputs
    console.log('Converting spell transaction hex to PSBT...');
    console.log('ℹ️ Note: Spell transaction witness is pre-signed by Prover API. Wallet will only sign additional inputs/outputs if needed.');
    let psbtBase64: string;
    try {
      psbtBase64 = await hexToPsbtWithWalletUtxos(spellTxHex, address);
      console.log('✅ PSBT created successfully, requesting wallet signature...');
    } catch (psbtError: any) {
      // PSBT conversion may fail if the transaction is already fully signed
      // This is expected behavior - the Prover API pre-signs the spell transaction witness
      console.warn('⚠️ PSBT conversion failed (this may be expected if transaction is already fully signed):', psbtError.message);
      console.log('ℹ️ Returning spell transaction as-is - Prover API has already signed the spell commit output witness');
      return spellTxHex;
    }

    // Try wallet-specific signing methods with PSBT
    if (typeof window !== 'undefined') {
      // Try Unisat wallet
      if ((window as any).unisat) {
        try {
          const unisat = (window as any).unisat;
          if (typeof unisat.signPsbt === 'function') {
            console.log('🔐 Signing spell transaction with Unisat wallet...');
            console.log('📱 WALLET POPUP SHOULD APPEAR NOW - Please approve in your wallet');
            const signedPsbt = await unisat.signPsbt(psbtBase64, {
              autoFinalize: false,
            });
            console.log('✅ Unisat signed spell PSBT, extracting transaction hex...');
            return psbtToHex(signedPsbt);
          }
        } catch (err: any) {
          console.warn('Unisat spell signing failed:', err);
          if (err.code === 4001) {
            throw new Error('Transaction rejected by user');
          }
          // If signing fails, the spell transaction witness is likely already fully signed by Prover API
          // This is expected - the Prover API pre-signs the spell commit output witness
          console.log('ℹ️ Returning spell transaction as-is - Prover API has already signed the spell commit output witness');
          return spellTxHex;
        }
      }
      
      // Try Xverse wallet
      if ((window as any).XverseProviders?.BitcoinProvider) {
        try {
          const xverse = (window as any).XverseProviders.BitcoinProvider;
          if (typeof xverse.signPsbt === 'function') {
            console.log('🔐 Signing spell transaction with Xverse wallet...');
            console.log('📱 WALLET POPUP SHOULD APPEAR NOW - Please approve in your wallet');
            const signedPsbt = await xverse.signPsbt(psbtBase64);
            console.log('✅ Xverse signed spell PSBT, extracting transaction hex...');
            return psbtToHex(signedPsbt);
          }
        } catch (err: any) {
          console.warn('Xverse spell signing failed:', err);
          if (err.code === 4001 || err.message?.includes('rejected') || err.message?.includes('denied')) {
            throw new Error('Transaction rejected by user');
          }
          // If signing fails, the spell transaction witness is likely already fully signed by Prover API
          console.log('ℹ️ Returning spell transaction as-is - Prover API has already signed the spell commit output witness');
          return spellTxHex;
        }
      }
      
      // Try Leather wallet
      const leather = (window as any).btc || (window as any).hiroWalletProvider;
      if (leather) {
        try {
          if (typeof leather.signPsbt === 'function') {
            console.log('🔐 Signing spell transaction with Leather wallet...');
            console.log('📱 WALLET POPUP SHOULD APPEAR NOW - Please approve in your wallet');
            const signedPsbt = await leather.signPsbt(psbtBase64);
            console.log('✅ Leather signed spell PSBT, extracting transaction hex...');
            return psbtToHex(signedPsbt);
          } else if (typeof leather.request === 'function') {
            console.log('🔐 Signing spell transaction with Leather wallet via request...');
            console.log('📱 WALLET POPUP SHOULD APPEAR NOW - Please approve in your wallet');
            const signedPsbt = await leather.request('signPsbt', { psbt: psbtBase64 });
            console.log('✅ Leather signed spell PSBT, extracting transaction hex...');
            return psbtToHex(signedPsbt);
          }
        } catch (err: any) {
          console.warn('Leather spell signing failed:', err);
          if (err.code === 4001 || err.message?.includes('rejected') || err.message?.includes('denied')) {
            throw new Error('Transaction rejected by user');
          }
          // If signing fails, the spell transaction witness is likely already fully signed by Prover API
          console.log('ℹ️ Returning spell transaction as-is - Prover API has already signed the spell commit output witness');
          return spellTxHex;
        }
      }
    }
    
    // Fallback to wallet adapter if available
    if (options.wallet && typeof options.wallet.signTransaction === 'function') {
      const signedTx = await options.wallet.signTransaction(spellTxHex);
      return signedTx;
    }
    
    // No wallet signing method available
    // This is expected - the spell transaction witness is pre-signed by Prover API
    // The Prover API includes a valid witness for spending the spell commit output
    console.log('ℹ️ No wallet signing method available for spell transaction');
    console.log('ℹ️ Returning spell transaction as-is - Prover API has already signed the spell commit output witness');
    
    // Check if wallet is detected but signing failed
    const walletDetected = (window as any).unisat ? 'Unisat' : 
                          (window as any).XverseProviders?.BitcoinProvider ? 'Xverse' :
                          (window as any).btc ? 'Leather' : null;
    
    if (walletDetected) {
      console.log(`ℹ️ ${walletDetected} detected but signPsbt() not available. This is expected - spell transaction witness is pre-signed by Prover API.`);
    }
    
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
  console.log('🔐 Step 1/2: Signing commit transaction...');
  console.log('📱 WALLET POPUP #1 SHOULD APPEAR NOW - Please approve the commit transaction');
  let commitTx: string;
  try {
    commitTx = await signCommitTransaction(commitTxHex, signingOptions);
    console.log('✅ Commit transaction signed successfully');
  } catch (commitError: any) {
    console.error('❌ Commit transaction signing failed:', commitError);
    if (commitError.message?.includes('rejected') || commitError.message?.includes('denied')) {
      throw new Error('Commit transaction was rejected by user. Please try again and approve when prompted.');
    }
    throw new Error(`Failed to sign commit transaction: ${commitError.message}`);
  }

  // Then sign spell transaction (this will trigger another wallet popup)
  console.log('🔐 Step 2/2: Signing spell transaction...');
  console.log('📱 WALLET POPUP #2 SHOULD APPEAR NOW - Please approve the spell transaction');
  let spellTx: string;
  try {
    spellTx = await signSpellTransaction(spellTxHex, signingOptions);
    console.log('✅ Spell transaction signed successfully');
  } catch (spellError: any) {
    console.error('❌ Spell transaction signing failed:', spellError);
    if (spellError.message?.includes('rejected') || spellError.message?.includes('denied')) {
      throw new Error('Spell transaction was rejected by user. Please try again and approve when prompted.');
    }
    // Spell transaction might already be signed by Prover API
    console.warn('⚠️ Using spell transaction as-is (may already be signed by Prover API)');
    spellTx = spellTxHex;
  }
  
  return { commitTx, spellTx };
}

/**
 * Validate transaction hex format
 * Checks that the hex string is valid and has minimum required length
 */
export function validateTransactionHex(hex: string): { valid: boolean; error?: string } {
  if (!hex || typeof hex !== 'string') {
    return { valid: false, error: 'Transaction hex must be a non-empty string' };
  }

  // Remove whitespace
  const trimmedHex = hex.trim();
  
  if (trimmedHex.length === 0) {
    return { valid: false, error: 'Transaction hex cannot be empty' };
  }

  // Check hex format (only 0-9, a-f, A-F)
  if (!/^[0-9a-fA-F]+$/.test(trimmedHex)) {
    return { valid: false, error: 'Transaction hex contains invalid characters' };
  }

  // Minimum transaction size check (rough estimate: at least 100 bytes = 200 hex chars)
  // A valid Bitcoin transaction should be at least this size
  if (trimmedHex.length < 200) {
    return { valid: false, error: 'Transaction hex appears too short to be a valid transaction' };
  }

  // Maximum reasonable size check (1MB block limit = ~2MB hex = 2,000,000 chars)
  if (trimmedHex.length > 2000000) {
    return { valid: false, error: 'Transaction hex appears too large' };
  }

  return { valid: true };
}

/**
 * Check if a transaction is accepted in the mempool
 * Returns true if transaction is found in mempool, false otherwise
 */
export async function checkTransactionInMempool(txid: string): Promise<boolean> {
  try {
    const mempoolUrl = NETWORK === 'testnet4'
      ? `https://memepool.space/testnet4/api/tx/${txid}`
      : `https://memepool.space/api/tx/${txid}`;
    
    const response = await fetch(mempoolUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (response.ok) {
      const tx = await response.json();
      // Transaction exists in mempool if we get a valid response
      return tx && tx.txid === txid;
    }

    // 404 means transaction not found in mempool
    if (response.status === 404) {
      return false;
    }

    // Other errors - log but don't throw
    console.warn(`Failed to check mempool for txid ${txid}: HTTP ${response.status}`);
    return false;
  } catch (error: any) {
    console.warn(`Error checking mempool for txid ${txid}:`, error.message);
    return false;
  }
}

/**
 * Wait for a transaction to be accepted into the mempool
 * Polls the mempool API until the transaction appears or timeout is reached
 * 
 * @param txid Transaction ID to check
 * @param timeoutMs Maximum time to wait in milliseconds (default: 30000 = 30 seconds)
 * @param pollIntervalMs Interval between polls in milliseconds (default: 1000 = 1 second)
 * @returns Promise that resolves to true if transaction is in mempool, false if timeout
 */
export async function waitForMempoolAcceptance(
  txid: string,
  timeoutMs: number = 30000,
  pollIntervalMs: number = 1000
): Promise<boolean> {
  const startTime = Date.now();
  const maxAttempts = Math.ceil(timeoutMs / pollIntervalMs);
  
  console.log(`Waiting for transaction ${txid} to appear in mempool (timeout: ${timeoutMs}ms)...`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const inMempool = await checkTransactionInMempool(txid);
    
    if (inMempool) {
      const elapsed = Date.now() - startTime;
      console.log(`✅ Transaction ${txid} accepted into mempool after ${elapsed}ms (attempt ${attempt})`);
      return true;
    }

    // Check if we've exceeded timeout
    if (Date.now() - startTime >= timeoutMs) {
      console.warn(`⏱️ Timeout waiting for transaction ${txid} to appear in mempool after ${timeoutMs}ms`);
      return false;
    }

    // Wait before next poll (except on last attempt)
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
  }

  console.warn(`⏱️ Transaction ${txid} not found in mempool after ${maxAttempts} attempts`);
  return false;
}

/**
 * Broadcast transaction via mempool.space API
 * Fallback method when wallet broadcasting fails
 * Uses POST https://mempool.space/testnet4/api/tx with { "rawtx": "<hex>" }
 */
async function broadcastTransactionViaMempoolSpace(signedTxHex: string): Promise<string | null> {
  try {
    const mempoolUrl = NETWORK === 'testnet4' 
      ? 'https://mempool.space/testnet4/api/tx'
      : 'https://mempool.space/api/tx';
    
    console.log('📤 Broadcasting transaction via mempool.space API...');
    const response = await fetch(mempoolUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rawtx: signedTxHex.trim() }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn('❌ Mempool.space broadcast failed:', response.status, errorText);
      return null;
    }

    const txid = await response.text();
    console.log('✅ Transaction broadcast via mempool.space, txid:', txid);
    return txid.trim();
  } catch (error: any) {
    console.warn('❌ Mempool.space broadcasting failed:', error.message);
    return null;
  }
}

/**
 * Broadcast transaction using wallet's built-in method
 * According to Charms docs: "Most wallet libraries offer methods for submitting transaction packages"
 * This is more direct and doesn't require third-party services
 */
async function broadcastTransactionViaWallet(signedTxHex: string): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null; // Not in browser environment
  }

  try {
    // Try Unisat wallet first
    if ((window as any).unisat) {
      const unisat = (window as any).unisat;
      
      // Try pushTx method (most common) - UniSat expects { rawtx: hex } format
      if (typeof unisat.pushTx === 'function') {
        console.log('📤 Broadcasting transaction via Unisat pushTx...');
        const txid = await unisat.pushTx({ rawtx: signedTxHex.trim() });
        console.log('✅ Transaction broadcast via Unisat pushTx, txid:', txid);
        return typeof txid === 'string' ? txid.trim() : String(txid).trim();
      }
    }

    // Try Xverse wallet
    if ((window as any).XverseProviders) {
      const xverse = (window as any).XverseProviders?.BitcoinProvider;
      if (xverse && typeof xverse.sendBitcoin === 'function') {
        console.log('📤 Broadcasting transaction via Xverse...');
        // Xverse might have different method signature
        try {
          const txid = await xverse.sendBitcoin(signedTxHex.trim());
          console.log('✅ Transaction broadcast via Xverse, txid:', txid);
          return typeof txid === 'string' ? txid.trim() : String(txid).trim();
        } catch (e) {
          console.warn('Xverse sendBitcoin failed, might not support raw hex:', e);
        }
      }
    }

    // Try Leather wallet
    if ((window as any).btc || (window as any).hiroWalletProvider) {
      const leather = (window as any).btc || (window as any).hiroWalletProvider;
      if (leather && typeof leather.sendTransaction === 'function') {
        console.log('📤 Broadcasting transaction via Leather...');
        try {
          const txid = await leather.sendTransaction(signedTxHex.trim());
          console.log('✅ Transaction broadcast via Leather, txid:', txid);
          return typeof txid === 'string' ? txid.trim() : String(txid).trim();
        } catch (e) {
          console.warn('Leather sendTransaction failed, might not support raw hex:', e);
        }
      }
    }

    return null; // No wallet method available
  } catch (error: any) {
    console.warn('Wallet broadcasting failed:', error.message);
    return null; // Return null to trigger fallback
  }
}

/**
 * Broadcast a signed transaction to Bitcoin Testnet4
 * Tries wallet's built-in method first, then falls back to server-side proxy
 * 
 * Validates transaction format before broadcasting as per Charms documentation:
 * https://docs.charms.dev/guides/wallet-integration/transactions/broadcasting/
 */
export async function broadcastTransaction(signedTxHex: string): Promise<string> {
  try {
    // Validate transaction hex format before broadcasting
    // Per Charms docs: "It is a good idea to validate the transactions before submitting them"
    const validation = validateTransactionHex(signedTxHex);
    if (!validation.valid) {
      throw new Error(`Transaction validation failed: ${validation.error}`);
    }

    // Step 1: Try wallet's built-in broadcasting method first
    // This is more direct and doesn't require third-party services
    console.log('🔍 Attempting to broadcast via wallet built-in method...');
    const walletTxid = await broadcastTransactionViaWallet(signedTxHex);
    
    if (walletTxid) {
      console.log('✅ Transaction broadcast successfully via wallet, txid:', walletTxid);
      return walletTxid;
    }

    // Step 2: Fallback to mempool.space API if wallet method unavailable
    console.log('⚠️ Wallet broadcasting not available, trying mempool.space API...');
    const mempoolTxid = await broadcastTransactionViaMempoolSpace(signedTxHex);
    
    if (mempoolTxid) {
      console.log('✅ Transaction broadcast successfully via mempool.space, txid:', mempoolTxid);
      return mempoolTxid;
    }

    // Step 3: Fallback to server-side proxy if wallet and mempool.space methods unavailable
    console.log('⚠️ Wallet and mempool.space broadcasting not available, falling back to server-side proxy...');
    const broadcastUrl = `${API_URL}/api/broadcast/tx`;
    
    console.log('Broadcasting transaction via server proxy:', broadcastUrl);
    
    const response = await fetch(broadcastUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: signedTxHex.trim(),
    });
    
    if (!response.ok) {
      let errorMessage: string;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || `Broadcast failed with status ${response.status}`;
      } catch {
        const errorText = await response.text();
        errorMessage = errorText || `Broadcast failed with status ${response.status}`;
      }
      console.error('Broadcast failed:', response.status, errorMessage);
      throw new Error(`Broadcast failed: ${errorMessage}`);
    }
    
    const txid = await response.text();
    const trimmedTxid = txid.trim();
    console.log('✅ Transaction broadcast successfully via server proxy, txid:', trimmedTxid);
    return trimmedTxid;
  } catch (error: any) {
    console.error('Broadcast error:', error);
    throw new Error(`Failed to broadcast transaction: ${error.message}`);
  }
}

/**
 * Broadcast both commit and spell transactions as a package
 * Based on: https://docs.charms.dev/guides/wallet-integration/transactions/broadcasting/
 * 
 * Transactions must be broadcast as a package to ensure atomicity.
 * The commit transaction creates the Taproot output that the spell transaction spends.
 * 
 * Per Charms documentation:
 * - Both transactions must be accepted into the mempool to ensure proper processing
 * - It is a good idea to validate the transactions before submitting them
 * - The commit transaction must be in mempool before the spell transaction can be accepted
 */
export async function broadcastSpellTransactions(
  commitTxHex: string,
  spellTxHex: string
): Promise<{ commitTxid: string; spellTxid: string }> {
  try {
    // Step 1: Validate both transactions before broadcasting
    // Per Charms docs: "It is a good idea to validate the transactions before submitting them"
    console.log('🔍 Validating commit transaction...');
    const commitValidation = validateTransactionHex(commitTxHex);
    if (!commitValidation.valid) {
      throw new Error(`Commit transaction validation failed: ${commitValidation.error}`);
    }

    console.log('🔍 Validating spell transaction...');
    const spellValidation = validateTransactionHex(spellTxHex);
    if (!spellValidation.valid) {
      throw new Error(`Spell transaction validation failed: ${spellValidation.error}`);
    }

    // Step 2: Try wallet-based broadcasting first, then fallback to server proxy
    // Per Charms docs: "Most wallet libraries offer methods for submitting transaction packages"
    console.log('📤 Attempting to broadcast transaction package via wallet...');
    
    let commitTxid: string;
    let spellTxid: string;
    let usedWallet = false;

    // Try wallet method for commit transaction
    const walletCommitTxid = await broadcastTransactionViaWallet(commitTxHex);
    
    if (walletCommitTxid) {
      commitTxid = walletCommitTxid;
      usedWallet = true;
      console.log(`✅ Commit transaction broadcast via wallet: ${commitTxid}`);
      
      // Wait for commit transaction to be accepted into mempool
      // Per Charms docs: "The commit transaction must be in mempool before the spell transaction can be accepted"
      console.log('⏳ Waiting for commit transaction to be accepted into mempool...');
      const commitAccepted = await waitForMempoolAcceptance(commitTxid, 30000, 1000);
      
      if (!commitAccepted) {
        console.warn(`⚠️ Warning: Commit transaction ${commitTxid} was not accepted into mempool within timeout`);
        console.warn('⚠️ Proceeding with spell broadcast anyway - it may fail if commit is not in mempool');
      } else {
        console.log(`✅ Commit transaction ${commitTxid} confirmed in mempool - safe to broadcast spell transaction`);
      }
      
      // Try wallet method for spell transaction (will fallback to mempool.space → server via broadcastTransaction)
      const walletSpellTxid = await broadcastTransactionViaWallet(spellTxHex);
      
      if (walletSpellTxid) {
        spellTxid = walletSpellTxid;
        console.log(`✅ Spell transaction broadcast via wallet: ${spellTxid}`);
        console.log(`✅ Package broadcast successful via wallet: commit=${commitTxid}, spell=${spellTxid}`);
      } else {
        // Commit was broadcast via wallet, but spell needs fallback (mempool.space → server)
        // broadcastTransaction already has the fallback chain: wallet → mempool.space → server
        console.log('⚠️ Spell transaction wallet broadcast not available, trying fallback chain...');
        spellTxid = await broadcastTransaction(spellTxHex);
        console.log(`✅ Package broadcast (mixed): commit=${commitTxid} (wallet), spell=${spellTxid}`);
      }
    } else {
      // Wallet method not available for commit, try mempool.space fallback
      console.log('⚠️ Commit transaction wallet broadcast not available, trying mempool.space...');
      const mempoolCommitTxid = await broadcastTransactionViaMempoolSpace(commitTxHex);
      
      if (mempoolCommitTxid) {
        commitTxid = mempoolCommitTxid;
        console.log(`✅ Commit transaction broadcast via mempool.space: ${commitTxid}`);
        
        // Wait for commit transaction to be accepted into mempool
        console.log('⏳ Waiting for commit transaction to be accepted into mempool...');
        const commitAccepted = await waitForMempoolAcceptance(commitTxid, 30000, 1000);
        
        if (!commitAccepted) {
          console.warn(`⚠️ Warning: Commit transaction ${commitTxid} was not accepted into mempool within timeout`);
          console.warn('⚠️ Proceeding with spell broadcast anyway - it may fail if commit is not in mempool');
        } else {
          console.log(`✅ Commit transaction ${commitTxid} confirmed in mempool - safe to broadcast spell transaction`);
        }
        
        // Broadcast spell transaction using fallback chain (wallet → mempool.space → server)
        spellTxid = await broadcastTransaction(spellTxHex);
        console.log(`✅ Package broadcast (mixed): commit=${commitTxid} (mempool.space), spell=${spellTxid}`);
      } else {
        // Wallet and mempool.space methods not available, use server-side proxy for package broadcasting
        console.log('⚠️ Wallet and mempool.space broadcasting not available, using server-side proxy for package...');
        
        // Validate UTXO from commit transaction before broadcasting
        // Extract input UTXO from commit transaction to check if it's from a pruned block
        try {
          const bitcoin = await import('bitcoinjs-lib');
          const network = (process.env.NEXT_PUBLIC_BITCOIN_NETWORK === 'testnet4' || process.env.NEXT_PUBLIC_BITCOIN_NETWORK === 'testnet')
            ? { messagePrefix: '\x18Bitcoin Signed Message:\n', bech32: 'tb', bip32: { public: 0x043587cf, private: 0x04358394 }, pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef }
            : bitcoin.networks.bitcoin;
          
          const commitTx = bitcoin.Transaction.fromHex(commitTxHex);
          if (commitTx.ins.length > 0) {
            const input = commitTx.ins[0];
            const hashBuffer = Buffer.from(input.hash);
            const txid = hashBuffer.reverse().toString('hex');
            const vout = input.index;
            const inputUtxo = `${txid}:${vout}`;
            
            console.log(`🔍 Validating input UTXO ${inputUtxo} before broadcasting...`);
            
            // Check if node is pruned and validate UTXO
            const NETWORK = process.env.NEXT_PUBLIC_BITCOIN_NETWORK || 'testnet4';
            const MEMEPOOL_BASE_URL = NETWORK === 'testnet4'
              ? 'https://memepool.space/testnet4'
              : 'https://memepool.space';
            
            // Get prune height from health endpoint
            const healthUrl = `${API_URL}/api/broadcast/health`;
            const healthResponse = await fetch(healthUrl, { cache: 'no-store' });
            if (healthResponse.ok) {
              const healthData = await healthResponse.json();
              const pruneHeight = healthData?.blockchain?.pruneHeight;
              
              if (pruneHeight) {
                // Check UTXO block height
                const txUrl = `${MEMEPOOL_BASE_URL}/api/tx/${txid}`;
                const txResponse = await fetch(txUrl, { signal: AbortSignal.timeout(5000) });
                
                if (txResponse.ok) {
                  const txData = await txResponse.json();
                  const blockHeight = txData?.status?.block_height;
                  
                  if (blockHeight !== undefined && blockHeight <= pruneHeight) {
                    throw new Error(`Cannot broadcast: UTXO ${inputUtxo} is from block ${blockHeight.toLocaleString()}, which is before the prune height (${pruneHeight.toLocaleString()}).\n\nThe node is PRUNED and only keeps blocks after ${pruneHeight.toLocaleString()}. It cannot verify UTXOs from older blocks.\n\nSOLUTION: Get a fresh UTXO from the faucet. New coins will be from recent blocks (after ${pruneHeight.toLocaleString()}) and will work with your pruned node.`);
                  }
                }
              }
            }
          }
        } catch (validationError: any) {
          if (validationError.message?.includes('Cannot broadcast')) {
            throw validationError; // Re-throw prune errors
          }
          console.warn(`⚠️ Could not validate UTXO before broadcast: ${validationError.message}`);
          // Continue anyway - the pre-transaction validation should have caught it
        }
        
        const packageUrl = `${API_URL}/api/broadcast/package`;
        
        const response = await fetch(packageUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            commitTx: commitTxHex.trim(),
            spellTx: spellTxHex.trim(),
          }),
        });

        if (!response.ok) {
          let errorMessage: string;
          let errorDetails: any = null;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || `Package broadcast failed with status ${response.status}`;
            errorDetails = errorData;
            console.error('Package broadcast failed - Full error response:', errorData);
          } catch {
            const errorText = await response.text();
            errorMessage = errorText || `Package broadcast failed with status ${response.status}`;
            console.error('Package broadcast failed - Error text:', errorText);
          }
          console.error('Package broadcast failed:', response.status, errorMessage);
          console.error('Error details:', errorDetails);
          
          // Include error details in the error message for better debugging
          const fullErrorMessage = errorDetails 
            ? `Failed to broadcast transaction package: ${errorMessage} (Status: ${response.status}, Type: ${errorDetails.errorType || 'unknown'}, Code: ${errorDetails.errorCode || 'none'})`
            : `Failed to broadcast transaction package: ${errorMessage}`;
          throw new Error(fullErrorMessage);
        }

        const result = await response.json();
        commitTxid = result.commitTxid;
        spellTxid = result.spellTxid;

        if (!commitTxid || !spellTxid) {
          throw new Error('Invalid response from package broadcast endpoint');
        }

        console.log(`✅ Package broadcast successful via server proxy: commit=${commitTxid}, spell=${spellTxid}`);
      }
    }

    // Step 3: Verify both transactions are in mempool (optional but recommended)
    // Per Charms docs: "Both transactions must be accepted into the mempool"
    console.log('🔍 Verifying both transactions are in mempool...');
    const commitInMempool = await checkTransactionInMempool(commitTxid);
    const spellInMempool = await checkTransactionInMempool(spellTxid);

    if (!commitInMempool) {
      console.warn(`⚠️ Warning: Commit transaction ${commitTxid} not found in mempool after broadcast`);
      // Wait a bit and check again
      console.log('⏳ Waiting for commit transaction to appear in mempool...');
      const commitAccepted = await waitForMempoolAcceptance(commitTxid, 10000, 500);
      if (!commitAccepted) {
        console.warn(`⚠️ Warning: Commit transaction ${commitTxid} still not found in mempool`);
      }
    }

    if (!spellInMempool) {
      // Wait a bit more for spell transaction to appear
      console.log('⏳ Waiting for spell transaction to appear in mempool...');
      const spellAccepted = await waitForMempoolAcceptance(spellTxid, 10000, 500);
      if (!spellAccepted) {
        console.warn(`⚠️ Warning: Spell transaction ${spellTxid} not found in mempool after broadcast`);
      }
    }

    const finalCommitCheck = await checkTransactionInMempool(commitTxid);
    const finalSpellCheck = await checkTransactionInMempool(spellTxid);

    if (finalCommitCheck && finalSpellCheck) {
      console.log('✅ Both transactions successfully accepted into mempool');
    } else {
      console.warn('⚠️ One or both transactions may not be in mempool. Please check transaction status.');
    }

    return { commitTxid, spellTxid };
  } catch (error: any) {
    console.error('❌ Failed to broadcast spell transactions:', error);
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
        console.log('🔍 Unisat Raw Balance Response:', {
          raw: balance,
          type: typeof balance,
          isObject: typeof balance === 'object' && balance !== null,
        });
        
        let balanceValue: number | null = null;
        
        if (typeof balance === 'number') {
          balanceValue = balance;
        } else if (typeof balance === 'string') {
          balanceValue = parseFloat(balance);
        } else if (balance && typeof balance.total === 'number') {
          balanceValue = balance.total;
        } else if (balance && typeof balance.confirmed === 'number') {
          balanceValue = balance.confirmed;
        }
        
        if (balanceValue !== null && !isNaN(balanceValue)) {
          console.log('🔍 Unisat Balance Detection:', {
            rawValue: balanceValue,
            possibleUnits: {
              asBTC: balanceValue,
              asSats: balanceValue,
            },
          });
          
          // Improved detection logic:
          // 1. If value is > 21,000,000, it's definitely in sats (max BTC supply)
          // 2. If value is between 1 and 21,000,000, check context:
          //    - Testnet: Usually small amounts (< 1 BTC), so > 1 likely means sats
          //    - Mainnet: Could be either, but > 1 is more likely BTC for larger wallets
          // 3. If value is <= 1, it's likely BTC (testnet balances are usually < 1 BTC)
          // 4. If value is >= 100,000,000, it's definitely in sats (1 BTC = 100M sats)
          
          const isTestnet = NETWORK === 'testnet4' || NETWORK === 'testnet';
          let detectedUnit: 'BTC' | 'sats' | 'unknown' = 'unknown';
          let finalBalance: number = balanceValue;
          
          if (balanceValue >= 100_000_000) {
            // Definitely in sats (>= 1 BTC worth of sats)
            detectedUnit = 'sats';
            finalBalance = balanceValue / 100_000_000;
            console.log('🔄 Unisat: Detected as SATS (>= 100M), converting to BTC');
          } else if (balanceValue > 21_000_000) {
            // Definitely in sats (exceeds max BTC supply)
            detectedUnit = 'sats';
            finalBalance = balanceValue / 100_000_000;
            console.log('🔄 Unisat: Detected as SATS (> 21M), converting to BTC');
          } else if (balanceValue > 1 && balanceValue <= 21_000_000) {
            // Ambiguous range - use heuristics
            if (isTestnet) {
              // Testnet: Usually small amounts, so > 1 likely means sats
              detectedUnit = 'sats';
              finalBalance = balanceValue / 100_000_000;
              console.log('🔄 Unisat: Testnet detected, treating as SATS (converting to BTC)');
            } else {
              // Mainnet: Could be either, but for values > 1 and < 21M, 
              // if it's a round number or > 10, more likely BTC
              // Otherwise, more likely sats
              if (balanceValue > 10 && balanceValue % 1 === 0) {
                // Round number > 10, could be BTC
                detectedUnit = 'BTC';
                finalBalance = balanceValue;
                console.log('✅ Unisat: Mainnet, treating as BTC (round number > 10)');
              } else {
                // More likely sats
                detectedUnit = 'sats';
                finalBalance = balanceValue / 100_000_000;
                console.log('🔄 Unisat: Mainnet, treating as SATS (converting to BTC)');
              }
            }
          } else {
            // <= 1, assume BTC
            detectedUnit = 'BTC';
            finalBalance = balanceValue;
            console.log('✅ Unisat: Treating as BTC (value <= 1)');
          }
          
          console.log('💰 Unisat Balance Final:', {
            original: balanceValue,
            detectedUnit,
            finalBTC: finalBalance,
            finalSats: Math.floor(finalBalance * 100_000_000),
            network: isTestnet ? 'testnet' : 'mainnet',
          });
          
          return finalBalance;
        }
      } catch (error: any) {
        // Silently handle Unisat errors - they're expected if wallet isn't authorized yet
        // Don't log as warning - this is normal behavior
        if (error.message?.includes('not authorized') || error.message?.includes('not been authorized')) {
          // Expected error - wallet not authorized yet, will be handled when user uses wallet
          // Don't throw or log - just continue to next method
        } else {
          console.warn('Failed to get balance from Unisat:', error.message || error);
        }
      }
    }

    // Xverse - same pattern as Unisat
    if ((window as any).XverseProviders?.BitcoinProvider) {
      const xverse = (window as any).XverseProviders.BitcoinProvider;
      if (typeof xverse.getBalance === 'function') {
        try {
          const balance = await xverse.getBalance();
          console.log('🔍 Xverse Raw Balance Response:', {
            raw: balance,
            type: typeof balance,
          });
          
          let balanceValue: number | null = null;
          
          if (typeof balance === 'number') {
            balanceValue = balance;
          } else if (typeof balance === 'string') {
            balanceValue = parseFloat(balance);
          } else if (balance && typeof balance.total === 'number') {
            balanceValue = balance.total;
          } else if (balance && typeof balance.confirmed === 'number') {
            balanceValue = balance.confirmed;
          }
          
          if (balanceValue !== null && !isNaN(balanceValue)) {
            const isTestnet = NETWORK === 'testnet4' || NETWORK === 'testnet';
            let finalBalance: number = balanceValue;
            
            // Apply same detection logic as Unisat
            if (balanceValue >= 100_000_000 || balanceValue > 21_000_000) {
              finalBalance = balanceValue / 100_000_000;
              console.log('🔄 Xverse: Converting from sats to BTC');
            } else if (balanceValue > 1 && isTestnet) {
              finalBalance = balanceValue / 100_000_000;
              console.log('🔄 Xverse: Testnet, converting from sats to BTC');
            } else {
              console.log('✅ Xverse: Treating as BTC');
            }
            
            console.log('💰 Xverse Balance Final:', {
              original: balanceValue,
              finalBTC: finalBalance,
              finalSats: Math.floor(finalBalance * 100_000_000),
            });
            
            return finalBalance;
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
        console.log('🔍 Leather Raw Balance Response:', {
          raw: balance,
          type: typeof balance,
        });
        
        let balanceValue: number | null = null;
        
        if (typeof balance === 'number') {
          balanceValue = balance;
        } else if (typeof balance === 'string') {
          balanceValue = parseFloat(balance);
        } else if (balance && typeof balance.total === 'number') {
          balanceValue = balance.total;
        } else if (balance && typeof balance.confirmed === 'number') {
          balanceValue = balance.confirmed;
        }
        
        if (balanceValue !== null && !isNaN(balanceValue)) {
          const isTestnet = NETWORK === 'testnet4' || NETWORK === 'testnet';
          let finalBalance: number = balanceValue;
          
          // Apply same detection logic as Unisat
          if (balanceValue >= 100_000_000 || balanceValue > 21_000_000) {
            finalBalance = balanceValue / 100_000_000;
            console.log('🔄 Leather: Converting from sats to BTC');
          } else if (balanceValue > 1 && isTestnet) {
            finalBalance = balanceValue / 100_000_000;
            console.log('🔄 Leather: Testnet, converting from sats to BTC');
          } else {
            console.log('✅ Leather: Treating as BTC');
          }
          
          console.log('💰 Leather Balance Final:', {
            original: balanceValue,
            finalBTC: finalBalance,
            finalSats: Math.floor(finalBalance * 100_000_000),
          });
          
          return finalBalance;
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
      } catch (error: any) {
        // Silently handle errors - they're expected if wallet isn't authorized yet
        if (error.message?.includes('not authorized') || error.message?.includes('not been authorized')) {
          // Expected error - don't log
        } else {
          console.warn('Failed to get balance from Leather via request:', error.message || error);
        }
      }
    }
  } catch (error: any) {
    // Handle errors gracefully - don't throw, just log
    // Authorization errors are expected and will be handled when user uses wallet
    if (error.message?.includes('not authorized') || error.message?.includes('not been authorized')) {
      // Expected error - don't log
    } else {
      console.warn('Failed to get balance from wallet:', error.message || error);
    }
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
 * First tries wallet APIs, then falls back to memepool.space API
 */
/**
 * Filter UTXOs to only include those that are already synced by the node
 * and optionally validate they belong to a specific address
 * 
 * @param utxos Array of UTXOs to filter
 * @param expectedAddress Optional address to validate UTXOs belong to
 * @param nodeBlocks Current block height of the node (if available)
 * @returns Filtered array of UTXOs that are synced and valid
 */
export async function filterSyncedUtxos(
  utxos: Array<{ txid: string; vout: number; value: number }>,
  expectedAddress?: string,
  nodeBlocks?: number,
  pruneHeight?: number
): Promise<{
  syncedUtxos: Array<{ txid: string; vout: number; value: number; blockHeight?: number; parentPruned?: boolean }>;
  unsyncedUtxos: Array<{ txid: string; vout: number; value: number; blockHeight?: number; blocksNeeded?: number }>;
  prunedUtxos: Array<{ txid: string; vout: number; value: number; blockHeight?: number; parentPruned?: boolean }>;
  unconfirmedUtxos: Array<{ txid: string; vout: number; value: number }>;
}> {
  const NETWORK = process.env.NEXT_PUBLIC_BITCOIN_NETWORK || 'testnet4';
  const MEMEPOOL_BASE_URL = NETWORK === 'testnet4'
    ? 'https://memepool.space/testnet4'
    : 'https://memepool.space';

  const syncedUtxos: Array<{ txid: string; vout: number; value: number; blockHeight?: number; parentPruned?: boolean }> = [];
  const unsyncedUtxos: Array<{ txid: string; vout: number; value: number; blockHeight?: number; blocksNeeded?: number }> = [];
  const prunedUtxos: Array<{ txid: string; vout: number; value: number; blockHeight?: number; parentPruned?: boolean }> = [];
  const unconfirmedUtxos: Array<{ txid: string; vout: number; value: number }> = [];

  // If no node blocks info, assume all are usable (will be checked later)
  const hasNodeInfo = nodeBlocks !== undefined && nodeBlocks > 0;
  const isPruned = pruneHeight !== undefined && pruneHeight > 0;
  
  console.log(`🔍 filterSyncedUtxos: Checking ${utxos.length} UTXOs`);
  console.log(`   Node blocks: ${nodeBlocks?.toLocaleString() || 'unknown'}`);
  console.log(`   Prune height: ${pruneHeight?.toLocaleString() || 'not pruned'}`);
  console.log(`   Is pruned: ${isPruned}`);

  for (const utxo of utxos) {
    try {
      // Fetch transaction details to get block height
      const txUrl = `${MEMEPOOL_BASE_URL}/api/tx/${utxo.txid}`;
      const response = await fetch(txUrl, { 
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (response.ok) {
        const txData = await response.json();
        const blockHeight = txData?.status?.block_height;
        
        if (blockHeight !== undefined) {
          // Transaction is confirmed
          
          // Check if UTXO transaction itself is from a pruned block
          const utxoIsPruned = isPruned && blockHeight <= pruneHeight!;
          
          // Check parent transactions (inputs) - Bitcoin Core needs to verify the entire chain
          // If any input's parent transaction is from a pruned block, the UTXO can't be verified
          let parentPruned = false;
          let parentBlockHeight: number | null = null;
          let parentCheckFailed = false;
          
          if (isPruned && txData.vin && txData.vin.length > 0) {
            // Check ALL parent transactions, not just the first one
            // If ANY parent is from a pruned block, the UTXO can't be verified
            // Check parents sequentially to avoid rate limiting, but stop at first pruned parent
            for (const input of txData.vin) {
              if (input.txid && !parentPruned) {
                try {
                  const parentTxUrl = `${MEMEPOOL_BASE_URL}/api/tx/${input.txid}`;
                  const parentResponse = await fetch(parentTxUrl, { 
                    signal: AbortSignal.timeout(3000) // Shorter timeout for parent check
                  });
                  
                  if (parentResponse.ok) {
                    const parentTxData = await parentResponse.json();
                    const pHeight = parentTxData?.status?.block_height ?? null;
                    
                    if (pHeight !== null && pHeight !== undefined && pHeight <= pruneHeight!) {
                      parentPruned = true;
                      parentBlockHeight = pHeight;
                      console.warn(`UTXO ${utxo.txid}:${utxo.vout}: Parent transaction ${input.txid} is from block ${pHeight}, which is before prune height ${pruneHeight}. Cannot be verified.`);
                      break; // Found pruned parent, no need to check others
                    } else if (pHeight !== null && pHeight !== undefined) {
                      // Track the first valid parent height for logging
                      if (parentBlockHeight === null) {
                        parentBlockHeight = pHeight;
                      }
                    }
                  } else {
                    // If we can't fetch parent and node is pruned, be conservative
                    // Mark as potentially pruned if we can't verify
                    console.warn(`Could not fetch parent transaction ${input.txid} for UTXO ${utxo.txid}:${utxo.vout} - cannot verify if pruned`);
                    parentCheckFailed = true;
                    // Continue checking other parents, but mark as failed
                  }
                } catch (parentError: any) {
                  console.warn(`Error checking parent transaction ${input.txid} for UTXO ${utxo.txid}:${utxo.vout}: ${parentError.message}`);
                  parentCheckFailed = true;
                  // Continue checking other parents
                }
              }
            }
            
            // If we couldn't verify all parents and node is pruned, be conservative
            // Reject UTXO if we can't verify parents (safer than allowing potentially pruned UTXO)
            if (parentCheckFailed && !parentPruned && isPruned) {
              console.warn(`UTXO ${utxo.txid}:${utxo.vout}: Could not verify all parent transactions. Rejecting as potentially pruned (node is pruned, cannot risk using unverified UTXO).`);
              parentPruned = true; // Mark as pruned to be safe
            }
          }
          
          // First check if UTXO is from a pruned block OR if parent is pruned
          if (utxoIsPruned || parentPruned) {
            // UTXO or its parent is from a pruned block - cannot be verified by pruned node
            prunedUtxos.push({ ...utxo, blockHeight, parentPruned });
            const reason = utxoIsPruned 
              ? `UTXO transaction is from block ${blockHeight}, which is before prune height ${pruneHeight}`
              : `Parent transaction is from block ${parentBlockHeight || 'unknown'}, which is before prune height ${pruneHeight}`;
            console.warn(`UTXO ${utxo.txid}:${utxo.vout}: ${reason}. Cannot be verified by pruned node.`);
          } else if (hasNodeInfo && nodeBlocks! >= blockHeight) {
            // Node has synced this block and it's not pruned - safe to use
            syncedUtxos.push({ ...utxo, blockHeight, parentPruned: false });
          } else if (hasNodeInfo) {
            // Node hasn't synced this block yet - will fail if used
            const blocksNeeded = blockHeight - nodeBlocks!;
            unsyncedUtxos.push({ 
              ...utxo, 
              blockHeight, 
              blocksNeeded
            });
            console.warn(`UTXO ${utxo.txid}:${utxo.vout} is from block ${blockHeight}, but node is at ${nodeBlocks} (needs ${blocksNeeded} more blocks)`);
          } else {
            // No node info available - assume it's usable but log warning
            // But still check prune height if available
            if (utxoIsPruned || parentPruned) {
              prunedUtxos.push({ ...utxo, blockHeight, parentPruned });
              const reason = utxoIsPruned 
                ? `UTXO transaction is from block ${blockHeight}, which is before prune height ${pruneHeight}`
                : `Parent transaction is from block ${parentBlockHeight}, which is before prune height ${pruneHeight}`;
              console.warn(`UTXO ${utxo.txid}:${utxo.vout}: ${reason}. Cannot be verified by pruned node.`);
            } else {
              syncedUtxos.push({ ...utxo, blockHeight, parentPruned: false });
              console.warn(`No node block info available - assuming UTXO ${utxo.txid}:${utxo.vout} from block ${blockHeight} is usable`);
            }
          }
        } else {
          // Transaction is unconfirmed
          // If node is pruned, be more conservative with unconfirmed UTXOs
          // They might have pruned parents that we can't verify
          if (isPruned) {
            console.warn(`UTXO ${utxo.txid}:${utxo.vout}: Transaction is unconfirmed. Node is pruned - cannot verify if parent is pruned. Being conservative and marking as potentially unusable.`);
            // For pruned nodes, we can't verify unconfirmed UTXOs have non-pruned parents
            // So we'll mark them separately - they can be used but with warning
            // The caller should prefer synced UTXOs over unconfirmed when pruned
            unconfirmedUtxos.push(utxo);
          } else {
            // Node is not pruned - unconfirmed UTXOs are fine
            unconfirmedUtxos.push(utxo);
          }
        }
      } else {
        // Transaction not found or error
        // If node is pruned, be conservative - might be from pruned block
        if (isPruned) {
          console.warn(`UTXO ${utxo.txid}:${utxo.vout}: Could not fetch transaction data. Node is pruned - cannot verify if from pruned block. Being conservative.`);
          // Mark as potentially pruned if we can't verify
          prunedUtxos.push({ ...utxo, blockHeight: undefined, parentPruned: true });
        } else {
          // Node not pruned - assume unconfirmed
          unconfirmedUtxos.push(utxo);
        }
      }
    } catch (error: any) {
      // If we can't check and node is pruned, be conservative
      if (isPruned) {
        console.warn(`Could not check UTXO ${utxo.txid}:${utxo.vout}: ${error.message}. Node is pruned - marking as potentially pruned to be safe.`);
        prunedUtxos.push({ ...utxo, blockHeight: undefined, parentPruned: true });
      } else {
        // Node not pruned - assume unconfirmed
        console.warn(`Could not check block height for UTXO ${utxo.txid}:${utxo.vout}:`, error.message);
        unconfirmedUtxos.push(utxo);
      }
    }
  }

  return { syncedUtxos, unsyncedUtxos, prunedUtxos, unconfirmedUtxos };
}

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
          try {
            const utxos = await unisat.listUnspent();
            console.log('Unisat listUnspent response:', utxos);
            if (utxos && Array.isArray(utxos) && utxos.length > 0) {
              console.log(`✅ Fetched ${utxos.length} UTXOs from Unisat wallet (listUnspent)`);
              return utxos.map((utxo: any) => ({
                txid: utxo.txid || utxo.txId || utxo.tx_hash,
                vout: utxo.vout !== undefined ? utxo.vout : (utxo.outputIndex !== undefined ? utxo.outputIndex : (utxo.index !== undefined ? utxo.index : 0)),
                value: utxo.value || utxo.satoshis || utxo.amount || 0,
              }));
            } else if (utxos && Array.isArray(utxos)) {
              console.warn('Unisat listUnspent returned empty array');
            }
          } catch (listError: any) {
            console.warn('Unisat listUnspent failed:', listError.message || listError);
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
          } catch (insError: any) {
            // Silently handle Unisat errors - they're expected if wallet isn't authorized yet
            if (insError.message?.includes('not authorized') || insError.message?.includes('not been authorized')) {
              // Expected error - don't log
            } else {
              console.warn('Failed to get UTXOs from Unisat inscriptions:', insError.message || insError);
            }
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
          try {
            const utxos = await xverse.getUtxos();
            console.log('Xverse getUtxos response:', utxos);
            if (utxos && Array.isArray(utxos) && utxos.length > 0) {
              console.log(`✅ Fetched ${utxos.length} UTXOs from Xverse wallet (getUtxos)`);
              return utxos.map((utxo: any) => ({
                txid: utxo.txid || utxo.txId || utxo.tx_hash,
                vout: utxo.vout !== undefined ? utxo.vout : (utxo.outputIndex !== undefined ? utxo.outputIndex : 0),
                value: utxo.value || utxo.satoshis || utxo.amount || 0,
              }));
            } else if (utxos && Array.isArray(utxos)) {
              console.warn('Xverse getUtxos returned empty array');
            }
          } catch (getError: any) {
            console.warn('Xverse getUtxos failed:', getError.message || getError);
          }
        }
        
        // Method 2: Try request method
        if (typeof xverse.request === 'function') {
          try {
            const response = await xverse.request('getUtxos', {});
            console.log('Xverse request("getUtxos") response:', response);
            if (response && Array.isArray(response) && response.length > 0) {
              console.log(`✅ Fetched ${response.length} UTXOs from Xverse wallet (via request)`);
              return response.map((utxo: any) => ({
                txid: utxo.txid || utxo.txId || utxo.tx_hash,
                vout: utxo.vout !== undefined ? utxo.vout : (utxo.outputIndex !== undefined ? utxo.outputIndex : 0),
                value: utxo.value || utxo.satoshis || utxo.amount || 0,
              }));
            } else if (response && Array.isArray(response)) {
              console.warn('Xverse request("getUtxos") returned empty array');
            }
          } catch (reqError: any) {
            console.warn('Failed to get UTXOs from Xverse via request:', reqError.message || reqError);
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
          try {
            const utxos = await leather.getUtxos();
            console.log('Leather getUtxos response:', utxos);
            if (utxos && Array.isArray(utxos) && utxos.length > 0) {
              console.log(`✅ Fetched ${utxos.length} UTXOs from Leather wallet`);
              return utxos.map((utxo: any) => ({
                txid: utxo.txid || utxo.txId,
                vout: utxo.vout || utxo.outputIndex || 0,
                value: utxo.value || utxo.satoshis || 0,
              }));
            } else if (utxos && Array.isArray(utxos)) {
              console.warn('Leather getUtxos returned empty array');
            }
          } catch (getError: any) {
            console.warn('Leather getUtxos failed:', getError.message || getError);
          }
        }
        if (typeof leather.request === 'function') {
          try {
            const response = await leather.request('getUtxos', {});
            console.log('Leather request("getUtxos") response:', response);
            if (response && Array.isArray(response) && response.length > 0) {
              console.log(`✅ Fetched ${response.length} UTXOs from Leather wallet via request`);
              return response.map((utxo: any) => ({
                txid: utxo.txid || utxo.txId,
                vout: utxo.vout || utxo.outputIndex || 0,
                value: utxo.value || utxo.satoshis || 0,
              }));
            } else if (response && Array.isArray(response)) {
              console.warn('Leather request("getUtxos") returned empty array');
            }
          } catch (reqError: any) {
            console.warn('Leather request("getUtxos") failed:', reqError.message || reqError);
          }
        }
      } catch (error) {
        console.warn('Failed to get UTXOs from Leather:', error);
      }
    }
  }

  // Fallback: Use server-side proxy to fetch UTXOs (bypasses CORS)
  // This is a last resort if wallet methods fail
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const proxyUrl = `${API_URL}/api/utxo/${address}`;
    
    console.log('Wallet UTXO methods failed, trying server-side proxy:', proxyUrl);
    
    const response = await fetch(proxyUrl, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (response.ok) {
      const utxos = await response.json();
      if (Array.isArray(utxos) && utxos.length > 0) {
        console.log(`✅ Fetched ${utxos.length} UTXOs via server-side proxy`);
        return utxos;
      }
    } else {
      console.warn('Server-side UTXO proxy failed:', response.status, response.statusText);
    }
  } catch (proxyError) {
    console.warn('Server-side UTXO proxy error:', proxyError);
  }
  
  // Return empty array if all methods failed
  console.warn('All UTXO fetching methods failed. Will rely on wallet methods during PSBT conversion.');
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

