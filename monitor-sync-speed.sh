#!/bin/bash
# Monitor Bitcoin Core sync speed and calculate ETA

BITCOIN_CLI=~/.local/bin/bitcoin-cli
DATA_DIR=$HOME/.bitcoin/testnet4

if [ ! -f "$BITCOIN_CLI" ]; then
    BITCOIN_CLI=bitcoin-cli
fi

echo "📊 Bitcoin Core Sync Speed Monitor"
echo "=================================="
echo ""

# Get initial state
INITIAL_INFO=$($BITCOIN_CLI -chain=testnet4 -datadir="$DATA_DIR" getblockchaininfo 2>/dev/null)
if [ $? -ne 0 ]; then
    echo "❌ Cannot connect to Bitcoin Core RPC"
    exit 1
fi

INITIAL_BLOCKS=$(echo "$INITIAL_INFO" | python3 -c "import sys, json; print(json.load(sys.stdin).get('blocks', 0))" 2>/dev/null)
INITIAL_HEADERS=$(echo "$INITIAL_INFO" | python3 -c "import sys, json; print(json.load(sys.stdin).get('headers', 0))" 2>/dev/null)
INITIAL_PROGRESS=$(echo "$INITIAL_INFO" | python3 -c "import sys, json; print(json.load(sys.stdin).get('verificationprogress', 0))" 2>/dev/null)
INITIAL_TIME=$(date +%s)

echo "Initial state:"
echo "  Blocks: $INITIAL_BLOCKS / $INITIAL_HEADERS"
echo "  Progress: $(echo "$INITIAL_PROGRESS * 100" | bc -l | cut -d. -f1).$(echo "$INITIAL_PROGRESS * 100" | bc -l | cut -d. -f2 | cut -c1-2)%"
echo ""
echo "Monitoring for 60 seconds..."
echo ""

sleep 60

# Get final state
FINAL_INFO=$($BITCOIN_CLI -chain=testnet4 -datadir="$DATA_DIR" getblockchaininfo 2>/dev/null)
FINAL_BLOCKS=$(echo "$FINAL_INFO" | python3 -c "import sys, json; print(json.load(sys.stdin).get('blocks', 0))" 2>/dev/null)
FINAL_HEADERS=$(echo "$FINAL_INFO" | python3 -c "import sys, json; print(json.load(sys.stdin).get('headers', 0))" 2>/dev/null)
FINAL_PROGRESS=$(echo "$FINAL_INFO" | python3 -c "import sys, json; print(json.load(sys.stdin).get('verificationprogress', 0))" 2>/dev/null)
FINAL_TIME=$(date +%s)

BLOCKS_SYNCED=$((FINAL_BLOCKS - INITIAL_BLOCKS))
TIME_ELAPSED=$((FINAL_TIME - INITIAL_TIME))
BLOCKS_PER_SEC=$(echo "scale=2; $BLOCKS_SYNCED / $TIME_ELAPSED" | bc -l)
REMAINING_BLOCKS=$((FINAL_HEADERS - FINAL_BLOCKS))

if [ "$BLOCKS_PER_SEC" != "0" ] && [ -n "$BLOCKS_PER_SEC" ]; then
    SECONDS_REMAINING=$(echo "scale=0; $REMAINING_BLOCKS / $BLOCKS_PER_SEC" | bc -l)
    HOURS_REMAINING=$(echo "scale=2; $SECONDS_REMAINING / 3600" | bc -l)
    
    echo "Results:"
    echo "  Blocks synced in 60s: $BLOCKS_SYNCED"
    echo "  Speed: $BLOCKS_PER_SEC blocks/second"
    echo "  Remaining blocks: $REMAINING_BLOCKS"
    echo "  Estimated time to complete: ${HOURS_REMAINING} hours"
    echo ""
    
    if (( $(echo "$HOURS_REMAINING < 3" | bc -l) )); then
        echo "✅ On track to complete within 3 hours!"
    else
        echo "⚠️  May take longer than 3 hours at current speed"
    fi
else
    echo "⚠️  Could not calculate sync speed"
fi
