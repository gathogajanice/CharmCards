#!/bin/bash
# Full Bitcoin Core Sync Status Dashboard
# Comprehensive monitoring with all metrics

DATA_DIR="$HOME/.bitcoin/testnet4"
RPC_USER="charmcards_rpc"
RPC_PASS="cfefe807e63651370cd1b851dcaca04a2d5e1c24a1cc2bff28977110434beab2"
RPC_PORT=18332

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${BLUE}  BITCOIN CORE FULL SYNC STATUS DASHBOARD${NC}"
echo -e "${BOLD}${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""

# Check if node is running
if ! pgrep -x "bitcoind" > /dev/null; then
    echo -e "${RED}❌ Bitcoin Core is NOT running${NC}"
    echo "   Start it with: bitcoind -datadir=\$HOME/.bitcoin -daemon"
    exit 1
fi

echo -e "${GREEN}✅ Bitcoin Core is running${NC} (PID: $(pgrep -x bitcoind))"
echo ""

# Wait for RPC to be ready
echo -e "${YELLOW}⏳ Waiting for RPC to be ready...${NC}"
for i in {1..30}; do
    if bitcoin-cli -chain=testnet4 -datadir="$HOME/.bitcoin" \
        -rpcport=$RPC_PORT -rpcuser=$RPC_USER -rpcpassword=$RPC_PASS \
        getblockcount > /dev/null 2>&1; then
        echo -e "${GREEN}✅ RPC is ready!${NC}"
        echo ""
        break
    fi
    sleep 1
    echo -n "."
done
echo ""

# Get blockchain info
BLOCKCHAIN_INFO=$(bitcoin-cli -chain=testnet4 -datadir="$HOME/.bitcoin" \
    -rpcport=$RPC_PORT -rpcuser=$RPC_USER -rpcpassword=$RPC_PASS \
    getblockchaininfo 2>/dev/null)

if [ -z "$BLOCKCHAIN_INFO" ]; then
    echo -e "${RED}❌ Could not connect to RPC${NC}"
    echo "   Node may still be initializing. Try again in a few seconds."
    exit 1
fi

# Parse blockchain info
BLOCKS=$(echo "$BLOCKCHAIN_INFO" | grep -o '"blocks":[0-9]*' | cut -d: -f2)
HEADERS=$(echo "$BLOCKCHAIN_INFO" | grep -o '"headers":[0-9]*' | cut -d: -f2)
VERIFICATION_PROGRESS=$(echo "$BLOCKCHAIN_INFO" | grep -o '"verificationprogress":[0-9.]*' | cut -d: -f2)
PRUNED=$(echo "$BLOCKCHAIN_INFO" | grep -o '"pruned":[^,]*' | cut -d: -f2)
PRUNE_HEIGHT=$(echo "$BLOCKCHAIN_INFO" | grep -o '"pruneheight":[0-9]*' | cut -d: -f2 || echo "0")
CHAIN=$(echo "$BLOCKCHAIN_INFO" | grep -o '"chain":"[^"]*"' | cut -d'"' -f4)
INITIAL_BLOCK_DOWNLOAD=$(echo "$BLOCKCHAIN_INFO" | grep -o '"initialblockdownload":[^,]*' | cut -d: -f2)

# Get network info
NETWORK_INFO=$(bitcoin-cli -chain=testnet4 -datadir="$HOME/.bitcoin" \
    -rpcport=$RPC_PORT -rpcuser=$RPC_USER -rpcpassword=$RPC_PASS \
    getnetworkinfo 2>/dev/null)
CONNECTIONS=$(echo "$NETWORK_INFO" | grep -o '"connections":[0-9]*' | cut -d: -f2)

# Get mempool info
MEMPOOL_INFO=$(bitcoin-cli -chain=testnet4 -datadir="$HOME/.bitcoin" \
    -rpcport=$RPC_PORT -rpcuser=$RPC_USER -rpcpassword=$RPC_PASS \
    getmempoolinfo 2>/dev/null)
