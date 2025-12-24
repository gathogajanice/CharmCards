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
 * Fetch UTXO details from mempool.space
 */
async function fetchUtxoDetails(
  txid: string,
  vout: number
): Promise<{ value: number; scriptPubKey: Buffer } | null> {
  try {
    const explorerUrl = NETWORK === 'testnet4'
      ? `https://mempool.space/testnet4/api/tx/${txid}`
      : `https://mempool.space/api/tx/${txid}`;
    
    const response = await fetch(explorerUrl, { cache: 'no-store' });
    if (!response.ok) {
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
    console.warn('Failed to fetch UTXO details:', error);
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
        // Fetch from mempool.space
        utxoInfo = await fetchUtxoDetails(txid, vout);
      }
      
      if (!utxoInfo) {
        throw new Error(`Failed to get UTXO details for input ${i} (txid: ${txid}, vout: ${vout})`);
      }
      
      // Determine if this is a SegWit (witness) transaction
      const isSegWit = input.witness && input.witness.length > 0;
      
      // For Taproot (P2TR) and SegWit transactions, use witnessUtxo
      // Charms uses Taproot, so we'll use witnessUtxo
      // Note: hashBuffer is already in internal byte order (as required by bitcoinjs-lib)
      
      try {
        // Try to get full transaction for nonWitnessUtxo (more reliable for some wallets)
        const explorerUrl = NETWORK === 'testnet4'
          ? `https://mempool.space/testnet4/api/tx/${txid}/hex`
          : `https://mempool.space/api/tx/${txid}/hex`;
        
        const response = await fetch(explorerUrl, { cache: 'no-store' });
        if (response.ok) {
          const prevTxHex = await response.text();
          psbt.addInput({
            hash: hashBuffer, // Use internal byte order hash
            index: vout,
            nonWitnessUtxo: Buffer.from(prevTxHex, 'hex'),
          });
        } else {
          // Fallback to witnessUtxo for SegWit/Taproot
          psbt.addInput({
            hash: hashBuffer, // Use internal byte order hash
            index: vout,
            witnessUtxo: {
              script: utxoInfo.scriptPubKey,
              value: utxoInfo.value,
            },
          });
        }
      } catch (error) {
        // Fallback to witnessUtxo (works for Taproot/SegWit)
        psbt.addInput({
          hash: hashBuffer, // Use internal byte order hash
          index: vout,
          witnessUtxo: {
            script: utxoInfo.scriptPubKey,
            value: utxoInfo.value,
          },
        });
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

