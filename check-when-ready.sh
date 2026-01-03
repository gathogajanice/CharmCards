#!/bin/bash
# Auto-check script - runs wait-for-bitcoin-ready.sh in background
# This will automatically check when Bitcoin Core is ready

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting automatic Bitcoin Core readiness monitor..."
echo ""
echo "This will run in the background and notify you when ready."
echo "Check the output or run ./quick-status.sh to see current status"
echo ""

# Run the wait script
exec ./wait-for-bitcoin-ready.sh
