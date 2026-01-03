#!/bin/bash
# Bitcoin Core Node Optimization Script
# Applies performance optimizations to an existing Bitcoin Core node
# Backs up current configuration before making changes

set -e

echo "⚡ Bitcoin Core Node Optimization"
echo "=================================="
echo ""

DATA_DIR="$HOME/.bitcoin/testnet4"
CONFIG_FILE="$DATA_DIR/bitcoin.conf"

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Configuration file not found: $CONFIG_FILE"
    echo ""
    echo "Please run setup-bitcoin-node.sh first to create the initial configuration."
    exit 1
fi

# Check if bitcoind is installed
if ! command -v bitcoind &> /dev/null; then
    echo "❌ Bitcoin Core (bitcoind) not found!"
    exit 1
fi

echo "✅ Found configuration file: $CONFIG_FILE"
echo ""

# Create backup
BACKUP_FILE="${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
echo "📦 Creating backup: $BACKUP_FILE"
cp "$CONFIG_FILE" "$BACKUP_FILE"
echo "✅ Backup created successfully"
echo ""

# Check if node is running
NODE_RUNNING=false
if pgrep -x "bitcoind" > /dev/null; then
    NODE_RUNNING=true
    echo "⚠️  Bitcoin Core is currently running"
    echo "   The node will need to be restarted for changes to take effect."
    echo ""
fi

# Read current config
echo "📖 Reading current configuration..."
CURRENT_CONFIG=$(cat "$CONFIG_FILE")

# Function to update or add config option
update_config() {
    local key=$1
    local value=$2
    local comment=$3
    
    # Check if key exists
    if grep -q "^${key}=" "$CONFIG_FILE"; then
        # Update existing value
        if [ -n "$comment" ]; then
            sed -i "s|^${key}=.*|${key}=${value}  # ${comment}|" "$CONFIG_FILE"
        else
            sed -i "s|^${key}=.*|${key}=${value}|" "$CONFIG_FILE"
        fi
    else
        # Add new value
        if [ -n "$comment" ]; then
            echo "${key}=${value}  # ${comment}" >> "$CONFIG_FILE"
        else
            echo "${key}=${value}" >> "$CONFIG_FILE"
        fi
    fi
}

# Function to add config section if it doesn't exist
add_section_if_missing() {
    local section=$1
    if ! grep -q "^# ${section}" "$CONFIG_FILE"; then
        echo "" >> "$CONFIG_FILE"
        echo "# ${section}" >> "$CONFIG_FILE"
    fi
}

echo "🔧 Applying optimizations..."
echo ""

# Ensure sections exist
add_section_if_missing "Memory Optimizations"
add_section_if_missing "CPU Optimizations"
add_section_if_missing "Network Optimizations"
add_section_if_missing "Verification Optimizations (Testnet-specific)"
add_section_if_missing "Disk I/O Optimizations"

# Memory Optimizations
update_config "dbcache" "9000" "9GB cache for faster block processing"
update_config "maxmempool" "300" "Limit mempool to prioritize sync"
update_config "maxorphantx" "10" "Limit orphan transactions"

# CPU Optimizations
update_config "par" "6" "Parallel script verification threads"

# Network Optimizations
update_config "maxconnections" "128" "More peers for faster sync"
update_config "blocksonly" "1" "Disable mempool during sync (faster)"
update_config "peerbloomfilters" "0" "Disable bloom filters (not needed)"
update_config "listenonion" "0" "Disable Tor (if not using)"

# Disk I/O Optimizations
update_config "txindex" "0" "Not needed for basic operations"
update_config "coinstatsindex" "0" "Not needed for basic operations"

# Note: assumevalid is left commented - user can uncomment and set manually
# To get assumevalid value: ./get-assumevalid.sh
# Or manually: bitcoin-cli -chain=testnet4 -datadir=$DATA_DIR getblockchaininfo | grep assumevalid

echo "✅ Optimizations applied successfully!"
echo ""

# Show summary of changes
echo "📊 Optimization Summary:"
echo "-----------------------"
echo "  Memory:"
echo "    - dbcache: 9000 MB (9GB)"
echo "    - maxmempool: 300 MB"
echo "    - maxorphantx: 10"
echo ""
echo "  CPU:"
echo "    - par: 6 threads"
echo ""
echo "  Network:"
echo "    - maxconnections: 128"
echo "    - blocksonly: 1 (enabled for faster sync)"
echo "    - peerbloomfilters: 0 (disabled)"
echo "    - listenonion: 0 (disabled)"
echo ""
echo "  Disk I/O:"
echo "    - txindex: 0 (disabled)"
echo "    - coinstatsindex: 0 (disabled)"
echo ""

# Ask about restarting if node is running
if [ "$NODE_RUNNING" = true ]; then
    echo "⚠️  IMPORTANT: Bitcoin Core must be restarted for changes to take effect."
    echo ""
    read -p "Do you want to restart Bitcoin Core now? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        echo "🛑 Stopping Bitcoin Core..."
        pkill bitcoind || true
        sleep 3
        
        echo "🚀 Starting Bitcoin Core with optimized settings..."
        bitcoind -testnet -datadir="$DATA_DIR" -daemon
        sleep 3
        
        if pgrep -x "bitcoind" > /dev/null; then
            echo "✅ Bitcoin Core restarted successfully!"
            echo ""
            echo "📊 Checking node status..."
            sleep 2
            bitcoin-cli -chain=testnet4 -datadir="$DATA_DIR" getblockchaininfo 2>/dev/null | head -10 || echo "   (Node is still starting up, this is normal)"
        else
            echo "❌ Failed to restart Bitcoin Core. Check logs: tail -f $DATA_DIR/debug.log"
            echo ""
            echo "💡 You can restore the backup with:"
            echo "   cp $BACKUP_FILE $CONFIG_FILE"
            exit 1
        fi
    else
        echo ""
        echo "⚠️  Remember to restart Bitcoin Core manually for changes to take effect:"
        echo "   pkill bitcoind"
        echo "   bitcoind -testnet -datadir=$DATA_DIR -daemon"
    fi
fi

echo ""
echo "======================================"
echo "✅ Optimization Complete!"
echo ""
echo "📝 Notes:"
echo ""
echo "  - Original config backed up to: $BACKUP_FILE"
echo ""
echo "  - blocksonly mode is enabled for faster sync"
echo "    After sync completes, you can disable it by setting blocksonly=0"
echo "    in $CONFIG_FILE and restarting the node"
echo ""
echo "  - To monitor sync progress:"
echo "    ./monitor-bitcoin-sync.sh"
echo ""
echo "  - To verify optimizations:"
echo "    ./verify-resources.sh"
echo ""
echo "  - To restore original config:"
echo "    cp $BACKUP_FILE $CONFIG_FILE"
echo "    (then restart the node)"
echo ""
