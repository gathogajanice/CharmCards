#!/bin/bash
# Quick Service Status Check
# Checks status of all services without starting them

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Simply call start-services.sh with --status flag
exec "$SCRIPT_DIR/start-services.sh" --status
