/**
 * Explorer URL utilities for viewing transactions
 * Supports both mempool.space (Bitcoin) and Charms explorer
 */

const NETWORK = process.env.NEXT_PUBLIC_BITCOIN_NETWORK || 'testnet4';
const MEMPOOL_BASE = NETWORK === 'testnet4' 
  ? 'https://mempool.space/testnet4'
  : 'https://mempool.space';

// Charms explorer (when available)
const CHARMS_EXPLORER_BASE = 'https://explorer.charms.dev';

/**
 * Get mempool.space transaction URL
 */
export function getMempoolTxUrl(txid: string): string {
  return `${MEMPOOL_BASE}/tx/${txid}`;
}

/**
 * Get Charms explorer URL for a transaction
 * Note: Charms explorer may use different URL structure
 */
export function getCharmsExplorerUrl(txid: string, type?: 'spell' | 'commit'): string {
  // Charms explorer might use different URL format
  // For now, link to mempool.space with note about Charms
  // TODO: Update when Charms explorer URL structure is confirmed
  return `${MEMPOOL_BASE}/tx/${txid}`;
}

/**
 * Get explorer URL for a gift card (by token ID or transaction)
 */
export function getGiftCardExplorerUrl(tokenId: string, txid?: string): string {
  if (txid) {
    return getMempoolTxUrl(txid);
  }
  // If no txid, try to find via token ID
  // For now, return mempool.space address search
  return `${MEMPOOL_BASE}/address/${tokenId}`;
}

/**
 * Open transaction in explorer (new tab)
 */
export function openInExplorer(txid: string, type: 'mempool' | 'charms' = 'mempool'): void {
  const url = type === 'charms' 
    ? getCharmsExplorerUrl(txid)
    : getMempoolTxUrl(txid);
  window.open(url, '_blank', 'noopener,noreferrer');
}

