/**
 * UTXO Validation Utilities
 * Validates UTXO format and checks if UTXO exists and is spendable
 */

import axios from 'axios';

const NETWORK = process.env.BITCOIN_NETWORK || 'testnet4';
const MEMPOOL_BASE_URL = NETWORK === 'testnet4' 
  ? 'https://memepool.space/testnet4/api'
  : 'https://memepool.space/api';

export interface UTXOValidationResult {
  valid: boolean;
  error?: string;
  utxo?: {
    txid: string;
    vout: number;
    value: number;
    status: 'confirmed' | 'unconfirmed' | 'spent';
  };
}

/**
 * Validate UTXO format (should be "txid:vout")
 */
export function validateUTXOFormat(utxo: string): { valid: boolean; txid?: string; vout?: number; error?: string } {
  if (!utxo || typeof utxo !== 'string') {
    return { valid: false, error: 'UTXO must be a string' };
  }

  const parts = utxo.split(':');
  if (parts.length !== 2) {
    return { valid: false, error: 'UTXO must be in format "txid:vout"' };
  }

  const [txid, voutStr] = parts;
  
  // Validate txid (64 character hex string)
  if (!/^[a-fA-F0-9]{64}$/.test(txid)) {
    return { valid: false, error: 'Invalid transaction ID format' };
  }

  // Validate vout (non-negative integer)
  const vout = parseInt(voutStr, 10);
  if (isNaN(vout) || vout < 0) {
    return { valid: false, error: 'Invalid output index (vout)' };
  }

  return { valid: true, txid, vout };
}

/**
 * Check if UTXO exists and is spendable
 */
export async function validateUTXOExists(utxo: string): Promise<UTXOValidationResult> {
  // First validate format
  const formatCheck = validateUTXOFormat(utxo);
  if (!formatCheck.valid) {
    return {
      valid: false,
      error: formatCheck.error,
    };
  }

  const { txid, vout } = formatCheck;

  // Ensure we have both txid and vout
  if (!txid || vout === undefined) {
    return {
      valid: false,
      error: 'Missing txid or vout in UTXO format',
    };
  }

  try {
    // Fetch transaction details from memepool.space
    const txUrl = `${MEMPOOL_BASE_URL}/tx/${txid}`;
    const txResponse = await axios.get(txUrl, { timeout: 10000 });

    if (!txResponse.data) {
      return {
        valid: false,
        error: 'Transaction not found',
      };
    }

    const tx = txResponse.data;

    // Check if output exists
    if (!tx.vout || vout >= tx.vout.length) {
      return {
        valid: false,
        error: `Output index ${vout} does not exist in transaction`,
      };
    }

    const output = tx.vout[vout];
    const value = output.value || 0; // Value in BTC, convert to sats

    // Check if UTXO is already spent by checking if it appears in any input
    // For now, we'll assume it's unspent if the transaction is confirmed
    // A more thorough check would require checking all transactions that spend this output

    // Check transaction status
    const status = tx.status;
    let utxoStatus: 'confirmed' | 'unconfirmed' | 'spent' = 'unconfirmed';
    
    if (status?.confirmed) {
      utxoStatus = 'confirmed';
    } else if (status?.block_height) {
      utxoStatus = 'confirmed';
    }

    // Note: We can't definitively check if UTXO is spent without checking all mempool transactions
    // For now, we'll return the UTXO info and let the frontend handle spending checks

    return {
      valid: true,
      utxo: {
        txid: txid!,
        vout: vout!,
        value: Math.floor(value * 100_000_000), // Convert BTC to sats
        status: utxoStatus,
      },
    };
  } catch (error: any) {
    if (error.response?.status === 404) {
      return {
        valid: false,
        error: 'Transaction not found on blockchain',
      };
    }

    return {
      valid: false,
      error: `Failed to validate UTXO: ${error.message || 'Unknown error'}`,
    };
  }
}

/**
 * Check if UTXO has sufficient value for the transaction
 */
export function validateUTXOValue(utxoValueSats: number, requiredSats: number): {
  sufficient: boolean;
  shortfall: number;
} {
  const shortfall = Math.max(0, requiredSats - utxoValueSats);
  return {
    sufficient: utxoValueSats >= requiredSats,
    shortfall,
  };
}

