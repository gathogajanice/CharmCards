/**
 * PSBT Conversion Utilities
 * Converts raw Bitcoin transaction hex to PSBT format for wallet signing
 * Based on: https://docs.charms.dev/guides/wallet-integration/transactions/signing/
 */

import * as bitcoin from 'bitcoinjs-lib';
import { Psbt } from 'bitcoinjs-lib';

const NETWORK = process.env.NEXT_PUBLIC_BITCOIN_NETWORK || 'testnet4';

// Testnet4 network configuration
const testnet4 = {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'tb',
  bip32: {
    public: 0x043587cf,
    private: 0x04358394,
  },
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef,
};

/**
 * Get Bitcoin network object based on network string
 */
function getNetwork(): bitcoin.Network {
  if (NETWORK === 'testnet4' || NETWORK === 'testnet') {
    return testnet4 as bitcoin.Network;
  }
  return bitcoin.networks.bitcoin;
}

/**
 * Fetch UTXO details from memepool.space
 * Note: This may fail due to CORS in browser - that's okay, wallet can provide info during signing
 */
async function fetchUtxoDetails(
  txid: string,
  vout: number
): Promise<{ value: number; scriptPubKey: Buffer } | null> {
  try {
    const explorerUrl = NETWORK === 'testnet4'
      ? `https://memepool.space/testnet4/api/tx/${txid}`
      : `https://memepool.space/api/tx/${txid}`;
    
    const response = await fetch(explorerUrl, { cache: 'no-store' });
    if (!response.ok) {
      // CORS or other error - return null, wallet will provide info during signing
      return null;
    }
    
    const tx = await response.json();
    if (!tx.vout || vout >= tx.vout.length) {
      return null;
    }
    
    const output = tx.vout[vout];
    return {
      value: output.value || 0,
      scriptPubKey: Buffer.from(output.scriptpubkey, 'hex'),
    };
  } catch (error) {
    // CORS or network error - that's okay, wallet can provide UTXO info during signing
    console.warn('Failed to fetch UTXO details (CORS may be blocking):', error);
    return null;
  }
}

/**
 * Convert raw transaction hex to PSBT format
 * This is required for wallet signing as wallets expect PSBT format
 */
