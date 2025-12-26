/**
 * Fee Configuration and Utilities
 * Handles transaction fee calculations for Charms gift card minting
 */

// Get current network (testnet or mainnet)
const NETWORK = process.env.NEXT_PUBLIC_BITCOIN_NETWORK || 'testnet4';
const IS_TESTNET = NETWORK === 'testnet4' || NETWORK === 'testnet';

// Network-aware fee configuration
// Testnet: Very low fees (testnet coins have no value)
// Mainnet: Higher fees for safety and faster confirmation
export const ESTIMATED_FEE_PER_TX_SATS = IS_TESTNET ? 250 : 1000; // Testnet: 250 sats/tx, Mainnet: 1000 sats/tx
export const ESTIMATED_TOTAL_FEE_SATS = ESTIMATED_FEE_PER_TX_SATS * 2; // For both commit + spell transactions

// Minimum fee buffer to ensure transactions go through
// Testnet: Lower buffer (500 sats) since fees are minimal and testnet coins have no value
// Mainnet: Higher buffer (5000 sats) for safety and network fluctuations
// Note: This buffer is conservative to ensure transactions succeed even with fee fluctuations
export const MIN_FEE_BUFFER_SATS = IS_TESTNET ? 500 : 5000;

// Minimum UTXO value required (gift card amount + fees)
export function calculateMinimumRequiredSats(giftCardAmountCents: number): number {
  // Convert cents to sats (1 USD = 100 cents, approximate 1 USD = 100,000 sats)
  // More accurately: 1 BTC = 100,000,000 sats, so 1 USD ≈ 100,000 sats at $1/BTC (testnet)
  // For testnet, we'll use a simpler conversion: 1 cent = 1000 sats (conservative)
  const giftCardAmountSats = giftCardAmountCents * 1000;
  
  // Calculate total required: gift card amount + transaction fees + safety buffer
  const totalRequired = giftCardAmountSats + MIN_FEE_BUFFER_SATS + ESTIMATED_TOTAL_FEE_SATS;
  
  // Log fee breakdown for debugging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('💸 Fee Calculation Breakdown:', {
      giftCardAmountCents,
      giftCardAmountSats,
      estimatedFeesSats: ESTIMATED_TOTAL_FEE_SATS,
      feeBufferSats: MIN_FEE_BUFFER_SATS,
      totalRequiredSats: totalRequired,
      network: IS_TESTNET ? 'testnet' : 'mainnet',
    });
  }
  
  return totalRequired;
}

/**
 * Calculate total cost including fees
 * Returns breakdown of costs for display to users
 */
export function calculateTotalCostSats(giftCardAmountCents: number): {
  giftCardSats: number;
  estimatedFeesSats: number;
  totalSats: number;
  minimumRequiredSats: number;
  network: string;
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
    network: IS_TESTNET ? 'testnet' : 'mainnet',
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

