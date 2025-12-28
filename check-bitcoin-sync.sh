#!/bin/bash
# Quick script to check Bitcoin Core sync status

echo "📊 Bitcoin Core Sync Status"
echo "=========================="
echo ""

# Try to get blockchain info
INFO=$(~/.local/bin/bitcoin-cli -testnet -datadir=$HOME/.bitcoin/testnet4 getblockchaininfo 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "❌ Cannot connect to Bitcoin Core node"
    echo "   Is the node running? Check with: ps aux | grep bitcoind"
    exit 1
fi

# Use Python to parse JSON properly
python3 << PYTHON_SCRIPT
import json
import sys

try:
    data = json.loads('''$INFO''')
    
    blocks = data.get('blocks', 0)
    headers = data.get('headers', 0)
    progress = data.get('verificationprogress', 0)
    ibd = data.get('initialblockdownload', True)
    chain = data.get('chain', 'unknown')
    
    print(f"🌐 Network: {chain}")
    print(f"📦 Blocks synced: {blocks:,} / {headers:,}")
    
    if headers > 0:
        block_percent = (blocks / headers) * 100
        print(f"📈 Block progress: {block_percent:.1f}%")
    
    print(f"🔍 Verification: {progress * 100:.2f}%")
    print("")
    
    if ibd:
        print("⏳ Status: SYNCING (Initial Block Download in progress)")
        print("")
        if blocks == 0 and headers == 0:
            print("💡 Node just started - connecting to network...")
            print("   Headers will appear first, then blocks will start downloading.")
        elif headers > blocks:
            remaining = headers - blocks
            print(f"💡 Node is downloading {remaining:,} blocks...")
            print("   You can still use it for recent transactions!")
        print("")
        print("⏱️  Estimated time: 2-6 hours for testnet4")
        print("   (Depends on your internet connection speed)")
    else:
        print("✅ Status: FULLY SYNCED!")
        print("")
        print("🎉 Your Bitcoin Core node is ready!")
        print("   Package broadcasting will work at full capacity.")
    
    print("")
    print("📝 To check again: ./check-bitcoin-sync.sh")
    
except Exception as e:
    print(f"Error parsing response: {e}")
    print("Raw response:")
    print('''$INFO''')
PYTHON_SCRIPT