export async function hexToPsbt(
  txHex: string,
  utxos?: Array<{ txid: string; vout: number; value: number; scriptPubKey?: string }>
): Promise<string> {
  try {
    const network = getNetwork();
    
    // Parse the raw transaction
    const tx = bitcoin.Transaction.fromHex(txHex);
    
    // Create a new PSBT
    const psbt = new Psbt({ network });
    
    // Add inputs with UTXO data
    for (let i = 0; i < tx.ins.length; i++) {
      const input = tx.ins[i];
      // Bitcoin transaction hashes in Transaction object are in internal byte order (reversed)
      // We need the normal txid for fetching UTXO details
      const hashBuffer = Buffer.from(input.hash);
      const txid = hashBuffer.reverse().toString('hex'); // Reverse to get normal txid for API calls
      const vout = input.index;
      
      // Try to get UTXO info from provided utxos array
      let utxoInfo: { value: number; scriptPubKey: Buffer } | null = null;
      
      if (utxos && utxos[i]) {
        const utxo = utxos[i];
        utxoInfo = {
          value: utxo.value,
          scriptPubKey: utxo.scriptPubKey 
            ? Buffer.from(utxo.scriptPubKey, 'hex')
            : Buffer.alloc(0),
        };
      } else {
        // Try to fetch from server-side proxy first (bypasses CORS)
        try {
          const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
          const txUrl = `${API_URL}/api/utxo/tx/${txid}`;
          const response = await fetch(txUrl, { cache: 'no-store' });
          if (response.ok) {
            const tx = await response.json();
            if (tx.vout && vout < tx.vout.length) {
              const output = tx.vout[vout];
              utxoInfo = {
                value: output.value || 0,
                scriptPubKey: Buffer.from(output.scriptpubkey, 'hex'),
              };
            }
          }
        } catch (proxyError) {
          console.warn('Server-side proxy failed, trying direct fetch:', proxyError);
        }
        
        // Fallback to direct fetch (may fail due to CORS)
        if (!utxoInfo) {
          utxoInfo = await fetchUtxoDetails(txid, vout);
        }
      }
      
      // If we can't get UTXO info, we can still create PSBT with minimal info
      // The wallet will fill in the missing details during signing
      if (!utxoInfo) {
        console.warn(`Could not fetch UTXO details for input ${i} (txid: ${txid}, vout: ${vout}). Wallet will provide info during signing.`);
        // Create minimal UTXO info - wallet will fill in the rest
        utxoInfo = {
          value: 0, // Will be filled by wallet
          scriptPubKey: Buffer.alloc(0), // Will be filled by wallet
        };
      }
      
      // Determine if this is a SegWit (witness) transaction
      const isSegWit = input.witness && input.witness.length > 0;
      
      // For Taproot (P2TR) and SegWit transactions, use witnessUtxo
      // Charms uses Taproot, so we'll use witnessUtxo
      // Note: hashBuffer is already in internal byte order (as required by bitcoinjs-lib)
      
      // For Taproot (Charms uses Taproot), use witnessUtxo
      // Even if we don't have full UTXO info, wallet can fill it in during signing
      // Skip trying to fetch full transaction (CORS issues) - wallet has the info
      if (isSegWit || utxoInfo.scriptPubKey.length === 0) {
        // Use witnessUtxo for Taproot/SegWit - wallet will provide scriptPubKey if missing
        psbt.addInput({
          hash: hashBuffer, // Use internal byte order hash
          index: vout,
          witnessUtxo: {
            script: utxoInfo.scriptPubKey.length > 0 ? utxoInfo.scriptPubKey : Buffer.alloc(0),
            value: utxoInfo.value || 0,
          },
        });
      } else {
        // For non-SegWit, try to get full transaction (but don't fail if CORS blocks)
        try {
          const explorerUrl = NETWORK === 'testnet4'
            ? `https://memepool.space/testnet4/api/tx/${txid}/hex`
            : `https://memepool.space/api/tx/${txid}/hex`;
          
          const response = await fetch(explorerUrl, { cache: 'no-store' });
          if (response.ok) {
            const prevTxHex = await response.text();
            psbt.addInput({
              hash: hashBuffer,
              index: vout,
              nonWitnessUtxo: Buffer.from(prevTxHex, 'hex'),
            });
          } else {
            // Fallback to witnessUtxo
            psbt.addInput({
              hash: hashBuffer,
              index: vout,
              witnessUtxo: {
                script: utxoInfo.scriptPubKey,
                value: utxoInfo.value,
              },
            });
          }
        } catch (error) {
          // CORS or other error - use witnessUtxo, wallet will fill in details
          console.warn('Could not fetch full transaction (CORS may block), using witnessUtxo:', error);
          psbt.addInput({
            hash: hashBuffer,
            index: vout,
            witnessUtxo: {
              script: utxoInfo.scriptPubKey,
              value: utxoInfo.value || 0,
            },
          });
        }
      }
    }
    
    // Add outputs
    for (let i = 0; i < tx.outs.length; i++) {
      const output = tx.outs[i];
      psbt.addOutput({
        script: output.script,
        value: output.value,
      });
    }
    
    // Return PSBT in base64 format (standard for wallet APIs)
    return psbt.toBase64();
  } catch (error: any) {
    console.error('Failed to convert hex to PSBT:', error);
    throw new Error(`PSBT conversion failed: ${error.message}`);
  }
}

/**
 * Extract signed transaction hex from signed PSBT
 */
