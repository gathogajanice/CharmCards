#!/bin/bash
# Monitor Bitcoin Core RPC health endpoint

API_URL="http://localhost:3001/api/broadcast/health"
INTERVAL=${1:-10}  # Default 10 seconds, can be overridden: ./monitor-bitcoin-health.sh 5

echo "🔍 Monitoring Bitcoin Core Health Endpoint"
echo "=========================================="
echo "API: $API_URL"
echo "Interval: ${INTERVAL} seconds"
echo "Press Ctrl+C to stop"
echo ""

while true; do
    clear
    echo "🔍 Bitcoin Core Health Status - $(date '+%Y-%m-%d %H:%M:%S')"
    echo "=========================================="
    echo ""
    
    RESPONSE=$(curl -s "$API_URL" 2>/dev/null)
    
    if [ $? -ne 0 ]; then
        echo "❌ Cannot connect to API server"
        echo "   Is the API running on port 3001?"
        echo ""
        sleep $INTERVAL
        continue
    fi
    
    # Parse and display key information
    python3 << PYTHON_SCRIPT
import json
import sys

try:
    data = json.loads('''$RESPONSE''')
    
    status = data.get('status', 'unknown')
    message = data.get('message', '')
    connected = data.get('connected', False)
    ready = data.get('ready', False)
    
    print(f"Status: {status.upper()}")
    print(f"Message: {message}")
    print(f"Connected: {'✅ Yes' if connected else '❌ No'}")
    print(f"Ready: {'✅ Yes' if ready else '⏳ No (syncing)'}")
    print("")
    
    if data.get('blockchain'):
        bc = data['blockchain']
        blocks = bc.get('blocks', 0)
        headers = bc.get('headers', 0)
        progress = bc.get('verificationProgress', 0) * 100
        ibd = bc.get('initialBlockDownload', False)
        
        print(f"📦 Blockchain:")
        print(f"   Blocks: {blocks:,} / {headers:,}")
        if headers > 0:
            sync_pct = (blocks / headers) * 100
            print(f"   Sync: {sync_pct:.2f}%")
        print(f"   Verification: {progress:.4f}%")
        print(f"   Syncing: {'⏳ Yes' if ibd else '✅ No'}")
        print("")
    
    if data.get('network'):
        net = data['network']
        conns = net.get('connections', 0)
        active = net.get('networkActive', False)
        print(f"🌐 Network:")
        print(f"   Connections: {conns}")
        print(f"   Active: {'✅ Yes' if active else '❌ No'}")
        print("")
    
    if data.get('mempool'):
        mp = data['mempool']
        size = mp.get('size', 0)
        bytes_val = mp.get('bytes', 0)
        print(f"💾 Mempool:")
        print(f"   Transactions: {size}")
        print(f"   Size: {bytes_val:,} bytes")
        print("")
    
    if data.get('diagnostics'):
        diag = data['diagnostics']
        if diag.get('note'):
            print(f"💡 Note: {diag['note']}")
        if diag.get('troubleshooting'):
            print("")
            print("🔧 Troubleshooting:")
            for step in diag['troubleshooting']:
                print(f"   • {step}")
    
except Exception as e:
    print(f"Error parsing response: {e}")
    print("Raw response:")
    print('''$RESPONSE''')
PYTHON_SCRIPT
    
    echo ""
    echo "Next update in ${INTERVAL} seconds... (Ctrl+C to stop)"
    sleep $INTERVAL
done
