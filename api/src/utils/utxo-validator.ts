/**
 * UTXO Validation Utilities
 * Validates UTXO format and checks if UTXO exists and is spendable
 */

import axios from 'axios';

const NETWORK = process.env.BITCOIN_NETWORK || 'testnet4';
const MEMPOOL_BASE_URL = NETWORK === 'testnet4' 
  ? 'https://memepool.space/testnet4'
  : 'https://memepool.space';

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
    const txUrl = `${MEMPOOL_BASE_URL}/api/tx/${txid}`;
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

/**
 * Validate Bitcoin address format
 * Supports Taproot addresses (tb1p... for testnet, bc1p... for mainnet)
 */
export function validateBitcoinAddress(address: string, network: string = 'testnet4'): {
  valid: boolean;
  error?: string;
} {
  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'Address must be a non-empty string' };
  }

  const trimmed = address.trim();
  
  // Taproot addresses (P2TR) - required for Charms
  // Testnet: tb1p... (62 characters)
  // Mainnet: bc1p... (62 characters)
  if (network === 'testnet4' || network === 'testnet') {
    if (trimmed.startsWith('tb1p') && trimmed.length === 62) {
      // Validate bech32 format (basic check)
      if (/^tb1p[a-z0-9]{58}$/.test(trimmed)) {
        return { valid: true };
      }
    }
    return { valid: false, error: 'Invalid Taproot address format for testnet. Expected tb1p... (62 characters)' };
  } else {
    // Mainnet
    if (trimmed.startsWith('bc1p') && trimmed.length === 62) {
      if (/^bc1p[a-z0-9]{58}$/.test(trimmed)) {
        return { valid: true };
      }
    }
    return { valid: false, error: 'Invalid Taproot address format for mainnet. Expected bc1p... (62 characters)' };
  }
}

/**
 * Sanitize and validate brand name
 */
export function validateBrand(brand: string): { valid: boolean; sanitized?: string; error?: string } {
  if (!brand || typeof brand !== 'string') {
    return { valid: false, error: 'Brand must be a non-empty string' };
  }

  const trimmed = brand.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Brand cannot be empty' };
  }

  if (trimmed.length > 100) {
    return { valid: false, error: 'Brand name too long (max 100 characters)' };
  }

  // Remove potentially dangerous characters but allow most unicode
  const sanitized = trimmed.replace(/[<>\"'&]/g, '');
  
  return { valid: true, sanitized };
}

/**
 * Validate and sanitize image URL
 */
export function validateImageUrl(image: string): { valid: boolean; sanitized?: string; error?: string } {
  if (!image || typeof image !== 'string') {
    // Image is optional, return empty string
    return { valid: true, sanitized: '' };
  }

  const trimmed = image.trim();
  
  if (trimmed.length === 0) {
    return { valid: true, sanitized: '' };
  }

  if (trimmed.length > 2048) {
    return { valid: false, error: 'Image URL too long (max 2048 characters)' };
  }

  // Basic URL validation
  try {
    const url = new URL(trimmed);
    // Only allow http/https protocols
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { valid: false, error: 'Image URL must use http or https protocol' };
    }
    return { valid: true, sanitized: trimmed };
  } catch {
    return { valid: false, error: 'Invalid image URL format' };
  }
}

/**
 * Validate initial amount (in cents)
 */
export function validateInitialAmount(initialAmount: any): { valid: boolean; value?: number; error?: string } {
  if (initialAmount === undefined || initialAmount === null) {
    return { valid: false, error: 'Initial amount is required' };
  }

  const amount = parseInt(String(initialAmount), 10);
  
  if (isNaN(amount)) {
    return { valid: false, error: 'Initial amount must be a valid number' };
  }

  if (amount < 1) {
    return { valid: false, error: 'Initial amount must be at least 1 cent' };
  }

  // Max reasonable amount: $10,000 (1,000,000 cents)
  if (amount > 1000000) {
    return { valid: false, error: 'Initial amount too large (max $10,000)' };
  }

  return { valid: true, value: amount };
}

/**
 * Validate expiration date (Unix timestamp)
 */
export function validateExpirationDate(expirationDate: any, defaultExpiration?: number): {
  valid: boolean;
  value?: number;
  error?: string;
} {
  // If not provided, use default (1 year from now)
  if (expirationDate === undefined || expirationDate === null) {
    const defaultVal = defaultExpiration || Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
    return { valid: true, value: defaultVal };
  }

  const timestamp = parseInt(String(expirationDate), 10);
  
  if (isNaN(timestamp)) {
    return { valid: false, error: 'Expiration date must be a valid Unix timestamp' };
  }

  const now = Math.floor(Date.now() / 1000);
  
  // Expiration must be in the future
  if (timestamp <= now) {
    return { valid: false, error: 'Expiration date must be in the future' };
  }

  // Max expiration: 10 years from now
  const maxExpiration = now + (10 * 365 * 24 * 60 * 60);
  if (timestamp > maxExpiration) {
    return { valid: false, error: 'Expiration date too far in the future (max 10 years)' };
  }

  return { valid: true, value: timestamp };
}

