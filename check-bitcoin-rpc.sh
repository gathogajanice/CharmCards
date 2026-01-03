#!/bin/bash
# Comprehensive Bitcoin Core RPC Diagnostic Script
# Checks node status, RPC connectivity, and configuration

set -e

echo "🔍 Bitcoin Core RPC Diagnostic"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DATA_DIR="$HOME/.bitcoin/testnet4"
CONFIG_FILE="$DATA_DIR/bitcoin.conf"
ENV_FILE="api/.env"
EXPECTED_PORT=18332
EXPECTED_NETWORK="testnet"

# Check if bitcoin-cli is available
BITCOIN_CLI=""
if command -v bitcoin-cli &> /dev/null; then
    BITCOIN_CLI="bitcoin-cli"
elif [ -f ~/.local/bin/bitcoin-cli ]; then
    BITCOIN_CLI=~/.local/bin/bitcoin-cli
else
    echo -e "${RED}❌ bitcoin-cli not found${NC}"
    echo "   Please install Bitcoin Core or add bitcoin-cli to your PATH"
    exit 1
fi

echo -e "${BLUE}Step 1: Checking if Bitcoin Core process is running...${NC}"
if pgrep -x "bitcoind" > /dev/null; then
    echo -e "${GREEN}✅ Bitcoin Core (bitcoind) process is running${NC}"
    echo "   PID: $(pgrep -x bitcoind | head -1)"
    echo "   Command: $(ps -p $(pgrep -x bitcoind | head -1) -o args= | head -1)"
else
    echo -e "${RED}❌ Bitcoin Core (bitcoind) process is NOT running${NC}"
    echo ""
    echo -e "${YELLOW}💡 Fix: Start Bitcoin Core with:${NC}"
    echo "   bitcoind -chain=testnet4 -datadir=$DATA_DIR -daemon"
    echo "   Or run: ./setup-bitcoin-node.sh"
    echo ""
    exit 1
fi

echo ""
echo -e "${BLUE}Step 2: Checking RPC configuration file...${NC}"
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}❌ Configuration file not found: $CONFIG_FILE${NC}"
    echo ""
    echo -e "${YELLOW}💡 Fix: Run the setup script:${NC}"
    echo "   ./setup-bitcoin-node.sh"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Configuration file exists: $CONFIG_FILE${NC}"

# Extract RPC config from bitcoin.conf
RPC_USER=$(grep "^rpcuser=" "$CONFIG_FILE" | cut -d'=' -f2 || echo "")
RPC_PASSWORD=$(grep "^rpcpassword=" "$CONFIG_FILE" | cut -d'=' -f2 || echo "")
RPC_PORT=$(grep "^rpcport=" "$CONFIG_FILE" | cut -d'=' -f2 || echo "")
RPC_BIND=$(grep "^rpcbind=" "$CONFIG_FILE" | cut -d'=' -f2 || echo "")

if [ -z "$RPC_USER" ] || [ -z "$RPC_PASSWORD" ]; then
    echo -e "${RED}❌ RPC credentials not found in config file${NC}"
    echo "   Missing: rpcuser or rpcpassword"
    echo ""
    echo -e "${YELLOW}💡 Fix: Run the setup script to regenerate config:${NC}"
    echo "   ./setup-bitcoin-node.sh"
    echo ""
    exit 1
fi

echo "   RPC User: $RPC_USER"
echo "   RPC Port: ${RPC_PORT:-$EXPECTED_PORT}"
echo "   RPC Bind: ${RPC_BIND:-127.0.0.1}"

echo ""
echo -e "${BLUE}Step 3: Checking .env file configuration...${NC}"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠️  .env file not found: $ENV_FILE${NC}"
    echo "   (This is okay if you're using environment variables directly)"
