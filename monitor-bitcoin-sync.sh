#!/bin/bash
# Enhanced Bitcoin Core Sync Monitor with Time Estimates
# Tracks sync progress and calculates estimated time remaining

INTERVAL=${1:-10}  # Default 10 seconds for better time estimates

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
else
    BITCOIN_CLI="bitcoin-cli"
fi

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Variables for tracking progress
LAST_BLOCKS=0
LAST_TIME=0
BLOCK_HISTORY=()
TIME_HISTORY=()

echo "🔍 Bitcoin Core Sync Monitor with Time Estimates"
echo "================================================"
echo "Update interval: ${INTERVAL} seconds"
echo "Press Ctrl+C to stop"
echo ""
sleep 2

ITERATION=0

while true; do
    clear
    CURRENT_TIME=$(date +%s)
    ITERATION=$((ITERATION + 1))
    
    echo -e "${CYAN}🔍 Bitcoin Core Sync Monitor - $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo "================================================"
    echo ""
    
    # Check if process is running
    if ! pgrep -x "bitcoind" > /dev/null; then
        echo -e "${RED}❌ Bitcoin Core is NOT running${NC}"
        echo ""
        echo "Start it with:"
        echo "  bitcoind -testnet -datadir=$DATA_DIR -daemon"
        echo ""
        sleep $INTERVAL
        continue
    fi
    
    echo -e "${GREEN}✅ Bitcoin Core process is running${NC}"
    PID=$(pgrep -x bitcoind | head -1)
    echo "   PID: $PID"
    echo ""
    
    # Get blockchain info
    BC_INFO=$($BITCOIN_CLI -testnet -datadir="$DATA_DIR" getblockchaininfo 2>&1)
    BC_EXIT=$?
    
    if [ $BC_EXIT -ne 0 ]; then
        ERROR_MSG=$(echo "$BC_INFO" | grep -o "error message:[^}]*" | cut -d: -f2 | xargs || echo "$BC_INFO" | head -1)
        echo -e "${YELLOW}⏳ Node is still starting up...${NC}"
        echo "   Status: $ERROR_MSG"
        echo ""
        
        # Check if RPC port is listening
        if netstat -tlnp 2>/dev/null | grep -q ":18332.*LISTEN" || ss -tlnp 2>/dev/null | grep -q ":18332"; then
            echo -e "${BLUE}💡 RPC port is listening - should be ready soon!${NC}"
        else
            echo -e "${YELLOW}💡 RPC port not ready yet${NC}"
        fi
        echo ""
        echo "   This usually takes 1-5 minutes after process start"
        echo ""
        sleep $INTERVAL
        continue
    fi
    
    # Parse blockchain info and calculate estimates
    echo "$BC_INFO" | python3 << PYTHON_SCRIPT
import json
import sys
import time
from datetime import timedelta

try:
    data = json.load(sys.stdin)
    
    blocks = data.get('blocks', 0)
    headers = data.get('headers', 0)
    progress = data.get('verificationprogress', 0)
    ibd = data.get('initialblockdownload', False)
    chain = data.get('chain', 'unknown')
    bestblock = data.get('bestblockhash', '')[:16] + '...'
    
    print(f'🌐 Network: {chain.upper()}')
    print(f'📦 Blocks: {blocks:,} / {headers:,}')
    
    if headers > 0:
        sync_pct = (blocks / headers) * 100
        remaining = headers - blocks
        print(f'📈 Sync Progress: {sync_pct:.2f}%')
        print(f'   Remaining: {remaining:,} blocks')
        
        # Progress bar
        bar_width = 50
        filled = int(bar_width * sync_pct / 100)
        bar = '█' * filled + '░' * (bar_width - filled)
        print(f'   [{bar}] {sync_pct:.1f}%')
        print('')
    
    print(f'🔍 Verification: {progress * 100:.4f}%')
    print(f'🔗 Best Block: {bestblock}')
    print('')
    
    # Calculate sync speed and time estimate
    if ibd and headers > blocks and remaining > 0:
        # Read previous values from environment or use defaults
        last_blocks = int('${LAST_BLOCKS:-0}')
        last_time = int('${LAST_TIME:-0}')
        current_time = int(time.time())
        
        if last_blocks > 0 and last_time > 0 and current_time > last_time:
            time_diff = current_time - last_time
            blocks_diff = blocks - last_blocks
            
            if blocks_diff > 0 and time_diff > 0:
                blocks_per_sec = blocks_diff / time_diff
                blocks_per_min = blocks_per_sec * 60
                blocks_per_hour = blocks_per_min * 60
                
                print(f'⚡ Sync Speed:')
                print(f'   {blocks_per_sec:.2f} blocks/sec')
                print(f'   {blocks_per_min:.1f} blocks/min')
                print(f'   {blocks_per_hour:.0f} blocks/hour')
                print('')
                
                if blocks_per_sec > 0:
                    seconds_remaining = remaining / blocks_per_sec
                    eta = timedelta(seconds=int(seconds_remaining))
                    
                    print(f'⏱️  Time Estimate:')
                    print(f'   Remaining: {eta}')
                    
                    # Calculate completion time
                    completion_time = time.time() + seconds_remaining
                    completion_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(completion_time))
                    print(f'   ETA: {completion_str}')
                    print('')
        
        print('⏳ Status: SYNCING (Initial Block Download)')
        print('   💡 Node is usable for recent transactions!')
        print('   💡 RPC should be ready now!')
    else:
        print('✅ Status: FULLY SYNCED')
        print('   🎉 Node is ready for all operations!')
    print('')
    
