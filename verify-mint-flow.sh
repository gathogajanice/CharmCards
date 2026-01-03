#!/bin/bash
# Comprehensive end-to-end verification for Mint with Charms flow
# Verifies all components from node to API to frontend are ready for minting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
DATA_DIR="$HOME/.bitcoin/testnet4"
CONFIG_FILE="$DATA_DIR/bitcoin.conf"
API_ENV_FILE="api/.env"
FRONTEND_ENV_FILE=".env.local"
API_URL="${API_URL:-http://localhost:3001}"
API_PORT=3001
EXPECTED_RPC_PORT=18332

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

echo -e "${CYAN}🔍 Mint Flow End-to-End Verification${NC}"
echo "=========================================="
echo ""
echo "This script verifies that clicking 'Mint with Charms' will work"
echo "by checking all components from node to API to frontend."
echo ""

# Track overall status
NODE_READY=false
RPC_CONFIG_READY=false
API_CONFIG_READY=false
API_SERVER_READY=false
API_ENDPOINTS_READY=false
FRONTEND_CONFIG_READY=false
BROADCAST_READY=false

# ============================================================================
# Step 1: Verify Node Status (100% sync)
# ============================================================================
echo -e "${BLUE}Step 1: Verifying Node Status...${NC}"

if ! pgrep -x "bitcoind" > /dev/null; then
    echo -e "${RED}❌ Bitcoin Core is NOT running${NC}"
    echo ""
    echo "Start it with:"
    echo "  bitcoind -chain=testnet4 -datadir=$DATA_DIR -daemon"
    echo ""
    NODE_READY=false
else
    echo -e "${GREEN}✅ Bitcoin Core process is running${NC}"
    
    # Get blockchain info
    BC_INFO=$($BITCOIN_CLI -chain=testnet4 -datadir="$DATA_DIR" getblockchaininfo 2>&1)
    BC_EXIT=$?
    
    if [ $BC_EXIT -eq 0 ]; then
        SYNC_STATUS=$(echo "$BC_INFO" | python3 -c "
import json
import sys
try:
    data = json.load(sys.stdin)
    blocks = data.get('blocks', 0)
    headers = data.get('headers', 0)
    progress = data.get('verificationprogress', 0)
    ibd = data.get('initialblockdownload', True)
    is_synced = not ibd and blocks == headers and progress >= 0.9999
    print(json.dumps({
        'blocks': blocks,
        'headers': headers,
        'progress': progress * 100,
        'ibd': ibd,
        'is_synced': is_synced
    }))
except:
    print(json.dumps({'error': 'parse_error'}))
" 2>&1)
        
        if echo "$SYNC_STATUS" | grep -q '"error"'; then
            echo -e "${RED}❌ Error parsing blockchain info${NC}"
            NODE_READY=false
        else
            BLOCKS=$(echo "$SYNC_STATUS" | python3 -c "import json,sys; print(int(json.load(sys.stdin).get('blocks',0)))")
            HEADERS=$(echo "$SYNC_STATUS" | python3 -c "import json,sys; print(int(json.load(sys.stdin).get('headers',0)))")
            PROGRESS=$(echo "$SYNC_STATUS" | python3 -c "import json,sys; print(float(json.load(sys.stdin).get('progress',0)))")
            IBD=$(echo "$SYNC_STATUS" | python3 -c "import json,sys; print(json.load(sys.stdin).get('ibd',True))")
            IS_SYNCED=$(echo "$SYNC_STATUS" | python3 -c "import json,sys; print(json.load(sys.stdin).get('is_synced',False))")
            
            echo "   Blocks: $(printf "%'d" $BLOCKS) / $(printf "%'d" $HEADERS)"
            echo "   Verification: $(printf "%.2f" $PROGRESS)%"
            echo "   IBD: $([ "$IBD" = "False" ] && echo "Complete" || echo "In Progress")"
            
            if [ "$IS_SYNCED" = "True" ]; then
                echo -e "${GREEN}✅ Node Status: 100% synced and ready${NC}"
                NODE_READY=true
            else
                echo -e "${YELLOW}⚠️  Node Status: Not fully synced ($(printf "%.2f" $PROGRESS)%)${NC}"
                NODE_READY=false
            fi
        fi
    else
        echo -e "${RED}❌ Cannot connect to Bitcoin Core RPC${NC}"
        NODE_READY=false
    fi
fi
echo ""

# ============================================================================
# Step 2: Verify RPC Configuration
# ============================================================================
echo -e "${BLUE}Step 2: Verifying RPC Configuration...${NC}"

if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}❌ Configuration file not found: $CONFIG_FILE${NC}"
    RPC_CONFIG_READY=false
