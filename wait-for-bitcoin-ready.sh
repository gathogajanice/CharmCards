#!/bin/bash
# Wait for Bitcoin Core RPC to be ready and check sync status
# This script monitors Bitcoin Core initialization and checks status when ready

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

BITCOIN_CLI=~/.local/bin/bitcoin-cli
DATA_DIR=$HOME/.bitcoin/testnet4
CHECK_INTERVAL=10  # Check every 10 seconds
MAX_WAIT=3600      # Maximum wait time (1 hour)

# Check if bitcoin-cli exists
if [ ! -f "$BITCOIN_CLI" ]; then
    BITCOIN_CLI=bitcoin-cli
fi

echo -e "${CYAN}⏳ Waiting for Bitcoin Core RPC to be ready...${NC}"
echo "This script will check every $CHECK_INTERVAL seconds"
echo "Press Ctrl+C to stop"
echo ""

START_TIME=$(date +%s)
ITERATION=0

while true; do
    ITERATION=$((ITERATION + 1))
    ELAPSED=$(($(date +%s) - START_TIME))
    
    # Try to get blockchain info
    RESULT=$($BITCOIN_CLI -chain=testnet4 -datadir="$DATA_DIR" getblockchaininfo 2>&1)
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 0 ] && echo "$RESULT" | grep -q "\"blocks\""; then
        # RPC is ready!
        echo ""
        echo -e "${GREEN}✅ Bitcoin Core RPC is ready!${NC}"
        echo ""
        
        # Parse and display status
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
    
    print(f"📊 Sync Status:")
    print(f"  Blocks: {blocks:,} / {headers:,}")
    print(f"  Block Progress: {block_pct:.2f}%")
    print(f"  Verification: {progress:.2f}%")
    print(f"  Remaining: {remaining:,} blocks")
    print(f"  Initial Block Download: {'Yes (Still syncing)' if ibd else 'No (FULLY SYNCED!)'}")
    print("")
    
    if not ibd:
        print("🎉🎉🎉 SUCCESS! Bitcoin Core is FULLY SYNCED to 100%! 🎉🎉🎉")
        print("✅ Sync is complete!")
        print("✅ You can now use the node for all operations!")
    elif remaining == 0:
        print("🎉 All blocks synced!")
    else:
        print(f"⏳ Still syncing - {100-block_pct:.2f}% remaining ({remaining:,} blocks)")
        print("")
        print("💡 The node is ready to use even while syncing!")
        print("   You can use it for recent transactions.")
except Exception as e:
    print(f"Error parsing response: {e}")
    print("Raw response:")
    sys.stdin.seek(0)
    print(sys.stdin.read())
PYTHON_SCRIPT
        
        echo ""
        echo -e "${GREEN}✅ Bitcoin Core is ready for use!${NC}"
        exit 0
    elif echo "$RESULT" | grep -q "Loading block index"; then
        # Still loading
        if [ $((ITERATION % 6)) -eq 0 ]; then  # Print every minute
            MINUTES=$((ELAPSED / 60))
            echo -e "${YELLOW}⏳ Still loading block index... (${MINUTES}m ${ELAPSED}s elapsed)${NC}"
        fi
    else
        # Other error
        if [ $((ITERATION % 6)) -eq 0 ]; then
            echo -e "${YELLOW}⏳ Waiting... (${ELAPSED}s elapsed)${NC}"
        fi
    fi
    
    # Check if we've exceeded max wait time
    if [ $ELAPSED -ge $MAX_WAIT ]; then
        echo ""
        echo -e "${RED}❌ Maximum wait time exceeded (${MAX_WAIT}s)${NC}"
        echo "Bitcoin Core RPC is still not ready."
        echo "Check the process: ps aux | grep bitcoind"
        exit 1
    fi
    
    sleep $CHECK_INTERVAL
done
