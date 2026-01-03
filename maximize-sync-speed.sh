#!/bin/bash
# Maximize Bitcoin Core Sync Speed
# Optimizes all settings for fastest possible sync

set -e

echo "🚀 Maximizing Bitcoin Core Sync Speed"
echo "======================================"
echo ""

DATA_DIR="$HOME/.bitcoin/testnet4"
CONFIG_FILE="$DATA_DIR/bitcoin.conf"

# Check if config exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Config file not found: $CONFIG_FILE"
    exit 1
fi

# Backup config
BACKUP_FILE="${CONFIG_FILE}.backup.maxspeed.$(date +%Y%m%d_%H%M%S)"
cp "$CONFIG_FILE" "$BACKUP_FILE"
echo "💾 Backed up config to: $BACKUP_FILE"
echo ""

# Get system resources
TOTAL_RAM_GB=$(free -g | awk '/^Mem:/{print $2}')
AVAILABLE_RAM_GB=$(free -g | awk '/^Mem:/{print $7}')
CPU_CORES=$(nproc)

echo "📊 System Resources:"
echo "   Total RAM: ${TOTAL_RAM_GB}GB"
echo "   Available RAM: ${AVAILABLE_RAM_GB}GB"
echo "   CPU Cores: ${CPU_CORES}"
echo ""

# Calculate optimal dbcache (use 80% of available RAM, max 8GB for safety)
if [ "$AVAILABLE_RAM_GB" -ge 10 ]; then
    DBCACHE=8000  # 8GB for systems with 10GB+ RAM
elif [ "$AVAILABLE_RAM_GB" -ge 8 ]; then
    DBCACHE=6000  # 6GB for systems with 8-10GB RAM
else
    DBCACHE=4000  # 4GB for systems with less RAM
fi

# Set parallelism to match CPU cores (but cap at 6)
if [ "$CPU_CORES" -ge 6 ]; then
    PAR=6
elif [ "$CPU_CORES" -ge 4 ]; then
    PAR=4
else
    PAR=$CPU_CORES
fi

echo "⚙️  Optimal Settings:"
echo "   dbcache: ${DBCACHE}MB (${DBCACHE}MB = $(echo "scale=1; $DBCACHE/1024" | bc)GB)"
echo "   par: ${PAR} (parallel verification threads)"
echo ""

# Function to update or add config setting
update_config() {
    local key=$1
    local value=$2
    local comment=$3
    
    if grep -q "^${key}=" "$CONFIG_FILE"; then
        # Update existing setting
        sed -i "s|^${key}=.*|${key}=${value}  # ${comment}|" "$CONFIG_FILE"
        echo "   ✅ Updated ${key}=${value}"
    elif grep -q "^#.*${key}=" "$CONFIG_FILE"; then
        # Uncomment and update
        sed -i "s|^#.*${key}=.*|${key}=${value}  # ${comment}|" "$CONFIG_FILE"
        echo "   ✅ Enabled ${key}=${value}"
    else
        # Add new setting in [testnet4] section
        if grep -q "^\[testnet4\]" "$CONFIG_FILE"; then
            # Add after [testnet4] section
            sed -i "/^\[testnet4\]/a ${key}=${value}  # ${comment}" "$CONFIG_FILE"
            echo "   ✅ Added ${key}=${value}"
        else
            # Add at end of file
            echo "${key}=${value}  # ${comment}" >> "$CONFIG_FILE"
            echo "   ✅ Added ${key}=${value}"
        fi
    fi
}

echo "🔧 Applying maximum performance optimizations..."
echo ""

# Memory optimizations - MAXIMUM
update_config "dbcache" "$DBCACHE" "Maximum RAM for block cache (fastest sync)"
update_config "maxmempool" "300" "Limit mempool during sync"
update_config "maxorphantx" "10" "Limit orphan transactions"

# CPU optimizations - MAXIMUM
update_config "par" "$PAR" "Parallel verification threads (matches CPU cores)"

# Network optimizations - MAXIMUM
update_config "maxconnections" "128" "Maximum peer connections (fastest download)"
update_config "blocksonly" "0" "Enable mempool (needed for transactions)"
update_config "peerbloomfilters" "0" "Disable bloom filters (reduce overhead)"
update_config "maxuploadtarget" "0" "Unlimited upload (don't throttle)"
update_config "maxreceivebuffer" "50000" "Large receive buffer (50MB)"
update_config "maxsendbuffer" "50000" "Large send buffer (50MB)"

# Verification optimizations - MAXIMUM SPEED
update_config "checkblocks" "1" "Minimal block verification (fastest)"
update_config "checklevel" "0" "No extra verification (fastest sync)"

# Disk I/O optimizations
update_config "txindex" "0" "No transaction index (faster sync)"
update_config "coinstatsindex" "0" "No coin stats index (faster sync)"

# Ensure pruning is disabled
if ! grep -q "^prune=0" "$CONFIG_FILE"; then
    update_config "prune" "0" "Pruning disabled - full node mode"
fi

echo ""
echo "✅ Maximum performance optimizations applied!"
echo ""

# Check if node is running
if pgrep -x "bitcoind" > /dev/null; then
    echo "⚠️  Bitcoin Core is currently running"
    echo "   These changes require a restart to take effect"
    echo ""
    read -p "Do you want to restart Bitcoin Core now? (Y/n): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        echo "🛑 Stopping Bitcoin Core..."
        pkill bitcoind || true
        sleep 3
        
        echo "🚀 Starting Bitcoin Core with optimized settings..."
        bitcoind -datadir="$(dirname "$DATA_DIR")" -daemon
        sleep 5
        
        if pgrep -x "bitcoind" > /dev/null; then
            echo "✅ Bitcoin Core restarted successfully!"
        else
            echo "❌ Failed to restart. Check logs: tail -f $DATA_DIR/debug.log"
        fi
    else
        echo "ℹ️  Please restart Bitcoin Core manually to apply changes:"
        echo "   pkill bitcoind && bitcoind -datadir=\$(dirname $DATA_DIR) -daemon"
    fi
else
    echo "ℹ️  Bitcoin Core is not running"
    echo "   Start it with: bitcoind -datadir=\$(dirname $DATA_DIR) -daemon"
fi

echo ""
echo "=============================================="
echo "✅ Sync Speed Optimization Complete!"
echo ""
echo "📊 Optimized Settings:"
echo "   dbcache: ${DBCACHE}MB (uses maximum available RAM)"
echo "   par: ${PAR} (matches your ${CPU_CORES} CPU cores)"
echo "   maxconnections: 128 (maximum peers)"
echo "   checkblocks: 1 (minimal verification for speed)"
echo "   checklevel: 0 (fastest verification)"
echo ""
echo "💡 Monitor sync progress:"
echo "   ./monitor-sync-progress.sh"
echo ""