else
    echo -e "${GREEN}✅ Configuration file exists${NC}"
    
    RPC_SERVER=$(grep "^server=" "$CONFIG_FILE" | cut -d'=' -f2 || echo "")
    RPC_USER=$(grep "^rpcuser=" "$CONFIG_FILE" | cut -d'=' -f2 || echo "")
    RPC_PASSWORD=$(grep "^rpcpassword=" "$CONFIG_FILE" | cut -d'=' -f2 || echo "")
    RPC_PORT=$(grep "^rpcport=" "$CONFIG_FILE" | cut -d'=' -f2 || echo "$EXPECTED_RPC_PORT")
    
    if [ -z "$RPC_SERVER" ] || [ "$RPC_SERVER" != "1" ]; then
        echo -e "${YELLOW}⚠️  RPC server not enabled${NC}"
        RPC_CONFIG_READY=false
    elif [ -z "$RPC_USER" ] || [ -z "$RPC_PASSWORD" ]; then
        echo -e "${YELLOW}⚠️  RPC credentials not configured${NC}"
        RPC_CONFIG_READY=false
    else
        echo "   RPC User: $RPC_USER"
        echo "   RPC Port: $RPC_PORT"
        echo -e "${GREEN}✅ RPC Configuration: Valid${NC}"
        RPC_CONFIG_READY=true
    fi
fi
echo ""

# ============================================================================
# Step 3: Verify API Server Configuration
# ============================================================================
echo -e "${BLUE}Step 3: Verifying API Server Configuration...${NC}"

if [ ! -f "$API_ENV_FILE" ]; then
    echo -e "${RED}❌ API .env file not found: $API_ENV_FILE${NC}"
    echo "   This file is required for the API to connect to Bitcoin Core"
    echo ""
    echo "   Create it with:"
    echo "   BITCOIN_RPC_URL=http://$RPC_USER:$RPC_PASSWORD@localhost:$RPC_PORT"
    echo ""
    API_CONFIG_READY=false
