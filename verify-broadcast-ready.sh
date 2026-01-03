#!/bin/bash
# Comprehensive verification script for Bitcoin Core node sync and broadcasting readiness
# Verifies node is at 100% sync and broadcasting functionality is ready

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
DATA_DIR="$HOME/.bitcoin/testnet4"
CONFIG_FILE="$DATA_DIR/bitcoin.conf"
API_URL="${API_URL:-http://localhost:3001}"
EXPECTED_PORT=18332

# Check if bitcoin-cli is available
BITCOIN_CLI=""
if command -v bitcoin-cli &> /dev/null; then
    BITCOIN_CLI="bitcoin-cli"
elif [ -f ~/.local/bin/bitcoin-cli ]; then
    BITCOIN_CLI=~/.local/bin/bitcoin-cli
else
    echo -e "${RED}❌ bitcoin-cli not found${NC}"
    exit 1
fi

echo -e "${CYAN}🔍 Bitcoin Core Broadcast Readiness Verification${NC}"
echo "=================================================="
echo ""

# Track overall status
SYNC_READY=false
RPC_READY=false
API_READY=false
BROADCAST_READY=false

# ============================================================================
# Step 1: Check Node Sync Status
# ============================================================================
echo -e "${BLUE}Step 1: Checking Node Sync Status...${NC}"

if ! pgrep -x "bitcoind" > /dev/null; then
    echo -e "${RED}❌ Bitcoin Core is NOT running${NC}"
    echo ""
    echo "Start it with:"
    echo "  bitcoind -chain=testnet4 -datadir=$DATA_DIR -daemon"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Bitcoin Core process is running${NC}"

# Get blockchain info
BC_INFO=$($BITCOIN_CLI -chain=testnet4 -datadir="$DATA_DIR" getblockchaininfo 2>&1)
BC_EXIT=$?

if [ $BC_EXIT -ne 0 ]; then
    echo -e "${RED}❌ Cannot connect to Bitcoin Core RPC${NC}"
    echo "   Error: $(echo "$BC_INFO" | head -1)"
    echo ""
    exit 1
fi

# Parse blockchain info using a safer method
SYNC_STATUS=$(echo "$BC_INFO" | python3 -c "
import json
import sys

try:
    data = json.load(sys.stdin)
    
    blocks = data.get('blocks', 0)
    headers = data.get('headers', 0)
    progress = data.get('verificationprogress', 0)
    ibd = data.get('initialblockdownload', True)
    chain = data.get('chain', 'unknown')
    
    # Calculate sync percentage
    if headers > 0:
        block_percent = (blocks / headers) * 100
    else:
        block_percent = 0
    
    # Check if fully synced
    is_synced = not ibd and blocks == headers and progress >= 0.9999
    
    # Output JSON for bash to parse
    result = {
        'blocks': blocks,
        'headers': headers,
        'progress': progress,
        'progress_percent': progress * 100,
        'block_percent': block_percent,
        'ibd': ibd,
        'chain': chain,
        'is_synced': is_synced
    }
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({'error': str(e)}))
" 2>&1)

if echo "$SYNC_STATUS" | grep -q '"error"'; then
    ERROR_MSG=$(echo "$SYNC_STATUS" | python3 -c "import json,sys; print(json.load(sys.stdin).get('error','Unknown error'))" 2>/dev/null || echo "Unknown error")
    echo -e "${RED}❌ Error parsing blockchain info: $ERROR_MSG${NC}"
    echo "   Raw response: $(echo "$BC_INFO" | head -3)"
    exit 1
fi

BLOCKS=$(echo "$SYNC_STATUS" | python3 -c "import json,sys; print(int(json.load(sys.stdin).get('blocks',0)))")
HEADERS=$(echo "$SYNC_STATUS" | python3 -c "import json,sys; print(int(json.load(sys.stdin).get('headers',0)))")
PROGRESS=$(echo "$SYNC_STATUS" | python3 -c "import json,sys; print(float(json.load(sys.stdin).get('progress_percent',0)))")
BLOCK_PERCENT=$(echo "$SYNC_STATUS" | python3 -c "import json,sys; print(float(json.load(sys.stdin).get('block_percent',0)))")
IBD=$(echo "$SYNC_STATUS" | python3 -c "import json,sys; print(json.load(sys.stdin).get('ibd',True))")
CHAIN=$(echo "$SYNC_STATUS" | python3 -c "import json,sys; print(json.load(sys.stdin).get('chain','unknown'))")
IS_SYNCED=$(echo "$SYNC_STATUS" | python3 -c "import json,sys; print(json.load(sys.stdin).get('is_synced',False))")

