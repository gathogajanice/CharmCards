#!/bin/bash
# Continuous Bitcoin Core Sync Monitor
# Refreshes every 5 seconds

while true; do
    clear
    ./full-sync-status.sh
    echo ""
    echo -e "${YELLOW}Refreshing in 5 seconds... (Ctrl+C to stop)${NC}"
    sleep 5
done
