/**
 * Balance formatting utilities
 */

/**
 * Format BTC balance in a classy way - no unnecessary zeros, smart formatting
 */
export function formatBalance(bal: number | null | undefined): string {
  if (bal === null || bal === undefined) return '0';
  
  // For very small amounts, show more precision
  if (bal < 0.01) {
    return bal.toFixed(6).replace(/\.?0+$/, '');
  }
  
  // For amounts less than 1, show up to 4 decimal places
  if (bal < 1) {
    return bal.toFixed(4).replace(/\.?0+$/, '');
  }
  
  // For amounts 1-100, show up to 2 decimal places
  if (bal < 100) {
    return bal.toFixed(2).replace(/\.?0+$/, '');
  }
  
  // For larger amounts, show fewer decimal places or abbreviate
  if (bal < 1000) {
    return bal.toFixed(1).replace(/\.?0+$/, '');
  }
  
  // For very large amounts, use abbreviations
  if (bal >= 1000000) {
    return `${(bal / 1000000).toFixed(2)}M`;
  }
  
  if (bal >= 1000) {
    return `${(bal / 1000).toFixed(2)}K`;
  }
  
  return bal.toString();
}

/**
 * Format sats in a compact way - avoid unnecessary zeros, use abbreviations
 * Examples: "100k sats", "1.5M sats", "500 sats", "50 sats"
 */
export function formatSatsCompact(sats: number | null | undefined): string {
  if (sats === null || sats === undefined || sats === 0) return '0 sats';
  
  // Convert to integer if needed
  const satsInt = Math.floor(sats);
  
  // For very large amounts (millions)
  if (satsInt >= 1_000_000) {
    const millions = satsInt / 1_000_000;
    // Remove trailing zeros
    return `${millions.toFixed(2).replace(/\.?0+$/, '')}M sats`;
  }
  
  // For thousands
  if (satsInt >= 1_000) {
    const thousands = satsInt / 1_000;
    // Remove trailing zeros
    return `${thousands.toFixed(1).replace(/\.?0+$/, '')}k sats`;
  }
  
  // For amounts less than 1000, show as-is
  return `${satsInt} sats`;
}

