# Bitcoin Core Monitoring Guide

## Quick Start

### Interactive Launcher (Recommended)
```bash
./start-bitcoin-monitor.sh
```

This will present a menu to choose from different monitoring modes.

### Using npm scripts
```bash
# Interactive launcher
npm run monitor:bitcoin

# Direct monitoring scripts
npm run monitor:bitcoin:health    # Real-time health monitor
npm run monitor:bitcoin:sync      # Sync monitor with ETA
npm run monitor:bitcoin:api       # API health monitor

# Quick status checks
npm run bitcoin:status            # Full diagnostic check
npm run bitcoin:sync              # Quick sync status
```

## Monitoring Scripts

### 1. Real-time Health Monitor (`monitor-bitcoin-core.sh`)
- **Update interval**: 5 seconds
- **Shows**: Sync progress, network connections, mempool info
- **Best for**: General monitoring and health checks

```bash
./monitor-bitcoin-core.sh
# Or with custom interval:
./monitor-bitcoin-core.sh 10  # Update every 10 seconds
```

### 2. Sync Monitor with Time Estimates (`monitor-bitcoin-sync.sh`)
- **Update interval**: 10 seconds
- **Shows**: Sync progress, ETA, sync speed (blocks/sec)
- **Best for**: Tracking sync progress and estimating completion time

```bash
./monitor-bitcoin-sync.sh
# Or with custom interval:
./monitor-bitcoin-sync.sh 5  # Update every 5 seconds
```

### 3. API Health Monitor (`monitor-bitcoin-health.sh`)
- **Update interval**: 10 seconds
- **Shows**: API health endpoint status
- **Best for**: Monitoring Bitcoin Core through your API server
- **Requires**: API server running on port 3001

```bash
./monitor-bitcoin-health.sh
```

### 4. Quick Status Checks

#### Full Diagnostic (`check-bitcoin-rpc.sh`)
Comprehensive check of:
- Process status
- RPC configuration
- Connection status
- Blockchain info

```bash
./check-bitcoin-rpc.sh
```

#### Sync Status (`check-bitcoin-sync.sh`)
Quick one-time sync status check:

```bash
./check-bitcoin-sync.sh
```

## Running in Background

To run monitoring in the background and save output to a log file:

```bash
# Health monitor
./monitor-bitcoin-core.sh > bitcoin-monitor.log 2>&1 &

# Sync monitor
./monitor-bitcoin-sync.sh > bitcoin-sync.log 2>&1 &
```

To stop background monitoring:
```bash
pkill -f monitor-bitcoin
```

## Status Indicators

- ✅ **Green**: Everything is working correctly
- ⏳ **Yellow**: Node is syncing or initializing (normal)
- ❌ **Red**: Error or issue that needs attention

## Troubleshooting

If monitoring scripts can't connect:

1. **Check if Bitcoin Core is running:**
   ```bash
   pgrep -x bitcoind
   ```

2. **Start Bitcoin Core if needed:**
   ```bash
   bitcoind -testnet -datadir=$HOME/.bitcoin/testnet4 -daemon
   ```

3. **Check RPC configuration:**
   ```bash
   cat ~/.bitcoin/testnet4/bitcoin.conf | grep rpc
   ```

4. **View Bitcoin Core logs:**
   ```bash
   tail -f ~/.bitcoin/testnet4/debug.log
   ```

## Notes

- The node may show "Verifying blocks" for a few minutes after startup - this is normal
- RPC may not be immediately available - wait 1-5 minutes after starting
- Node is usable for recent transactions even while syncing
- Full sync can take 2-6 hours on testnet4 depending on connection speed
