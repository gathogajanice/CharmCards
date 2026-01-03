#!/bin/bash
# Quick Bitcoin Core sync status check with time estimates

DATA_DIR="$HOME/.bitcoin/testnet4"
BITCOIN_CLI="bitcoin-cli"

# Check if bitcoin-cli is available
if ! command -v bitcoin-cli &> /dev/null; then
    if [ -f ~/.local/bin/bitcoin-cli ]; then
        BITCOIN_CLI=~/.local/bin/bitcoin-cli
    else
        echo "❌ bitcoin-cli not found"
        exit 1
    fi
fi

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}📊 Bitcoin Core Sync Status${NC}"
echo "=============================="
echo ""

# Check if process is running
if ! pgrep -x "bitcoind" > /dev/null; then
    echo -e "${RED}❌ Bitcoin Core is NOT running${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Bitcoin Core is running${NC}"
echo ""

# Get blockchain info
BC_INFO=$($BITCOIN_CLI -chain=testnet4 -datadir="$DATA_DIR" getblockchaininfo 2>&1)
BC_EXIT=$?

if [ $BC_EXIT -ne 0 ]; then
    ERROR_MSG=$(echo "$BC_INFO" | grep -o "error message:[^}]*" | cut -d: -f2 | xargs || echo "$BC_INFO" | head -1)
    echo -e "${YELLOW}⏳ Node is still starting up...${NC}"
    echo "   Status: $ERROR_MSG"
    echo ""
    echo "   RPC will be ready in 1-5 minutes"
    exit 0
fi

# Parse and display info
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
    
    print(f'🌐 Network: {chain.upper()}')
    print(f'📦 Blocks: {blocks:,} / {headers:,}')
    
    if headers > 0:
        sync_pct = (blocks / headers) * 100
        remaining = headers - blocks
        print(f'📈 Progress: {sync_pct:.2f}%')
        print(f'   Remaining: {remaining:,} blocks')
        
        # Progress bar
        bar_width = 40
        filled = int(bar_width * sync_pct / 100)
        bar = '█' * filled + '░' * (bar_width - filled)
        print(f'   [{bar}] {sync_pct:.1f}%')
        print('')
    
    print(f'🔍 Verification: {progress * 100:.4f}%')
    print('')
    
    if ibd:
        print('⏳ Status: SYNCING')
        if remaining > 0:
            # Rough estimate: testnet typically syncs at 50-200 blocks/min
            # Use conservative estimate
            blocks_per_min = 100  # Conservative estimate
            minutes_remaining = remaining / blocks_per_min
            
            if minutes_remaining < 60:
                print(f'⏱️  Estimated time: ~{int(minutes_remaining)} minutes')
            else:
                hours = int(minutes_remaining / 60)
                mins = int(minutes_remaining % 60)
                print(f'⏱️  Estimated time: ~{hours}h {mins}m')
            print('')
            print('   💡 For accurate estimates, use: ./monitor-bitcoin-sync.sh')
    else:
        print('✅ Status: FULLY SYNCED')
        print('   🎉 Node is ready!')
    
    print('')
    
    # Check RPC
    print('🔌 RPC Status: ✅ Ready' if not ibd or blocks > 0 else '🔌 RPC Status: ⏳ Initializing')
    
except Exception as e:
    print(f'Error: {e}')
PYTHON_SCRIPT
