#!/bin/bash
# Quick status check for Bitcoin Core sync
# Use this to quickly check if sync is complete

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BITCOIN_CLI=~/.local/bin/bitcoin-cli
DATA_DIR=$HOME/.bitcoin/testnet4

if [ ! -f "$BITCOIN_CLI" ]; then
    BITCOIN_CLI=bitcoin-cli
fi

# Check if process is running
if ! pgrep -x "bitcoind" > /dev/null; then
    echo "❌ Bitcoin Core is not running"
    exit 1
fi

# Try to get status
RESULT=$($BITCOIN_CLI -chain=testnet4 -datadir="$DATA_DIR" getblockchaininfo 2>&1)

if echo "$RESULT" | grep -q "Loading block index"; then
    echo "⏳ Bitcoin Core is still loading block index..."
    echo "   RPC will be available soon"
    exit 0
elif echo "$RESULT" | grep -q "\"blocks\""; then
    # RPC is ready - show status
    echo "$RESULT" | python3 << PYTHON_SCRIPT
import sys
import json

try:
    d = json.load(sys.stdin)
    blocks = d.get('blocks', 0)
    headers = d.get('headers', 0)
    progress = d.get('verificationprogress', 0) * 100
    ibd = d.get('initialblockdownload', False)
    remaining = headers - blocks
    block_pct = (blocks / headers * 100) if headers > 0 else 0
    
    print(f"📊 Bitcoin Core Status:")
    print(f"  Blocks: {blocks:,} / {headers:,}")
    print(f"  Progress: {block_pct:.2f}%")
    print(f"  Verification: {progress:.2f}%")
    print(f"  Remaining: {remaining:,} blocks")
    print("")
    
    if not ibd:
        print("🎉 FULLY SYNCED to 100%!")
    elif remaining == 0:
        print("🎉 All blocks synced!")
    else:
        print(f"⏳ Still syncing - {100-block_pct:.2f}% remaining")
except Exception as e:
    print(f"Error: {e}")
PYTHON_SCRIPT
else
    echo "❌ Cannot connect to Bitcoin Core RPC"
    echo "   Error: $RESULT"
    exit 1
fi
