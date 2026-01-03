#!/bin/bash
# Helper script to get assumevalid block hash for testnet4
# This can be used to speed up sync by skipping verification of known-good blocks

DATA_DIR="$HOME/.bitcoin/testnet4"
BITCOIN_CLI="bitcoin-cli"

# Check if bitcoin-cli is available
if ! command -v bitcoin-cli &> /dev/null; then
    if [ -f ~/.local/bin/bitcoin-cli ]; then
        BITCOIN_CLI=~/.local/bin/bitcoin-cli
    elif [ -f /home/tevin/.local/bin/bitcoin-cli ]; then
        BITCOIN_CLI=/home/tevin/.local/bin/bitcoin-cli
    else
        echo "❌ bitcoin-cli not found"
        exit 1
    fi
fi

echo "🔍 Getting assumevalid block hash for testnet4"
echo "=============================================="
echo ""

# Check if node is running
if ! pgrep -x "bitcoind" > /dev/null; then
    echo "❌ Bitcoin Core is NOT running"
    echo ""
    echo "Please start the node first:"
    echo "  bitcoind -chain=testnet4 -datadir=$DATA_DIR -daemon"
    exit 1
fi

# Get blockchain info
BC_INFO=$($BITCOIN_CLI -chain=testnet4 -datadir="$DATA_DIR" getblockchaininfo 2>&1)

if [ $? -ne 0 ]; then
    echo "❌ Cannot connect to Bitcoin Core node"
    echo "   Node may still be starting up. Wait a few minutes and try again."
    exit 1
fi

# Extract assumevalid from response
ASSUMEVALID=$(echo "$BC_INFO" | python3 -c "
import json
import sys
try:
    data = json.load(sys.stdin)
    assumevalid = data.get('assumevalid', '')
    if assumevalid:
        print(assumevalid)
    else:
        print('')
except:
    print('')
" 2>/dev/null)

if [ -z "$ASSUMEVALID" ]; then
    echo "⚠️  assumevalid not found in getblockchaininfo response"
    echo ""
    echo "💡 This is normal - assumevalid is set by Bitcoin Core developers"
    echo "   and may not be available for testnet4 yet."
    echo ""
    echo "Alternative: You can use a recent well-confirmed block hash."
    echo "To get a recent block hash:"
    echo "  $BITCOIN_CLI -chain=testnet4 -datadir=$DATA_DIR getblockhash <block_height>"
    echo ""
    echo "Example (get block hash at height 1000000):"
    echo "  $BITCOIN_CLI -chain=testnet4 -datadir=$DATA_DIR getblockhash 1000000"
    exit 0
fi

echo "✅ Found assumevalid block hash:"
echo ""
echo "   $ASSUMEVALID"
echo ""
echo "📝 To use this in your bitcoin.conf:"
echo ""
echo "   1. Edit: $DATA_DIR/bitcoin.conf"
echo "   2. Find the line: # assumevalid=0"
echo "   3. Replace with: assumevalid=$ASSUMEVALID"
echo "   4. Restart the node"
echo ""
echo "💡 This will skip verification of blocks before this checkpoint,"
echo "   significantly speeding up sync (safe for testnet4)."
echo ""
