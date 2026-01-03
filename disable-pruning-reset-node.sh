#!/bin/bash
# Disable Pruning and Reset Bitcoin Core Node
# This script disables pruning and optionally resets the blockchain for a fresh sync

set -e

echo "🔧 Disable Pruning and Reset Bitcoin Core Node"
echo "=============================================="
echo ""

# Data directory (same as setup script)
DATA_DIR="$HOME/.bitcoin/testnet4"
CONFIG_FILE="$DATA_DIR/bitcoin.conf"

# Check if bitcoind is installed
if ! command -v bitcoind &> /dev/null; then
    echo "❌ Bitcoin Core (bitcoind) not found!"
    echo "Please install Bitcoin Core first."
    exit 1
fi

echo "✅ Bitcoin Core found: $(bitcoind --version | head -1)"
echo ""

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Config file not found: $CONFIG_FILE"
    echo "Please run setup-bitcoin-node.sh first to create the configuration."
    exit 1
fi

echo "📁 Data directory: $DATA_DIR"
echo "📝 Config file: $CONFIG_FILE"
echo ""

# Stop Bitcoin Core if running
if pgrep -x "bitcoind" > /dev/null; then
    echo "🛑 Stopping Bitcoin Core..."
    pkill bitcoind || true
    sleep 3
    
    # Wait for it to fully stop
    for i in {1..10}; do
        if ! pgrep -x "bitcoind" > /dev/null; then
            break
        fi
        echo "   Waiting for Bitcoin Core to stop... ($i/10)"
        sleep 1
    done
    
    if pgrep -x "bitcoind" > /dev/null; then
        echo "⚠️  Bitcoin Core is still running. Please stop it manually: pkill bitcoind"
        exit 1
    fi
    
    echo "✅ Bitcoin Core stopped"
    echo ""
else
    echo "ℹ️  Bitcoin Core is not running"
    echo ""
fi

# Backup config file
if [ -f "$CONFIG_FILE" ]; then
    BACKUP_FILE="${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
    echo "💾 Backing up config file to: $BACKUP_FILE"
    cp "$CONFIG_FILE" "$BACKUP_FILE"
    echo "✅ Config backed up"
    echo ""
fi

# Remove or comment out prune settings
echo "🔧 Disabling pruning in config file..."
if grep -q "^prune=" "$CONFIG_FILE"; then
    # Remove prune setting
    sed -i '/^prune=/d' "$CONFIG_FILE"
    echo "   ✅ Removed prune setting"
elif grep -q "^#.*prune=" "$CONFIG_FILE"; then
    # Already commented out
    echo "   ℹ️  Prune setting already commented out"
else
    # Add comment explaining pruning is disabled
    if ! grep -q "^# Pruning" "$CONFIG_FILE"; then
        echo "" >> "$CONFIG_FILE"
        echo "# Pruning" >> "$CONFIG_FILE"
        echo "# prune=0  # Pruning disabled - full node mode" >> "$CONFIG_FILE"
        echo "   ✅ Added comment: pruning is disabled"
    fi
fi

# Ensure prune is explicitly set to 0 (disabled)
if ! grep -q "^prune=0" "$CONFIG_FILE"; then
    # Add prune=0 if not present
    if ! grep -q "^# Pruning" "$CONFIG_FILE"; then
        echo "" >> "$CONFIG_FILE"
        echo "# Pruning" >> "$CONFIG_FILE"
    fi
    echo "prune=0  # Pruning disabled - full node mode" >> "$CONFIG_FILE"
    echo "   ✅ Set prune=0 (disabled)"
fi

echo "✅ Pruning disabled in config"
echo ""

