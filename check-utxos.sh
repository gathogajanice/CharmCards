#!/bin/bash
# Check UTXOs for a Bitcoin address using mempool.space

if [ -z "$1" ]; then
    echo "Usage: ./check-utxos.sh <your_wallet_address>"
    echo ""
    echo "Example: ./check-utxos.sh tb1q..."
    exit 1
fi

ADDRESS=$1
NETWORK="testnet4"
MEMEPOOL_URL="https://memepool.space/${NETWORK}"

echo "🔍 Checking UTXOs for address: $ADDRESS"
echo "=========================================="
echo ""

# Fetch UTXOs from memepool.space
echo "📦 Fetching UTXOs from memepool.space..."
UTXOS=$(curl -s "${MEMEPOOL_URL}/api/address/${ADDRESS}/utxo" 2>/dev/null)

if [ $? -ne 0 ] || [ -z "$UTXOS" ] || [ "$UTXOS" = "[]" ]; then
    echo "❌ No UTXOs found for this address"
    echo ""
    echo "💡 Possible reasons:"
    echo "   1. Address has no unspent outputs"
    echo "   2. All UTXOs have been spent"
    echo "   3. Address format is incorrect"
    exit 1
fi

# Parse and display UTXOs
echo "✅ Found UTXOs:"
echo ""

python3 << PYTHON_SCRIPT
import json
import sys

try:
    utxos = json.loads('''$UTXOS''')
    
    if not utxos or len(utxos) == 0:
        print("No UTXOs found")
        sys.exit(0)
    
    print(f"Total UTXOs: {len(utxos)}")
    print("")
    
    total_value = 0
    confirmed_count = 0
    unconfirmed_count = 0
    
    for i, utxo in enumerate(utxos, 1):
        txid = utxo.get('txid', 'unknown')
        vout = utxo.get('vout', utxo.get('index', 0))
        value = utxo.get('value', 0)
        status = utxo.get('status', {})
        block_height = status.get('block_height')
        confirmed = status.get('confirmed', False)
        
        total_value += value
        
        if confirmed and block_height is not None:
            status_icon = "✅"
            status_text = "CONFIRMED"
            confirmed_count += 1
        else:
            status_icon = "⏳"
            status_text = "UNCONFIRMED"
            unconfirmed_count += 1
        
        print(f"{status_icon} UTXO #{i}:")
        print(f"   TXID: {txid}")
        print(f"   VOUT: {vout}")
        print(f"   Value: {value:,} sats ({value/100000000:.8f} BTC)")
        if block_height is not None:
            print(f"   Block: {block_height:,} (confirmed)")
        else:
            print(f"   Status: Unconfirmed (in mempool)")
        print("")
    
    print("=" * 50)
    print(f"Summary:")
    print(f"   Total UTXOs: {len(utxos)}")
    print(f"   ✅ Confirmed: {confirmed_count}")
    print(f"   ⏳ Unconfirmed: {unconfirmed_count}")
    print(f"   Total value: {total_value:,} sats ({total_value/100000000:.8f} BTC)")
    print("")
    
    if confirmed_count > 0:
        print("✅ You have confirmed UTXOs ready to use!")
    elif unconfirmed_count > 0:
        print("⏳ All your UTXOs are unconfirmed (waiting for confirmation).")
    else:
        print("⚠️ No usable UTXOs found.")
    
except Exception as e:
    print(f"Error parsing UTXOs: {e}")
    print("Raw response:")
    print('''$UTXOS''')
PYTHON_SCRIPT