echo "   Network: $CHAIN"
echo "   Blocks: $(printf "%'d" $BLOCKS) / $(printf "%'d" $HEADERS)"
echo "   Block Progress: $(printf "%.2f" $BLOCK_PERCENT)%"
echo "   Verification Progress: $(printf "%.2f" $PROGRESS)%"
echo "   Initial Block Download: $([ "$IBD" = "False" ] && echo "Complete" || echo "In Progress")"
echo ""

if [ "$IS_SYNCED" = "True" ]; then
    echo -e "${GREEN}✅ Node Sync Status: 100% SYNCED${NC}"
    SYNC_READY=true
else
    echo -e "${YELLOW}⚠️  Node Sync Status: $(printf "%.2f" $BLOCK_PERCENT)% (not fully synced)${NC}"
    if [ "$IBD" = "True" ]; then
        REMAINING=$((HEADERS - BLOCKS))
        echo "   Remaining: ${REMAINING:,} blocks"
    fi
    SYNC_READY=false
fi
echo ""

# ============================================================================
# Step 2: Check RPC Configuration and Connectivity
# ============================================================================
echo -e "${BLUE}Step 2: Checking RPC Configuration...${NC}"

if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}❌ Configuration file not found: $CONFIG_FILE${NC}"
    RPC_READY=false
else
    echo -e "${GREEN}✅ Configuration file exists${NC}"
    
    # Check RPC settings
    RPC_SERVER=$(grep "^server=" "$CONFIG_FILE" | cut -d'=' -f2 || echo "")
    RPC_USER=$(grep "^rpcuser=" "$CONFIG_FILE" | cut -d'=' -f2 || echo "")
    RPC_PASSWORD=$(grep "^rpcpassword=" "$CONFIG_FILE" | cut -d'=' -f2 || echo "")
    RPC_PORT=$(grep "^rpcport=" "$CONFIG_FILE" | cut -d'=' -f2 || echo "$EXPECTED_PORT")
    
    if [ -z "$RPC_SERVER" ] || [ "$RPC_SERVER" != "1" ]; then
        echo -e "${YELLOW}⚠️  RPC server not enabled (server=1)${NC}"
        RPC_READY=false
    elif [ -z "$RPC_USER" ] || [ -z "$RPC_PASSWORD" ]; then
        echo -e "${YELLOW}⚠️  RPC credentials not configured${NC}"
        RPC_READY=false
    else
        echo "   RPC Server: Enabled"
        echo "   RPC User: $RPC_USER"
        echo "   RPC Port: $RPC_PORT"
        echo -e "${GREEN}✅ RPC Configuration: Valid${NC}"
        RPC_READY=true
    fi
fi
echo ""

# Test RPC connectivity
echo -e "${BLUE}Step 3: Testing RPC Connectivity...${NC}"

RPC_TEST=$($BITCOIN_CLI -chain=testnet4 -datadir="$DATA_DIR" getblockcount 2>&1)
if [ $? -eq 0 ] && [ -n "$RPC_TEST" ]; then
    echo -e "${GREEN}✅ RPC Connection: Connected${NC}"
    echo "   Current block height: ${RPC_TEST}"
    RPC_READY=true
else
    echo -e "${RED}❌ RPC Connection: Failed${NC}"
    echo "   Error: $(echo "$RPC_TEST" | head -1)"
    RPC_READY=false
fi
echo ""

# ============================================================================
# Step 4: Check API Readiness (if API server is running)
# ============================================================================
echo -e "${BLUE}Step 4: Checking API Readiness...${NC}"

# Check if API server is running
API_RUNNING=false
if curl -s --max-time 2 "$API_URL/health" > /dev/null 2>&1; then
    API_RUNNING=true
fi

if [ "$API_RUNNING" = "true" ]; then
    echo "   API Server: Running at $API_URL"
    
    # Test /api/broadcast/ready endpoint
    READY_RESPONSE=$(curl -s --max-time 5 "$API_URL/api/broadcast/ready" 2>&1)
    if echo "$READY_RESPONSE" | grep -q '"ready"'; then
        READY_STATUS=$(echo "$READY_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('ready',False))" 2>/dev/null || echo "false")
        READY_REASON=$(echo "$READY_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('reason',''))" 2>/dev/null || echo "")
        
        if [ "$READY_STATUS" = "True" ]; then
            echo -e "${GREEN}✅ API Readiness: Ready${NC}"
            echo "   Reason: $READY_REASON"
            API_READY=true
        else
            echo -e "${YELLOW}⚠️  API Readiness: Not Ready${NC}"
            echo "   Reason: $READY_REASON"
            API_READY=false
        fi
    else
        echo -e "${YELLOW}⚠️  Could not parse API readiness response${NC}"
        API_READY=false
    fi
    
    # Test /api/broadcast/health endpoint
    HEALTH_RESPONSE=$(curl -s --max-time 5 "$API_URL/api/broadcast/health" 2>&1)
    if echo "$HEALTH_RESPONSE" | grep -q '"status"'; then
        HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('status','unknown'))" 2>/dev/null || echo "unknown")
        echo "   Health Status: $HEALTH_STATUS"
    fi
