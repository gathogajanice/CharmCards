/**
 * Fee Configuration and Utilities
 * Handles transaction fee calculations for Charms gift card minting
 */

// Minimum fee buffer to ensure transactions go through
// This covers both commit and spell transactions
export const MIN_FEE_BUFFER_SATS = 5000; // 5000 sats = ~$0.25 at current prices

// Estimated fee per transaction (commit + spell = 2 transactions)
export const ESTIMATED_FEE_PER_TX_SATS = 1000; // Conservative estimate
export const ESTIMATED_TOTAL_FEE_SATS = ESTIMATED_FEE_PER_TX_SATS * 2; // 2000 sats for both

// Minimum UTXO value required (gift card amount + fees)
export function calculateMinimumRequiredSats(giftCardAmountCents: number): number {
  // Convert cents to sats (1 USD = 100 cents, approximate 1 USD = 100,000 sats)
  // More accurately: 1 BTC = 100,000,000 sats, so 1 USD ≈ 100,000 sats at $1/BTC (testnet)
  // For testnet, we'll use a simpler conversion: 1 cent = 1000 sats (conservative)
  const giftCardAmountSats = giftCardAmountCents * 1000;
  return giftCardAmountSats + MIN_FEE_BUFFER_SATS + ESTIMATED_TOTAL_FEE_SATS;
}

/**
 * Calculate total cost including fees
 */
export function calculateTotalCostSats(giftCardAmountCents: number): {
  giftCardSats: number;
  estimatedFeesSats: number;
  totalSats: number;
  minimumRequiredSats: number;
} {
  const giftCardSats = giftCardAmountCents * 1000;
  const estimatedFeesSats = ESTIMATED_TOTAL_FEE_SATS;
  const totalSats = giftCardSats + estimatedFeesSats;
  const minimumRequiredSats = totalSats + MIN_FEE_BUFFER_SATS;

  return {
    giftCardSats,
    estimatedFeesSats,
    totalSats,
    minimumRequiredSats,
  };
}

/**
 * Convert BTC balance to sats
 */
export function btcToSats(btc: number): number {
  return Math.floor(btc * 100_000_000);
}

/**
 * Convert sats to BTC
 */
export function satsToBtc(sats: number): number {
  return sats / 100_000_000;
}

/**
 * Format sats for display
 */
export function formatSats(sats: number): string {
  if (sats >= 100_000_000) {
    return `${(sats / 100_000_000).toFixed(8)} BTC`;
  }
  if (sats >= 1000) {
    return `${(sats / 1000).toFixed(2)}k sats`;
  }
  return `${sats} sats`;
}

/**
 * Check if wallet balance is sufficient for minting
 */
export function hasSufficientBalance(
  walletBalanceBtc: number,
  giftCardAmountCents: number
): {
  sufficient: boolean;
  requiredSats: number;
  availableSats: number;
  shortfallSats: number;
} {
  const availableSats = btcToSats(walletBalanceBtc);
  const requiredSats = calculateMinimumRequiredSats(giftCardAmountCents);
  const shortfallSats = Math.max(0, requiredSats - availableSats);

  return {
    sufficient: availableSats >= requiredSats,
    requiredSats,
    availableSats,
    shortfallSats,
  };
}

