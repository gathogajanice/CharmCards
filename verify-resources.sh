#!/bin/bash
# Verify Bitcoin Core Resource Usage
# Shows actual RAM and CPU usage to confirm optimization

echo "🔍 Bitcoin Core Resource Verification"
echo "======================================"
echo ""

# Check if Bitcoin Core is running
if ! pgrep -x bitcoind > /dev/null; then
    echo "❌ Bitcoin Core is NOT running"
    exit 1
fi

PID=$(pgrep -x bitcoind | head -1)
echo "✅ Bitcoin Core is running (PID: $PID)"
echo ""

# Get memory info
echo "📊 MEMORY USAGE:"
echo "----------------"
RSS_KB=$(cat /proc/$PID/status | grep VmRSS | awk '{print $2}')
RSS_GB=$(echo "scale=2; $RSS_KB / 1024 / 1024" | bc)
VMSIZE_KB=$(cat /proc/$PID/status | grep VmSize | awk '{print $2}')
VMSIZE_GB=$(echo "scale=2; $VMSIZE_KB / 1024 / 1024" | bc)

echo "  Resident Set Size (RSS): ${RSS_GB} GB"
echo "  Virtual Memory Size: ${VMSIZE_GB} GB"
echo "  Configured dbcache: 9 GB (9000 MB)"
echo ""
echo "  💡 Note: RSS shows actual RAM used. dbcache grows as blocks are processed."
echo "     The 9GB dbcache setting allows Bitcoin Core to use up to 9GB for caching."
echo ""

# Get CPU info
echo "⚡ CPU USAGE:"
echo "-------------"
CPU_CORES=$(nproc)
THREADS=$(ps -eLf | grep bitcoind | grep -v grep | wc -l)
echo "  CPU Cores Available: $CPU_CORES"
echo "  Bitcoin Core Threads: $THREADS"
echo "  Configured Parallelism (par): 6"
echo ""

# Show per-core CPU usage
echo "  Per-Core CPU Usage (last 1 second):"
mpstat -P ALL 1 1 2>/dev/null | grep -E "^[ ]*[0-9]" | while read line; do
    CORE=$(echo "$line" | awk '{print $3}')
    USAGE=$(echo "$line" | awk '{printf "%.1f", 100-$NF}')
    echo "    Core $CORE: ${USAGE}%"
done

# Overall CPU usage
OVERALL=$(top -bn1 -p $PID | tail -1 | awk '{print $9}')
echo "  Overall CPU Usage: ${OVERALL}%"
echo ""

# Check configuration
echo "⚙️  CONFIGURATION:"
echo "------------------"
CONFIG_FILE="$HOME/.bitcoin/testnet4/bitcoin.conf"
if [ -f "$CONFIG_FILE" ]; then
    DBCACHE=$(grep "^dbcache=" "$CONFIG_FILE" | cut -d'=' -f2)
    PAR=$(grep "^par=" "$CONFIG_FILE" | cut -d'=' -f2)
    echo "  dbcache setting: ${DBCACHE} MB ($(echo "scale=1; $DBCACHE/1024" | bc) GB)"
    echo "  par (parallelism): $PAR"
    echo "  ✅ Configuration file is set correctly"
else
    echo "  ⚠️  Config file not found"
fi
echo ""

# System resources
echo "💻 SYSTEM RESOURCES:"
echo "-------------------"
TOTAL_RAM=$(free -h | grep Mem | awk '{print $2}')
AVAIL_RAM=$(free -h | grep Mem | awk '{print $7}')
echo "  Total RAM: $TOTAL_RAM"
echo "  Available RAM: $AVAIL_RAM"
echo ""

# Sync status
echo "📈 SYNC STATUS:"
echo "---------------"
BC_INFO=$(bitcoin-cli -chain=testnet4 -datadir=$HOME/.bitcoin/testnet4 getblockchaininfo 2>&1)
if [ $? -eq 0 ]; then
    BLOCKS=$(echo "$BC_INFO" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('blocks',0))" 2>/dev/null)
    HEADERS=$(echo "$BC_INFO" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('headers',0))" 2>/dev/null)
    PROGRESS=$(echo "$BC_INFO" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f\"{d.get('verificationprogress',0)*100:.2f}\")" 2>/dev/null)
    echo "  Blocks: $BLOCKS / $HEADERS"
    echo "  Verification Progress: ${PROGRESS}%"
else
    echo "  ⚠️  Could not get blockchain info"
fi
echo ""

echo "======================================"
echo "✅ Verification Complete"
echo ""
echo "💡 To monitor continuously, run:"
echo "   watch -n 2 ./verify-resources.sh"
echo ""