# Ask if user wants to reset blockchain data
echo "⚠️  RESET BLOCKCHAIN DATA?"
echo "   This will delete all downloaded blocks and force a fresh sync from scratch."
echo "   This is recommended to ensure the node syncs without any pruning artifacts."
echo ""
read -p "Do you want to delete blockchain data and start fresh? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Deleting blockchain data..."
    
    # Delete blocks directory
    if [ -d "$DATA_DIR/blocks" ]; then
        echo "   Deleting blocks directory..."
        rm -rf "$DATA_DIR/blocks"
        echo "   ✅ Blocks directory deleted"
    else
        echo "   ℹ️  Blocks directory not found (already empty)"
    fi
    
    # Delete chainstate directory
    if [ -d "$DATA_DIR/chainstate" ]; then
        echo "   Deleting chainstate directory..."
        rm -rf "$DATA_DIR/chainstate"
        echo "   ✅ Chainstate directory deleted"
    else
        echo "   ℹ️  Chainstate directory not found (already empty)"
    fi
    
    # Delete indexes if they exist
    if [ -d "$DATA_DIR/indexes" ]; then
        echo "   Deleting indexes directory..."
        rm -rf "$DATA_DIR/indexes"
        echo "   ✅ Indexes directory deleted"
    fi
    
    echo "✅ Blockchain data deleted - node will sync from scratch"
    echo ""
else
    echo "ℹ️  Keeping existing blockchain data"
    echo "   Note: If you had pruning enabled before, you may still have issues"
    echo "   with old UTXOs. Consider deleting blockchain data if problems persist."
    echo ""
fi

# Show current config
echo "📋 Current pruning configuration:"
if grep -q "^prune=" "$CONFIG_FILE"; then
    grep "^prune=" "$CONFIG_FILE" | head -1
else
    echo "   prune=0 (disabled - not explicitly set, which means disabled)"
fi
echo ""

# Ask if user wants to start the node
read -p "Do you want to start Bitcoin Core now? (Y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo "🚀 Starting Bitcoin Core..."
    # Use parent datadir - Bitcoin Core will use the chain-specific subdirectory from config
    bitcoind -datadir="$(dirname "$DATA_DIR")" -daemon
    sleep 5
    
    # Check if it started successfully
    if pgrep -x "bitcoind" > /dev/null; then
        echo "✅ Bitcoin Core started successfully!"
        echo ""
        echo "📊 Checking node status..."
        sleep 2
        
        # Try to get blockchain info
        if command -v bitcoin-cli &> /dev/null; then
            echo ""
            echo "Node Information:"
            bitcoin-cli -chain=testnet4 -datadir="$DATA_DIR" getblockchaininfo 2>/dev/null | grep -E "(blocks|pruned|pruneheight|verificationprogress)" || echo "   (Node is still starting up, this is normal)"
        fi
    else
        echo "❌ Failed to start Bitcoin Core. Check logs: tail -f $DATA_DIR/debug.log"
        exit 1
    fi
fi

echo ""
echo "=============================================="
echo "✅ Pruning Disabled and Node Reset Complete!"
echo ""
echo "📝 Summary:"
echo "   - Pruning: DISABLED (prune=0)"
echo "   - Node will sync all blocks (full node mode)"
echo "   - Blockchain data: $([ -d "$DATA_DIR/blocks" ] && echo "Kept existing" || echo "Deleted - will sync fresh")"
echo ""
echo "💡 Next Steps:"
echo ""
echo "1. Monitor sync progress:"
echo "   watch -n 5 'bitcoin-cli -chain=testnet4 -datadir=$DATA_DIR getblockchaininfo | grep -E \"(blocks|verificationprogress)\"'"
echo ""
echo "2. Or use the monitoring script:"
echo "   ./monitor-bitcoin-core.sh"
echo ""
echo "3. Check sync status:"
echo "   bitcoin-cli -chain=testnet4 -datadir=$DATA_DIR getblockchaininfo"
echo ""
echo "4. View logs:"
echo "   tail -f $DATA_DIR/debug.log"
echo ""
echo "⚠️  Note: Full sync will take time and require disk space (~50GB+ for testnet4)"
echo "   The node will now keep ALL blocks (no pruning)"
echo ""