else
    echo -e "${YELLOW}⚠️  API Server: Not running or not accessible${NC}"
    echo "   Skipping API checks (this is okay if API server is not started)"
    echo "   API URL: $API_URL"
    API_READY=false
fi
echo ""

# ============================================================================
# Step 5: Determine Overall Broadcasting Readiness
# ============================================================================
echo -e "${BLUE}Step 5: Broadcasting Readiness Assessment...${NC}"

if [ "$SYNC_READY" = "true" ] && [ "$RPC_READY" = "true" ]; then
    BROADCAST_READY=true
    echo -e "${GREEN}✅ Broadcasting: Ready for package broadcasting${NC}"
    echo ""
    echo "   Requirements met:"
    echo "   ✅ Node is fully synced (100%)"
    echo "   ✅ RPC is configured and connected"
    if [ "$API_READY" = "true" ]; then
        echo "   ✅ API endpoints are ready"
    else
        echo "   ⚠️  API server not running (optional for direct RPC use)"
    fi
else
    BROADCAST_READY=false
    echo -e "${YELLOW}⚠️  Broadcasting: Not ready${NC}"
    echo ""
    echo "   Missing requirements:"
    if [ "$SYNC_READY" = "false" ]; then
        echo "   ❌ Node is not fully synced ($(printf "%.2f" $BLOCK_PERCENT)%)"
    fi
    if [ "$RPC_READY" = "false" ]; then
        echo "   ❌ RPC is not configured or not connected"
    fi
fi
echo ""

# ============================================================================
# Summary
# ============================================================================
echo "=================================================="
echo -e "${CYAN}📊 Verification Summary${NC}"
echo "=================================================="
echo ""

if [ "$SYNC_READY" = "true" ]; then
    echo -e "${GREEN}✅ Node Sync Status: 100% ($(printf "%'d" $BLOCKS) / $(printf "%'d" $HEADERS) blocks)${NC}"
else
    echo -e "${YELLOW}⚠️  Node Sync Status: $(printf "%.2f" $BLOCK_PERCENT)% ($(printf "%'d" $BLOCKS) / $(printf "%'d" $HEADERS) blocks)${NC}"
fi

echo -e "${GREEN}✅ Verification Progress: $(printf "%.2f" $PROGRESS)%${NC}"

if [ "$IBD" = "False" ]; then
    echo -e "${GREEN}✅ Initial Block Download: Complete${NC}"
else
    echo -e "${YELLOW}⚠️  Initial Block Download: In Progress${NC}"
fi

if [ "$RPC_READY" = "true" ]; then
    echo -e "${GREEN}✅ RPC Connection: Connected${NC}"
else
    echo -e "${RED}❌ RPC Connection: Not Connected${NC}"
fi

if [ "$API_RUNNING" = "true" ]; then
    if [ "$API_READY" = "true" ]; then
        echo -e "${GREEN}✅ API Readiness: Ready${NC}"
    else
        echo -e "${YELLOW}⚠️  API Readiness: Not Ready${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  API Server: Not running (optional)${NC}"
fi

if [ "$BROADCAST_READY" = "true" ]; then
    echo -e "${GREEN}✅ Broadcasting: Ready for package broadcasting${NC}"
else
    echo -e "${RED}❌ Broadcasting: Not ready${NC}"
fi

echo ""

# Final verdict
if [ "$BROADCAST_READY" = "true" ]; then
    echo "=================================================="
    echo -e "${GREEN}🎉 All systems ready for transaction broadcasting!${NC}"
    echo "=================================================="
    echo ""
    echo "Your Bitcoin Core node is fully synced and ready to:"
    echo "  • Broadcast single transactions (sendrawtransaction)"
    echo "  • Broadcast transaction packages (submitpackage)"
    echo "  • Process Charms protocol transactions"
    echo ""
    exit 0
else
    echo "=================================================="
    echo -e "${YELLOW}⚠️  Broadcasting not ready yet${NC}"
    echo "=================================================="
    echo ""
    echo "Next steps:"
    if [ "$SYNC_READY" = "false" ]; then
        echo "  1. Wait for node to finish syncing"
        echo "     Monitor progress: ./monitor-bitcoin-sync.sh"
        echo "     Check status: ./check-bitcoin-sync.sh"
    fi
    if [ "$RPC_READY" = "false" ]; then
        echo "  2. Fix RPC configuration"
        echo "     Check config: cat $CONFIG_FILE | grep rpc"
        echo "     Run diagnostic: ./check-bitcoin-rpc.sh"
    fi
    if [ "$API_RUNNING" = "false" ] && [ "$API_READY" = "false" ]; then
        echo "  3. Start API server (optional)"
        echo "     cd api && npm run dev"
    fi
    echo ""
    exit 1
fi
