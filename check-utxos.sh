#!/bin/bash
# Check UTXOs and their sync status

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

# Get node sync status
echo "📊 Node Sync Status:"
NODE_BLOCKS=$(~/.local/bin/bitcoin-cli -chain=testnet4 -datadir=$HOME/.bitcoin/testnet4 getblockchaininfo 2>/dev/null | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('blocks', 0))" 2>/dev/null || echo "0")
NODE_HEADERS=$(~/.local/bin/bitcoin-cli -chain=testnet4 -datadir=$HOME/.bitcoin/testnet4 getblockchaininfo 2>/dev/null | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('headers', 0))" 2>/dev/null || echo "0")
echo "   Blocks: ${NODE_BLOCKS:,} / ${NODE_HEADERS:,}"
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
    node_blocks = int('''$NODE_BLOCKS''')
    
    if not utxos or len(utxos) == 0:
        print("No UTXOs found")
        sys.exit(0)
    
    print(f"Total UTXOs: {len(utxos)}")
    print("")
    
    total_value = 0
    usable_count = 0
    waiting_count = 0
    
    for i, utxo in enumerate(utxos, 1):
        txid = utxo.get('txid', 'unknown')
        vout = utxo.get('vout', utxo.get('index', 0))
        value = utxo.get('value', 0)
        status = utxo.get('status', {})
        block_height = status.get('block_height')
        confirmed = status.get('confirmed', False)
        
        total_value += value
        
        # Check if node has synced this block
        if block_height is not None:
            blocks_needed = block_height - node_blocks
            is_usable = blocks_needed <= 0
            status_icon = "✅" if is_usable else "⏳"
            status_text = "USABLE" if is_usable else f"WAIT ({blocks_needed:,} blocks)"
            
            if is_usable:
                usable_count += 1
            else:
                waiting_count += 1
        else:
            status_icon = "⏳"
            status_text = "UNCONFIRMED"
            waiting_count += 1
            blocks_needed = None
        
        print(f"{status_icon} UTXO #{i}:")
        print(f"   TXID: {txid}")
        print(f"   VOUT: {vout}")
        print(f"   Value: {value:,} sats ({value/100000000:.8f} BTC)")
        if block_height is not None:
            print(f"   Block: {block_height:,} (confirmed)")
            if blocks_needed is not None and blocks_needed > 0:
                # Estimate time (rough: 1 block per 10 minutes for testnet)
                minutes = blocks_needed * 10
                hours = minutes // 60
                mins = minutes % 60
                if hours > 0:
                    print(f"   Wait time: ~{hours}h {mins}m")
                else:
                    print(f"   Wait time: ~{minutes}m")
        else:
            print(f"   Status: Unconfirmed (in mempool)")
        print("")
    
    print("=" * 50)
    print(f"Summary:")
    print(f"   Total UTXOs: {len(utxos)}")
    print(f"   ✅ Usable now: {usable_count}")
    print(f"   ⏳ Need to wait: {waiting_count}")
    print(f"   Total value: {total_value:,} sats ({total_value/100000000:.8f} BTC)")
    print("")
    
    if usable_count > 0:
        print("✅ You have UTXOs that are ready to use!")
        print("   The node has synced the blocks containing these UTXOs.")
    elif waiting_count > 0:
        print("⏳ All your UTXOs are in blocks the node hasn't synced yet.")
        print("   You need to wait for the node to sync more blocks.")
        print("   Monitor progress: ./monitor-bitcoin-health.sh")
    else:
        print("⚠️ No usable UTXOs found.")
    
except Exception as e:
    print(f"Error parsing UTXOs: {e}")
    print("Raw response:")
    print('''$UTXOS''')
PYTHON_SCRIPT