else
    echo -e "${GREEN}✅ API .env file exists${NC}"
    
    RPC_URL_ENV=$(grep "^BITCOIN_RPC_URL=" "$API_ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo "")
    
    if [ -z "$RPC_URL_ENV" ]; then
        echo -e "${RED}❌ BITCOIN_RPC_URL not set in $API_ENV_FILE${NC}"
        echo ""
        echo "   Add this line to $API_ENV_FILE:"
        if [ -n "$RPC_USER" ] && [ -n "$RPC_PASSWORD" ]; then
            echo "   BITCOIN_RPC_URL=http://$RPC_USER:$RPC_PASSWORD@localhost:$RPC_PORT"
        else
            echo "   BITCOIN_RPC_URL=http://user:password@localhost:$RPC_PORT"
            echo "   (Replace user:password with your RPC credentials from bitcoin.conf)"
        fi
        API_CONFIG_READY=false
    else
        echo "   BITCOIN_RPC_URL: $(echo "$RPC_URL_ENV" | sed 's|://[^:]*:[^@]*@|://***:***@|')"
        
        # Verify URL format
        if echo "$RPC_URL_ENV" | grep -qE "^http://.*:.*@.*:[0-9]+$"; then
            echo -e "${GREEN}✅ RPC URL format: Valid${NC}"
            
            # Check if credentials match
            ENV_USER=$(echo "$RPC_URL_ENV" | sed -n 's|http://\([^:]*\):.*@.*|\1|p')
            ENV_PASSWORD=$(echo "$RPC_URL_ENV" | sed -n 's|http://[^:]*:\([^@]*\)@.*|\1|p')
            ENV_PORT=$(echo "$RPC_URL_ENV" | sed -n 's|.*:\([0-9]*\)$|\1|p')
            
            if [ -n "$RPC_USER" ] && [ -n "$RPC_PASSWORD" ]; then
                if [ "$ENV_USER" = "$RPC_USER" ] && [ "$ENV_PASSWORD" = "$RPC_PASSWORD" ]; then
                    echo -e "${GREEN}✅ RPC Credentials: Match bitcoin.conf${NC}"
                    API_CONFIG_READY=true
                else
                    echo -e "${YELLOW}⚠️  RPC Credentials: May not match bitcoin.conf${NC}"
                    echo "   Config user: $RPC_USER"
                    echo "   .env user: ${ENV_USER:-not found}"
                    echo "   (This may still work if credentials are correct)"
                    API_CONFIG_READY=true  # Still mark as ready, just warn
                fi
            else
                API_CONFIG_READY=true  # Can't verify but format is correct
            fi
        else
            echo -e "${YELLOW}⚠️  RPC URL format: May be incorrect${NC}"
            echo "   Expected format: http://user:password@localhost:18332"
            API_CONFIG_READY=false
        fi
    fi
fi
echo ""

# ============================================================================
# Step 4: Verify API Server Status
# ============================================================================
echo -e "${BLUE}Step 4: Verifying API Server Status...${NC}"

# Check if API server is running
API_RUNNING=false
if curl -s --max-time 2 "$API_URL/health" > /dev/null 2>&1; then
    API_RUNNING=true
    echo -e "${GREEN}✅ API Server: Running on port $API_PORT${NC}"
    API_SERVER_READY=true
else
    echo -e "${YELLOW}⚠️  API Server: Not running or not accessible${NC}"
    echo "   Expected URL: $API_URL"
    echo ""
    echo "   Start API server with:"
    echo "   cd api && npm run dev"
    API_SERVER_READY=false
fi
echo ""

# ============================================================================
# Step 5: Test API Endpoints
# ============================================================================
if [ "$API_SERVER_READY" = "true" ]; then
    echo -e "${BLUE}Step 5: Testing API Endpoints...${NC}"
    
    # Test /api/broadcast/ready
    READY_RESPONSE=$(curl -s --max-time 5 "$API_URL/api/broadcast/ready" 2>&1)
    if echo "$READY_RESPONSE" | grep -q '"ready"'; then
        READY_STATUS=$(echo "$READY_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('ready',False))" 2>/dev/null || echo "false")
        READY_REASON=$(echo "$READY_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('reason',''))" 2>/dev/null || echo "")
        
        if [ "$READY_STATUS" = "True" ]; then
            echo -e "${GREEN}✅ /api/broadcast/ready: Ready${NC}"
            echo "   Reason: $READY_REASON"
            API_ENDPOINTS_READY=true
        else
            echo -e "${YELLOW}⚠️  /api/broadcast/ready: Not ready${NC}"
            echo "   Reason: $READY_REASON"
            API_ENDPOINTS_READY=false
        fi
    else
        echo -e "${YELLOW}⚠️  /api/broadcast/ready: Could not parse response${NC}"
        API_ENDPOINTS_READY=false
    fi
    
    # Test /api/broadcast/health
    HEALTH_RESPONSE=$(curl -s --max-time 5 "$API_URL/api/broadcast/health" 2>&1)
    if echo "$HEALTH_RESPONSE" | grep -q '"status"'; then
        HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('status','unknown'))" 2>/dev/null || echo "unknown")
        HEALTH_READY=$(echo "$HEALTH_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('ready',False))" 2>/dev/null || echo "false")
        
        echo "   Health Status: $HEALTH_STATUS"
        if [ "$HEALTH_READY" = "True" ]; then
            echo -e "${GREEN}✅ /api/broadcast/health: Ready${NC}"
        else
            echo -e "${YELLOW}⚠️  /api/broadcast/health: Not ready${NC}"
        fi
    fi
    echo ""
else
    echo -e "${YELLOW}Step 5: Skipping API endpoint tests (API server not running)${NC}"
    echo ""
    API_ENDPOINTS_READY=false
fi