export function psbtToHex(signedPsbtBase64: string): string {
  try {
    const network = getNetwork();
    const psbt = Psbt.fromBase64(signedPsbtBase64, { network });
    
    // Finalize all inputs
    psbt.finalizeAllInputs();
    
    // Extract the signed transaction
    const tx = psbt.extractTransaction();
    
    // Return as hex
    return tx.toHex();
  } catch (error: any) {
    console.error('Failed to extract hex from PSBT:', error);
    throw new Error(`PSBT extraction failed: ${error.message}`);
  }
}

/**
 * Convert hex to PSBT with UTXO info from wallet
 * This version tries to get UTXO info from the wallet first
 */
export async function hexToPsbtWithWalletUtxos(
  txHex: string,
  address: string
): Promise<string> {
  try {
    // Try to get UTXOs from wallet first
    let utxos: Array<{ txid: string; vout: number; value: number }> = [];
    
    if (typeof window !== 'undefined') {
      // Try Unisat
      if ((window as any).unisat && typeof (window as any).unisat.listUnspent === 'function') {
        try {
          const walletUtxos = await (window as any).unisat.listUnspent();
          if (walletUtxos && Array.isArray(walletUtxos)) {
            utxos = walletUtxos.map((utxo: any) => ({
              txid: utxo.txid || utxo.txId || utxo.tx_hash,
              vout: utxo.vout !== undefined ? utxo.vout : (utxo.outputIndex !== undefined ? utxo.outputIndex : 0),
              value: utxo.value || utxo.satoshis || utxo.amount || 0,
            }));
          }
        } catch (error) {
          console.warn('Failed to get UTXOs from Unisat:', error);
        }
      }
      
      // Try Xverse
      if (!utxos.length && (window as any).XverseProviders?.BitcoinProvider) {
        try {
          const xverse = (window as any).XverseProviders.BitcoinProvider;
          if (typeof xverse.getUtxos === 'function') {
            const walletUtxos = await xverse.getUtxos();
            if (walletUtxos && Array.isArray(walletUtxos)) {
              utxos = walletUtxos.map((utxo: any) => ({
                txid: utxo.txid || utxo.txId || utxo.tx_hash,
                vout: utxo.vout !== undefined ? utxo.vout : (utxo.outputIndex !== undefined ? utxo.outputIndex : 0),
                value: utxo.value || utxo.satoshis || utxo.amount || 0,
              }));
            }
          }
        } catch (error) {
          console.warn('Failed to get UTXOs from Xverse:', error);
        }
      }
      
      // Try Leather
      if (!utxos.length) {
        const leather = (window as any).btc || (window as any).hiroWalletProvider;
        if (leather) {
          try {
            if (typeof leather.getUtxos === 'function') {
              const walletUtxos = await leather.getUtxos();
              if (walletUtxos && Array.isArray(walletUtxos)) {
                utxos = walletUtxos.map((utxo: any) => ({
                  txid: utxo.txid || utxo.txId || utxo.tx_hash,
                  vout: utxo.vout !== undefined ? utxo.vout : (utxo.outputIndex !== undefined ? utxo.outputIndex : 0),
                  value: utxo.value || utxo.satoshis || utxo.amount || 0,
                }));
              }
            } else if (typeof leather.request === 'function') {
              const response = await leather.request('getUtxos', {});
              if (response && Array.isArray(response)) {
                utxos = response.map((utxo: any) => ({
                  txid: utxo.txid || utxo.txId || utxo.tx_hash,
                  vout: utxo.vout !== undefined ? utxo.vout : (utxo.outputIndex !== undefined ? utxo.outputIndex : 0),
                  value: utxo.value || utxo.satoshis || utxo.amount || 0,
                }));
              }
            }
          } catch (error) {
            console.warn('Failed to get UTXOs from Leather:', error);
          }
        }
      }
    }
    
    // Convert to PSBT (will fetch UTXO details if not provided)
    return await hexToPsbt(txHex, utxos);
  } catch (error: any) {
    console.error('Failed to convert hex to PSBT with wallet UTXOs:', error);
    throw error;
  }
}