else
    echo -e "${GREEN}✅ .env file exists${NC}"
    
    # Extract RPC URL from .env
    RPC_URL_ENV=$(grep "^BITCOIN_RPC_URL=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' || echo "")
    
    if [ -z "$RPC_URL_ENV" ]; then
        echo -e "${YELLOW}⚠️  BITCOIN_RPC_URL not set in .env file${NC}"
    else
        # Parse URL to extract credentials
        ENV_USER=$(echo "$RPC_URL_ENV" | sed -n 's|http://\([^:]*\):.*@.*|\1|p')
        ENV_PASSWORD=$(echo "$RPC_URL_ENV" | sed -n 's|http://[^:]*:\([^@]*\)@.*|\1|p')
        ENV_PORT=$(echo "$RPC_URL_ENV" | sed -n 's|.*:\([0-9]*\)$|\1|p')
        
        echo "   RPC URL configured in .env"
        
        # Verify credentials match
        if [ "$ENV_USER" = "$RPC_USER" ] && [ "$ENV_PASSWORD" = "$RPC_PASSWORD" ]; then
            echo -e "${GREEN}✅ Credentials match between config and .env${NC}"
        else
            echo -e "${YELLOW}⚠️  Credentials in .env may not match bitcoin.conf${NC}"
            echo "   Config user: $RPC_USER"
            echo "   .env user: ${ENV_USER:-not found}"
        fi
        
        # Verify port
        if [ -n "$ENV_PORT" ] && [ "$ENV_PORT" = "${RPC_PORT:-$EXPECTED_PORT}" ]; then
            echo -e "${GREEN}✅ Port matches: $ENV_PORT${NC}"
        else
            echo -e "${YELLOW}⚠️  Port mismatch or not found${NC}"
            echo "   Expected: ${RPC_PORT:-$EXPECTED_PORT}"
            echo "   .env has: ${ENV_PORT:-not found}"
        fi
    fi
fi

echo ""
echo -e "${BLUE}Step 4: Testing RPC connection via bitcoin-cli...${NC}"

# Try to connect via bitcoin-cli
RPC_TEST_CMD="$BITCOIN_CLI -chain=testnet4 -datadir=$DATA_DIR getblockchaininfo 2>&1"
RPC_OUTPUT=$(eval "$RPC_TEST_CMD" 2>&1)
RPC_EXIT_CODE=$?

if [ $RPC_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ RPC connection successful!${NC}"
    echo ""
    
    # Parse blockchain info
    python3 << PYTHON_SCRIPT
import json
import sys

try:
    data = json.loads('''$RPC_OUTPUT''')
    
    chain = data.get('chain', 'unknown')
    blocks = data.get('blocks', 0)
    headers = data.get('headers', 0)
    progress = data.get('verificationprogress', 0)
    ibd = data.get('initialblockdownload', True)
    
    print(f"🌐 Network: {chain}")
    print(f"📦 Blocks: {blocks:,} / {headers:,}")
    
    if headers > 0:
        block_percent = (blocks / headers) * 100
        print(f"📈 Progress: {block_percent:.1f}%")
    
    print(f"🔍 Verification: {progress * 100:.2f}%")
    print("")
    
    if ibd:
        print("⏳ Status: SYNCING (Initial Block Download)")
        if blocks == 0 and headers == 0:
            print("   Node is connecting to network...")
        elif headers > blocks:
            remaining = headers - blocks
            print(f"   Downloading {remaining:,} blocks...")
        print("")
        print("💡 Node is usable for recent transactions even while syncing")
    else:
        print("✅ Status: FULLY SYNCED")
        print("")
        print("🎉 Node is ready for package broadcasting!")
    
except Exception as e:
    print(f"Error parsing response: {e}")
    print("Raw response:")
    print('''$RPC_OUTPUT''')
PYTHON_SCRIPT
    
else
    echo -e "${RED}❌ RPC connection failed${NC}"
    echo ""
    echo "Error output:"
    echo "$RPC_OUTPUT" | head -5
    echo ""
    
    # Provide specific fix suggestions based on error
    if echo "$RPC_OUTPUT" | grep -q "Connection refused"; then
        echo -e "${YELLOW}💡 Connection refused - Possible causes:${NC}"
        echo "   1. Node is still starting up (wait 30-60 seconds and try again)"
        echo "   2. RPC is not enabled in bitcoin.conf"
        echo "   3. Wrong port or bind address"
        echo ""
        echo "   Check if RPC is enabled:"
        echo "   grep '^server=' $CONFIG_FILE"
        echo "   grep '^rpcport=' $CONFIG_FILE"
    elif echo "$RPC_OUTPUT" | grep -q "Authentication failed"; then
        echo -e "${YELLOW}💡 Authentication failed - Credentials don't match${NC}"
        echo "   Verify credentials in:"
        echo "   - $CONFIG_FILE"
        echo "   - $ENV_FILE"
    elif echo "$RPC_OUTPUT" | grep -q "timed out"; then
        echo -e "${YELLOW}💡 Connection timed out${NC}"
        echo "   Node may be overloaded or network issues"
    fi
    
    echo ""
    echo -e "${YELLOW}💡 Troubleshooting steps:${NC}"
    echo "   1. Check node logs: tail -f $DATA_DIR/debug.log"
    echo "   2. Verify RPC config: cat $CONFIG_FILE | grep rpc"
    echo "   3. Restart node if needed: pkill bitcoind && bitcoind -chain=testnet4 -datadir=$DATA_DIR -daemon"
    echo ""
    exit 1
fi

echo ""
echo -e "${BLUE}Step 5: Testing RPC via HTTP (like the API does)...${NC}"

# Test HTTP RPC connection
RPC_URL="http://${RPC_USER}:${RPC_PASSWORD}@127.0.0.1:${RPC_PORT:-$EXPECTED_PORT}"
RPC_REQUEST='{"jsonrpc":"2.0","id":1,"method":"getblockchaininfo","params":[]}'

HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "$RPC_REQUEST" \
    "$RPC_URL" 2>&1) || HTTP_RESPONSE=""

HTTP_BODY=$(echo "$HTTP_RESPONSE" | head -n -1)
HTTP_CODE=$(echo "$HTTP_RESPONSE" | tail -n 1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ HTTP RPC connection successful!${NC}"
    echo "   This is how the API connects to Bitcoin Core"
else
    echo -e "${YELLOW}⚠️  HTTP RPC connection test:${NC}"
    if [ -z "$HTTP_CODE" ]; then
        echo "   Could not connect (curl may not be installed or connection failed)"
    else
        echo "   HTTP Status: $HTTP_CODE"
        echo "   Response: $HTTP_BODY" | head -3
    fi
fi

echo ""
echo "=============================="
echo -e "${GREEN}✅ Diagnostic complete!${NC}"
echo ""
echo "📝 Summary:"
if [ $RPC_EXIT_CODE -eq 0 ]; then
    echo "   • Bitcoin Core is running"
    echo "   • RPC is configured correctly"
    echo "   • Connection is working"
    echo ""
    echo "   Your API should be able to connect to Bitcoin Core RPC!"
else
    echo "   • Bitcoin Core is running"
    echo "   • RPC connection has issues"
    echo ""
    echo "   Follow the troubleshooting steps above to fix the connection."
fi
echo ""
