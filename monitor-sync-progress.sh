#!/bin/bash
# Real-time Bitcoin Core Sync Progress Monitor

DATA_DIR="$HOME/.bitcoin/testnet4"
RPC_USER="charmcards_rpc"
RPC_PASS="cfefe807e63651370cd1b851dcaca04a2d5e1c24a1cc2bff28977110434beab2"
RPC_PORT=18332

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

get_blockchain_info() {
    bitcoin-cli -chain=testnet4 -datadir="$HOME/.bitcoin" \
        -rpcport=$RPC_PORT \
        -rpcuser=$RPC_USER \
        -rpcpassword=$RPC_PASS \
        getblockchaininfo 2>/dev/null
}

get_network_info() {
    bitcoin-cli -chain=testnet4 -datadir="$HOME/.bitcoin" \
        -rpcport=$RPC_PORT \
        -rpcuser=$RPC_USER \
        -rpcpassword=$RPC_PASS \
        getnetworkinfo 2>/dev/null
}

get_peer_info() {
    bitcoin-cli -chain=testnet4 -datadir="$HOME/.bitcoin" \
        -rpcport=$RPC_PORT \
        -rpcuser=$RPC_USER \
        -rpcpassword=$RPC_PASS \
        getpeerinfo 2>/dev/null
}

# Check if node is running
if ! pgrep -x "bitcoind" > /dev/null; then
    echo -e "${RED}❌ Bitcoin Core is not running${NC}"
    exit 1
fi

# Check if RPC is ready
if ! get_blockchain_info > /dev/null 2>&1; then
    echo -e "${YELLOW}⏳ Bitcoin Core is starting up...${NC}"
    echo "   Waiting for RPC to be ready..."
    for i in {1..30}; do
        sleep 2
        if get_blockchain_info > /dev/null 2>&1; then
            echo -e "${GREEN}✅ RPC is ready!${NC}"
            break
        fi
        echo -n "."
    done
    echo ""
fi

# Get blockchain info
BLOCKCHAIN_INFO=$(get_blockchain_info)
if [ -z "$BLOCKCHAIN_INFO" ]; then
    echo -e "${RED}❌ Could not connect to Bitcoin Core RPC${NC}"
    echo "   Make sure the node is running and RPC is configured correctly"
    exit 1
fi

# Parse blockchain info
BLOCKS=$(echo "$BLOCKCHAIN_INFO" | grep -o '"blocks":[0-9]*' | cut -d: -f2)
VERIFICATION_PROGRESS=$(echo "$BLOCKCHAIN_INFO" | grep -o '"verificationprogress":[0-9.]*' | cut -d: -f2)
PRUNED=$(echo "$BLOCKCHAIN_INFO" | grep -o '"pruned":[^,]*' | cut -d: -f2)
PRUNE_HEIGHT=$(echo "$BLOCKCHAIN_INFO" | grep -o '"pruneheight":[0-9]*' | cut -d: -f2 || echo "0")
HEADERS=$(echo "$BLOCKCHAIN_INFO" | grep -o '"headers":[0-9]*' | cut -d: -f2)
CHAIN=$(echo "$BLOCKCHAIN_INFO" | grep -o '"chain":"[^"]*"' | cut -d'"' -f4)

# Get network info
NETWORK_INFO=$(get_network_info)
CONNECTIONS=$(echo "$NETWORK_INFO" | grep -o '"connections":[0-9]*' | cut -d: -f2)

# Calculate progress percentage
PROGRESS_PCT=$(echo "$VERIFICATION_PROGRESS * 100" | bc -l | xargs printf "%.2f")

# Get peer info for more details
PEER_INFO=$(get_peer_info)
PEER_COUNT=$(echo "$PEER_INFO" | grep -c '"addr"' || echo "0")

# Display status
clear
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Bitcoin Core Sync Progress Monitor${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${GREEN}Chain:${NC} $CHAIN"
echo -e "${GREEN}Pruned:${NC} $PRUNED"
if [ "$PRUNED" = "true" ]; then
    echo -e "${YELLOW}Prune Height:${NC} $PRUNE_HEIGHT"
fi
echo ""

echo -e "${BLUE}Sync Status:${NC}"
echo -e "  Blocks: ${GREEN}$BLOCKS${NC} / ${YELLOW}$HEADERS${NC} (headers)"
echo -e "  Progress: ${GREEN}${PROGRESS_PCT}%${NC}"
echo ""

# Progress bar
BAR_WIDTH=50
FILLED=$(echo "$VERIFICATION_PROGRESS * $BAR_WIDTH" | bc -l | cut -d. -f1)
EMPTY=$((BAR_WIDTH - FILLED))
printf "  ["
printf "%${FILLED}s" | tr ' ' '█'
printf "%${EMPTY}s" | tr ' ' '░'
echo "] ${PROGRESS_PCT}%"

echo ""
echo -e "${BLUE}Network:${NC}"
echo -e "  Connections: ${GREEN}$CONNECTIONS${NC} peers"
echo ""

# Estimate time remaining (rough calculation)
if [ "$(echo "$VERIFICATION_PROGRESS > 0" | bc -l)" = "1" ]; then
    REMAINING=$(echo "scale=2; (1 - $VERIFICATION_PROGRESS) / $VERIFICATION_PROGRESS" | bc -l)
    if [ "$(echo "$REMAINING > 0" | bc -l)" = "1" ]; then
        echo -e "${YELLOW}Note:${NC} Sync is in progress. Time remaining depends on network speed."
    fi
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "Press Ctrl+C to exit. Auto-refreshing every 5 seconds..."
echo ""
