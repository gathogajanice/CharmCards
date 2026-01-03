#!/bin/bash
# Real-time Bitcoin Core Resource Monitor
# Shows live CPU and memory usage to verify optimization

INTERVAL=${1:-2}  # Update every 2 seconds

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

if ! pgrep -x bitcoind > /dev/null; then
    echo -e "${RED}❌ Bitcoin Core is NOT running${NC}"
    exit 1
fi

PID=$(pgrep -x bitcoind | head -1)

echo -e "${CYAN}${BOLD}🔍 Bitcoin Core Resource Monitor${NC}"
echo "======================================"
echo "Update interval: ${INTERVAL} seconds"
echo "Press Ctrl+C to stop"
echo ""

while true; do
    clear
    echo -e "${CYAN}${BOLD}🔍 Bitcoin Core Resource Monitor - $(date '+%H:%M:%S')${NC}"
    echo "======================================"
    echo ""
    
    # Memory Usage
    RSS_KB=$(cat /proc/$PID/status 2>/dev/null | grep VmRSS | awk '{print $2}')
    VMSIZE_KB=$(cat /proc/$PID/status 2>/dev/null | grep VmSize | awk '{print $2}')
    
    if [ -n "$RSS_KB" ]; then
        RSS_GB=$(echo "scale=2; $RSS_KB / 1024 / 1024" | bc)
        VMSIZE_GB=$(echo "scale=2; $VMSIZE_KB / 1024 / 1024" | bc)
        RSS_MB=$(echo "scale=0; $RSS_KB / 1024" | bc)
        
        echo -e "${BOLD}📊 MEMORY USAGE:${NC}"
        echo "  Current RAM Usage: ${GREEN}${RSS_GB} GB${NC} (${RSS_MB} MB)"
        echo "  Virtual Memory: ${VMSIZE_GB} GB"
        echo "  Configured dbcache limit: ${YELLOW}9 GB (9000 MB)${NC}"
        echo ""
        
        # Show progress bar for dbcache usage
        DBCACHE_USAGE=$(echo "scale=0; $RSS_MB * 100 / 9000" | bc)
        if [ "$DBCACHE_USAGE" -gt 100 ]; then
            DBCACHE_USAGE=100
        fi
        BAR_WIDTH=30
        FILLED=$(echo "scale=0; $BAR_WIDTH * $DBCACHE_USAGE / 100" | bc)
        BAR=""
        for i in $(seq 1 $BAR_WIDTH); do
            if [ $i -le $FILLED ]; then
                BAR="${BAR}█"
            else
                BAR="${BAR}░"
            fi
        done
        echo "  dbcache Usage: [${BAR}] ${DBCACHE_USAGE}%"
        echo "  💡 dbcache grows as blocks are processed (currently using ${RSS_MB}MB of 9000MB limit)"
        echo ""
    fi
    
    # CPU Usage
    echo -e "${BOLD}⚡ CPU USAGE:${NC}"
    CPU_CORES=$(nproc)
    THREADS=$(ps -eLf 2>/dev/null | grep bitcoind | grep -v grep | wc -l)
    
    # Get per-core CPU usage
    CPU_STATS=$(mpstat -P ALL 1 1 2>/dev/null | grep -E "^[ ]*[0-9]" | tail -n +2)
    
    echo "  CPU Cores: ${CPU_CORES}"
    echo "  Active Threads: ${GREEN}${THREADS}${NC}"
    echo "  Configured Parallelism: 6"
    echo ""
    
    echo "  Per-Core Usage:"
    echo "$CPU_STATS" | while read line; do
        CORE=$(echo "$line" | awk '{print $3}')
        if [ "$CORE" = "all" ]; then
            USAGE=$(echo "$line" | awk '{printf "%.1f", 100-$NF}')
            echo -e "    ${CYAN}All Cores Average: ${GREEN}${USAGE}%${NC}"
        else
            USAGE=$(echo "$line" | awk '{printf "%.1f", 100-$NF}')
            if (( $(echo "$USAGE > 80" | bc -l) )); then
                COLOR=$GREEN
            elif (( $(echo "$USAGE > 50" | bc -l) )); then
                COLOR=$YELLOW
            else
                COLOR=$RED
            fi
            echo -e "    Core ${CORE}: ${COLOR}${USAGE}%${NC}"
        fi
    done
    
    # Overall CPU from top
    CPU_PCT=$(top -bn1 -p $PID 2>/dev/null | tail -1 | awk '{print $9}')
    if [ -n "$CPU_PCT" ]; then
        echo ""
        echo -e "  Overall CPU: ${GREEN}${CPU_PCT}%${NC}"
        if (( $(echo "$CPU_PCT > 200" | bc -l) )); then
            echo -e "  ${GREEN}✅ Using multiple cores effectively!${NC}"
        fi
    fi
    echo ""
    
    # System Resources
    echo -e "${BOLD}💻 SYSTEM RESOURCES:${NC}"
    TOTAL_RAM=$(free -h | grep Mem | awk '{print $2}')
    USED_RAM=$(free -h | grep Mem | awk '{print $3}')
    AVAIL_RAM=$(free -h | grep Mem | awk '{print $7}')
    echo "  Total RAM: ${TOTAL_RAM}"
    echo "  Used RAM: ${USED_RAM}"
    echo "  Available RAM: ${GREEN}${AVAIL_RAM}${NC}"
    echo ""
    
    # Sync Status
    echo -e "${BOLD}📈 SYNC STATUS:${NC}"
    BC_INFO=$(bitcoin-cli -chain=testnet4 -datadir=$HOME/.bitcoin/testnet4 getblockchaininfo 2>&1)
    if [ $? -eq 0 ]; then
        BLOCKS=$(echo "$BC_INFO" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('blocks',0))" 2>/dev/null)
        HEADERS=$(echo "$BC_INFO" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('headers',0))" 2>/dev/null)
        PROGRESS=$(echo "$BC_INFO" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f\"{d.get('verificationprogress',0)*100:.2f}\")" 2>/dev/null)
        IBD=$(echo "$BC_INFO" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('initialblockdownload',True))" 2>/dev/null)
        
        if [ "$IBD" = "True" ]; then
            STATUS="${YELLOW}⏳ SYNCING${NC}"
        else
            STATUS="${GREEN}✅ SYNCED${NC}"
        fi
        
        echo "  Status: $STATUS"
        echo "  Blocks: ${BLOCKS} / ${HEADERS}"
        echo "  Progress: ${PROGRESS}%"
    else
        echo "  ⚠️  Could not get blockchain info"
    fi
    echo ""
    
    echo "======================================"
    echo -e "${CYAN}Next update in ${INTERVAL} seconds... (Ctrl+C to stop)${NC}"
    sleep $INTERVAL
done