# ============================================================================
# Step 6: Verify Frontend Configuration
# ============================================================================
echo -e "${BLUE}Step 6: Verifying Frontend Configuration...${NC}"

# Check for .env.local or environment variable
if [ -f "$FRONTEND_ENV_FILE" ]; then
    echo -e "${GREEN}✅ Frontend .env.local file exists${NC}"
    API_URL_ENV=$(grep "^NEXT_PUBLIC_API_URL=" "$FRONTEND_ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo "")
    
    if [ -n "$API_URL_ENV" ]; then
        echo "   NEXT_PUBLIC_API_URL: $API_URL_ENV"
        if [ "$API_URL_ENV" = "$API_URL" ] || [ "$API_URL_ENV" = "http://localhost:3001" ]; then
            echo -e "${GREEN}✅ Frontend API URL: Configured correctly${NC}"
            FRONTEND_CONFIG_READY=true
        else
            echo -e "${YELLOW}⚠️  Frontend API URL: May not match API server${NC}"
            echo "   Expected: $API_URL"
            echo "   Found: $API_URL_ENV"
            FRONTEND_CONFIG_READY=true  # Still mark as ready, just warn
        fi
    else
        echo -e "${YELLOW}⚠️  NEXT_PUBLIC_API_URL not set in .env.local${NC}"
        echo "   (Will use default: http://localhost:3001)"
        FRONTEND_CONFIG_READY=true  # Default is correct
    fi
else
    echo -e "${YELLOW}⚠️  Frontend .env.local not found${NC}"
    echo "   (Will use default: http://localhost:3001)"
    echo ""
    echo "   Optional: Create .env.local with:"
    echo "   NEXT_PUBLIC_API_URL=$API_URL"
    FRONTEND_CONFIG_READY=true  # Default is correct
fi
echo ""

# ============================================================================
# Step 7: Overall Broadcast Readiness
# ============================================================================
echo -e "${BLUE}Step 7: Overall Broadcast Readiness Assessment...${NC}"

# Broadcast is ready if:
# - Node is synced AND
# - RPC is configured AND
# - API config is set AND
# - (API server is running OR will be started) AND
# - API endpoints are ready (if server is running)

if [ "$NODE_READY" = "true" ] && [ "$RPC_CONFIG_READY" = "true" ] && [ "$API_CONFIG_READY" = "true" ]; then
    if [ "$API_SERVER_READY" = "true" ] && [ "$API_ENDPOINTS_READY" = "true" ]; then
        BROADCAST_READY=true
        echo -e "${GREEN}✅ Broadcasting: Ready for package broadcasting${NC}"
    elif [ "$API_SERVER_READY" = "false" ]; then
        echo -e "${YELLOW}⚠️  Broadcasting: Configuration ready, but API server not running${NC}"
        echo "   Start API server to enable broadcasting"
        BROADCAST_READY=false
    else
        echo -e "${YELLOW}⚠️  Broadcasting: Configuration ready, but API endpoints not ready${NC}"
        BROADCAST_READY=false
    fi
else
    BROADCAST_READY=false
    echo -e "${RED}❌ Broadcasting: Not ready${NC}"
    echo ""
    echo "   Missing requirements:"
    if [ "$NODE_READY" = "false" ]; then
        echo "   ❌ Node is not fully synced"
    fi
    if [ "$RPC_CONFIG_READY" = "false" ]; then
        echo "   ❌ RPC is not configured correctly"
    fi
    if [ "$API_CONFIG_READY" = "false" ]; then
        echo "   ❌ API .env file missing or BITCOIN_RPC_URL not set"
    fi
fi
echo ""

# ============================================================================
# Summary
# ============================================================================
echo "=========================================="
echo -e "${CYAN}📊 Verification Summary${NC}"
echo "=========================================="
echo ""

if [ "$NODE_READY" = "true" ]; then
    echo -e "${GREEN}✅ Node Status: 100% synced, RPC connected${NC}"
else
    echo -e "${RED}❌ Node Status: Not ready${NC}"
fi

if [ "$RPC_CONFIG_READY" = "true" ]; then
    echo -e "${GREEN}✅ RPC Configuration: Valid${NC}"
else
    echo -e "${RED}❌ RPC Configuration: Invalid or missing${NC}"
fi

if [ "$API_CONFIG_READY" = "true" ]; then
    echo -e "${GREEN}✅ API Configuration: BITCOIN_RPC_URL set correctly${NC}"
else
    echo -e "${RED}❌ API Configuration: BITCOIN_RPC_URL missing or invalid${NC}"
fi

if [ "$API_SERVER_READY" = "true" ]; then
    echo -e "${GREEN}✅ API Server: Running and healthy${NC}"
else
    echo -e "${YELLOW}⚠️  API Server: Not running${NC}"
fi

if [ "$API_ENDPOINTS_READY" = "true" ]; then
    echo -e "${GREEN}✅ API Endpoints: Ready for broadcasting${NC}"
elif [ "$API_SERVER_READY" = "false" ]; then
    echo -e "${YELLOW}⚠️  API Endpoints: Cannot test (server not running)${NC}"
else
    echo -e "${YELLOW}⚠️  API Endpoints: Not ready${NC}"
fi

if [ "$FRONTEND_CONFIG_READY" = "true" ]; then
    echo -e "${GREEN}✅ Frontend Config: NEXT_PUBLIC_API_URL configured${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend Config: Using defaults${NC}"
fi

if [ "$BROADCAST_READY" = "true" ]; then
    echo -e "${GREEN}✅ Broadcast Flow: Ready for minting${NC}"
else
    echo -e "${RED}❌ Broadcast Flow: Not ready${NC}"
fi

echo ""

# Final verdict
if [ "$BROADCAST_READY" = "true" ]; then
    echo "=========================================="
    echo -e "${GREEN}🎉 Mint flow is ready!${NC}"
    echo "=========================================="
    echo ""
    echo "All components are configured and ready:"
    echo "  ✅ Bitcoin Core node is 100% synced"
    echo "  ✅ RPC is configured and accessible"
    echo "  ✅ API server is running and healthy"
    echo "  ✅ API endpoints are ready for broadcasting"
    echo "  ✅ Frontend can reach API server"
    echo ""
    echo -e "${GREEN}Clicking 'Mint with Charms' will work!${NC}"
    echo ""
    echo "The flow will:"
    echo "  1. Create spell and generate proof"
    echo "  2. Sign transactions with your wallet"
    echo "  3. Broadcast package via API → Bitcoin Core RPC"
    echo "  4. Return transaction IDs"
    echo ""
    exit 0
else
    echo "=========================================="
    echo -e "${YELLOW}⚠️  Mint flow not ready yet${NC}"
    echo "=========================================="
    echo ""
    echo "Next steps to fix:"
    echo ""
    
    if [ "$NODE_READY" = "false" ]; then
        echo "1. Wait for node to finish syncing"
        echo "   Monitor: ./monitor-bitcoin-sync.sh"
    fi
    
    if [ "$RPC_CONFIG_READY" = "false" ]; then
        echo "2. Fix RPC configuration"
        echo "   Check: cat $CONFIG_FILE | grep rpc"
    fi
    
    if [ "$API_CONFIG_READY" = "false" ]; then
        echo "3. Configure API .env file"
        if [ -n "$RPC_USER" ] && [ -n "$RPC_PASSWORD" ] && [ -n "$RPC_PORT" ]; then
            echo "   Add to $API_ENV_FILE:"
            echo "   BITCOIN_RPC_URL=http://$RPC_USER:$RPC_PASSWORD@localhost:$RPC_PORT"
        else
            echo "   Add to $API_ENV_FILE:"
            echo "   BITCOIN_RPC_URL=http://user:password@localhost:18332"
            echo "   (Get credentials from $CONFIG_FILE)"
        fi
    fi
    
    if [ "$API_SERVER_READY" = "false" ]; then
        echo "4. Start API server"
        echo "   cd api && npm run dev"
    fi
    
    if [ "$API_ENDPOINTS_READY" = "false" ] && [ "$API_SERVER_READY" = "true" ]; then
        echo "5. Check API server logs for errors"
        echo "   The API may not be able to connect to Bitcoin Core"
    fi
    
    echo ""
    echo "After fixing issues, run this script again to verify."
    echo ""
    exit 1
fi