MEMPOOL_SIZE=$(echo "$MEMPOOL_INFO" | grep -o '"size":[0-9]*' | cut -d: -f2 || echo "0")

# Calculate progress
PROGRESS_PCT=$(echo "$VERIFICATION_PROGRESS * 100" | bc -l 2>/dev/null | xargs printf "%.2f" 2>/dev/null || echo "0.00")
BLOCKS_BEHIND=$((HEADERS - BLOCKS))

# System resources
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
MEM_USAGE=$(free | awk '/^Mem:/{printf "%.1f", $3/$2 * 100}')
DISK_USAGE=$(df -h "$HOME/.bitcoin" 2>/dev/null | tail -1 | awk '{print $5}')

echo -e "${BOLD}${CYAN}📊 SYNC STATUS${NC}"
echo -e "${CYAN}────────────────────────────────────────────────────────────${NC}"
echo -e "Chain: ${GREEN}$CHAIN${NC}"
echo -e "Blocks: ${GREEN}$BLOCKS${NC} / ${YELLOW}$HEADERS${NC} headers"
if [ "$BLOCKS_BEHIND" -gt 0 ]; then
    echo -e "Behind: ${YELLOW}$BLOCKS_BEHIND blocks${NC}"
fi
echo -e "Progress: ${GREEN}${PROGRESS_PCT}%${NC}"
echo -e "Pruned: ${PRUNED}"
if [ "$PRUNED" = "true" ]; then
    echo -e "${YELLOW}⚠️  Prune Height: $PRUNE_HEIGHT${NC}"
else
    echo -e "${GREEN}✅ Full node (no pruning)${NC}"
fi
if [ "$INITIAL_BLOCK_DOWNLOAD" = "true" ]; then
    echo -e "${YELLOW}🔄 Initial block download in progress...${NC}"
fi
echo ""

# Progress bar
BAR_WIDTH=50
if [ -n "$VERIFICATION_PROGRESS" ] && [ "$(echo "$VERIFICATION_PROGRESS > 0" | bc -l 2>/dev/null)" = "1" ]; then
    FILLED=$(echo "$VERIFICATION_PROGRESS * $BAR_WIDTH" | bc -l 2>/dev/null | cut -d. -f1)
    EMPTY=$((BAR_WIDTH - FILLED))
    printf "  ["
    printf "%${FILLED}s" | tr ' ' '█'
    printf "%${EMPTY}s" | tr ' ' '░'
    echo "] ${PROGRESS_PCT}%"
    echo ""
fi

echo -e "${BOLD}${CYAN}🌐 NETWORK${NC}"
echo -e "${CYAN}────────────────────────────────────────────────────────────${NC}"
echo -e "Connections: ${GREEN}$CONNECTIONS${NC} peers"
echo -e "Mempool: ${GREEN}$MEMPOOL_SIZE${NC} transactions"
echo ""

echo -e "${BOLD}${CYAN}💻 SYSTEM RESOURCES${NC}"
echo -e "${CYAN}────────────────────────────────────────────────────────────${NC}"
echo -e "CPU Usage: ${YELLOW}${CPU_USAGE}%${NC}"
echo -e "Memory Usage: ${YELLOW}${MEM_USAGE}%${NC}"
echo -e "Disk Usage: ${YELLOW}${DISK_USAGE}${NC}"
echo ""

# Get recent log entries
if [ -f "$DATA_DIR/debug.log" ]; then
    echo -e "${BOLD}${CYAN}📝 RECENT ACTIVITY${NC}"
    echo -e "${CYAN}────────────────────────────────────────────────────────────${NC}"
    tail -5 "$DATA_DIR/debug.log" 2>/dev/null | sed 's/^/  /' || echo "  (No recent log entries)"
    echo ""
fi

echo -e "${BOLD}${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}💡 Tips for faster sync:${NC}"
echo "   • Keep this terminal open"
echo "   • Don't close Bitcoin Core"
echo "   • Ensure stable internet connection"
echo "   • Monitor with: watch -n 5 ./full-sync-status.sh"
echo ""
