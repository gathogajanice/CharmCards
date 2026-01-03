#!/bin/bash
# Real-time Bitcoin Core Health Monitor
# Updates every few seconds to show sync progress and health

INTERVAL=${1:-5}  # Default 5 seconds, can be overridden: ./monitor-bitcoin-core.sh 10

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
NC='\033[0m' # No Color

echo "🔍 Bitcoin Core Health Monitor"
echo "=============================="
echo "Update interval: ${INTERVAL} seconds"
echo "Press Ctrl+C to stop"
echo ""

while true; do
    clear
    echo -e "${CYAN}🔍 Bitcoin Core Health Monitor - $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo "=============================="
    echo ""
    
    # Check if process is running
    if ! pgrep -x "bitcoind" > /dev/null; then
        echo -e "${RED}❌ Bitcoin Core is NOT running${NC}"
        echo ""
        echo "Start it with:"
        echo "  bitcoind -chain=testnet4 -datadir=$DATA_DIR -daemon"
        echo ""
        sleep $INTERVAL
        continue
    fi
    
    echo -e "${GREEN}✅ Bitcoin Core process is running${NC}"
    PID=$(pgrep -x bitcoind | head -1)
    echo "   PID: $PID"
    echo ""
    
    # Get blockchain info
    BC_INFO=$($BITCOIN_CLI -chain=testnet4 -datadir="$DATA_DIR" getblockchaininfo 2>&1)
    BC_EXIT=$?
    
    if [ $BC_EXIT -ne 0 ]; then
        echo -e "${YELLOW}⏳ Node is still starting up...${NC}"
        echo "   Error: $(echo "$BC_INFO" | head -1)"
        echo ""
        sleep $INTERVAL
        continue
    fi
    
    # Parse blockchain info
    echo "$BC_INFO" | python3 -c "
import json
import sys

try:
    data = json.load(sys.stdin)
    
    blocks = data.get('blocks', 0)
    headers = data.get('headers', 0)
    progress = data.get('verificationprogress', 0) * 100
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
        bar_width = 40
        filled = int(bar_width * sync_pct / 100)
        bar = '█' * filled + '░' * (bar_width - filled)
        print(f'   [{bar}] {sync_pct:.1f}%')
    
    print(f'🔍 Verification: {progress:.4f}%')
    print(f'🔗 Best Block: {bestblock}')
    print('')
    
    if ibd:
        print('⏳ Status: SYNCING (Initial Block Download)')
        print('   💡 Node is usable for recent transactions!')
    else:
        print('✅ Status: FULLY SYNCED')
        print('   🎉 Node is ready for all operations!')
    print('')
    
except Exception as e:
    print(f'Error parsing blockchain info: {e}')
"
    
    # Get network info
    NET_INFO=$($BITCOIN_CLI -chain=testnet4 -datadir="$DATA_DIR" getnetworkinfo 2>&1)
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
    MP_INFO=$($BITCOIN_CLI -chain=testnet4 -datadir="$DATA_DIR" getmempoolinfo 2>&1)
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
    
    echo "=============================="
    echo -e "${CYAN}Next update in ${INTERVAL} seconds... (Ctrl+C to stop)${NC}"
    sleep $INTERVAL
done
