# Pruned UTXO Issue - Fix Summary

## Problem

The node is pruned (prune height: 113,090) and was trying to use UTXOs from blocks before the prune height. Bitcoin Core cannot verify UTXOs from pruned blocks, causing broadcast failures.

## Root Cause

- Node is pruned: only keeps blocks after 113,090
- UTXO filtering was not aggressive enough
- Parent transaction checks were incomplete
- Unconfirmed UTXOs couldn't be verified for prune status

## Fixes Implemented

### 1. Improved UTXO Filtering (`src/lib/charms/wallet.ts`)

**Changes:**
- Now checks ALL parent transactions, not just the first one
- If any parent is from a pruned block, UTXO is rejected
- More conservative handling when parent checks fail
- Unconfirmed UTXOs are handled more carefully when node is pruned
- If transaction data can't be fetched and node is pruned, UTXO is rejected (safer)

**Key improvements:**
- Sequential parent checking (stops at first pruned parent)
- Better error handling for failed parent checks
- Conservative approach: reject if can't verify (when pruned)

### 2. Additional Pre-Transaction Validation (`src/components/sections/gift-card-purchase.tsx`)

**Changes:**
- Added final validation right before creating transaction
- Double-checks UTXO block height against prune height
- Checks ALL parent transactions before proceeding
- Fails fast with clear error message
- Prevents transaction creation if UTXO is pruned

**Location:** Right before `mintGiftCard()` call (line ~850)

### 3. Improved Error Messages

**Files updated:**
- `src/components/sections/gift-card-purchase.tsx`
- `src/lib/charms/wallet.ts`
- `api/src/routes/broadcast.ts`

**Improvements:**
- Clear explanation of prune issue
- Shows prune height and UTXO block height
- Step-by-step solution (get fresh UTXO from faucet)
- Actionable guidance

## How It Works Now

### UTXO Selection Flow

1. **Fetch UTXOs** from wallet
2. **Filter by prune height:**
   - Check UTXO block height
   - Check ALL parent transaction block heights
   - Reject if any are before prune height
3. **Prefer synced UTXOs** (after prune height)
4. **Final validation** before transaction creation
5. **Clear error** if only pruned UTXOs available

### Error Messages

When pruned UTXO is detected, user sees:
- Clear explanation of the issue
- Prune height information
- Step-by-step solution
- Actionable steps to get fresh UTXO

## Solution for User

**Quick Fix:**
1. Get fresh testnet coins from faucet
2. New coins will be from recent blocks (after 113,090)
3. These will work with pruned node
4. Click "Refresh" to update balance
5. Try minting again

**Why this works:**
- Faucet gives coins from recent blocks
- Recent blocks are after prune height (113,090)
- Pruned node can verify these UTXOs
- Minting will succeed

## Testing

The fixes ensure:
1. Pruned UTXOs are never selected
2. Parent transaction checks work correctly
3. Clear errors when only pruned UTXOs available
4. User gets actionable guidance

## Files Modified

1. `src/lib/charms/wallet.ts` - Improved `filterSyncedUtxos` function
2. `src/components/sections/gift-card-purchase.tsx` - Added final validation and improved errors
3. `api/src/routes/broadcast.ts` - Improved error messages for pruned UTXO errors

## Next Steps

1. Get fresh testnet coins from faucet
2. Wait for confirmation (1-2 minutes)
3. Click "Refresh" button
4. Try minting again - should work with fresh UTXO

The filtering will now properly reject pruned UTXOs and guide you to get fresh ones that will work.
