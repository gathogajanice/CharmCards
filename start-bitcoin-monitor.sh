#!/bin/bash
# Bitcoin Core Monitoring Launcher
# Provides easy access to all monitoring scripts

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🔍 Bitcoin Core Monitoring Launcher${NC}"
echo "======================================"
echo ""
echo "Select monitoring mode:"
echo ""
echo "  1) Real-time Health Monitor (recommended)"
echo "     - Updates every 5 seconds"
echo "     - Shows sync progress, network, mempool"
echo ""
echo "  2) Sync Monitor with Time Estimates"
echo "     - Updates every 10 seconds"
echo "     - Shows ETA and sync speed"
echo ""
echo "  3) API Health Monitor"
echo "     - Monitors API health endpoint"
echo "     - Requires API server running"
echo ""
echo "  4) Quick Status Check (one-time)"
echo "     - Single status check, no continuous monitoring"
echo ""
read -p "Enter choice [1-4] (default: 1): " choice
choice=${choice:-1}

case $choice in
    1)
        echo ""
        echo -e "${GREEN}Starting Real-time Health Monitor...${NC}"
        echo "Press Ctrl+C to stop"
        echo ""
        sleep 2
        ./monitor-bitcoin-core.sh
        ;;
    2)
        echo ""
        echo -e "${GREEN}Starting Sync Monitor with Time Estimates...${NC}"
        echo "Press Ctrl+C to stop"
        echo ""
        sleep 2
        ./monitor-bitcoin-sync.sh
        ;;
    3)
        echo ""
        echo -e "${GREEN}Starting API Health Monitor...${NC}"
        echo "Press Ctrl+C to stop"
        echo ""
        sleep 2
        ./monitor-bitcoin-health.sh
        ;;
    4)
        echo ""
        echo -e "${GREEN}Running Quick Status Check...${NC}"
        echo ""
        ./check-bitcoin-rpc.sh
        ;;
    *)
        echo -e "${YELLOW}Invalid choice. Exiting.${NC}"
        exit 1
        ;;
esac