except Exception as e:
    print(f'Error parsing blockchain info: {e}')
    import traceback
    traceback.print_exc()
PYTHON_SCRIPT
    
    # Update tracking variables
    CURRENT_BLOCKS=$(echo "$BC_INFO" | python3 -c "import json, sys; print(json.load(sys.stdin).get('blocks', 0))" 2>/dev/null || echo "0")
    
    if [ "$LAST_BLOCKS" != "0" ] && [ "$CURRENT_BLOCKS" != "$LAST_BLOCKS" ]; then
        LAST_BLOCKS=$CURRENT_BLOCKS
        LAST_TIME=$CURRENT_TIME
    elif [ "$LAST_BLOCKS" = "0" ]; then
        LAST_BLOCKS=$CURRENT_BLOCKS
        LAST_TIME=$CURRENT_TIME
    fi
    
    # Export for Python script
    export LAST_BLOCKS LAST_TIME
    
    # Get network info
    NET_INFO=$($BITCOIN_CLI -testnet -datadir="$DATA_DIR" getnetworkinfo 2>&1)
    if [ $? -eq 0 ]; then
        echo "$NET_INFO" | python3 -c "
import json
import sys
try:
    data = json.load(sys.stdin)
    conns = data.get('connections', 0)
    active = data.get('networkactive', False)
    version = data.get('version', 0)
    print(f'🌐 Network:')
    print(f'   Active: {\"✅ Yes\" if active else \"❌ No\"}')
    print(f'   Connections: {conns} peers')
    print(f'   Version: {version}')
    print('')
except:
    pass
"
    fi
    
    # Get mempool info
    MP_INFO=$($BITCOIN_CLI -testnet -datadir="$DATA_DIR" getmempoolinfo 2>&1)
    if [ $? -eq 0 ]; then
        echo "$MP_INFO" | python3 -c "
import json
import sys
try:
    data = json.load(sys.stdin)
    size = data.get('size', 0)
    bytes_val = data.get('bytes', 0)
    print(f'💾 Mempool:')
    print(f'   Transactions: {size}')
    print(f'   Size: {bytes_val:,} bytes')
    print('')
except:
    pass
"
    fi
    
    # Check RPC readiness
    RPC_TEST=$($BITCOIN_CLI -testnet -datadir="$DATA_DIR" getblockcount 2>&1)
    if echo "$RPC_TEST" | grep -q "error code: -28"; then
        echo -e "${YELLOW}⚠️  RPC: Still initializing...${NC}"
    else
        echo -e "${GREEN}✅ RPC: Ready and responding!${NC}"
    fi
    echo ""
    
    echo "================================"
    echo -e "${CYAN}Next update in ${INTERVAL} seconds... (Ctrl+C to stop)${NC}"
    echo -e "${MAGENTA}Iteration: $ITERATION${NC}"
    sleep $INTERVAL
done
