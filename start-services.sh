#!/bin/bash
# Service Management Script
# Checks and starts Backend API and Frontend services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
BACKEND_PORT=3001
FRONTEND_PORT=3000
STATUS_ONLY=false
START_ALL=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --status)
            STATUS_ONLY=true
            shift
            ;;
        --start)
            START_ALL=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--status|--start]"
            echo ""
            echo "Options:"
            echo "  --status    Check status only, don't start services"
            echo "  --start     Start all services (interactive if not specified)"
            echo "  -h, --help  Show this help message"
            exit 0
            ;;
    esac
done

# Function to check if a port is in use
check_port() {
    local port=$1
    if command -v lsof &> /dev/null; then
        lsof -i :$port > /dev/null 2>&1
    elif command -v netstat &> /dev/null; then
        netstat -tlnp 2>/dev/null | grep -q ":$port.*LISTEN"
    elif command -v ss &> /dev/null; then
        ss -tlnp 2>/dev/null | grep -q ":$port.*LISTEN"
    else
        # Fallback: try to connect
        timeout 1 bash -c "echo > /dev/tcp/localhost/$port" 2>/dev/null
    fi
}

# Function to check Backend API status
check_backend() {
    local status="stopped"
    local details=""
    
    if check_port $BACKEND_PORT; then
        # Try to connect to health endpoint
        local health=$(curl -s -w "\n%{http_code}" http://localhost:$BACKEND_PORT/health 2>/dev/null || echo "")
        local http_code=$(echo "$health" | tail -n 1)
        if [ "$http_code" = "200" ]; then
            status="running"
        else
            status="starting"
            details=" (port in use but not responding)"
        fi
    fi
    
    echo "$status|$details"
}

# Function to check Frontend status
check_frontend() {
    local status="stopped"
    local details=""
    
    if check_port $FRONTEND_PORT; then
        # Try to connect to frontend
        local response=$(curl -s -w "\n%{http_code}" http://localhost:$FRONTEND_PORT 2>/dev/null || echo "")
        local http_code=$(echo "$response" | tail -n 1)
        if [ "$http_code" = "200" ] || [ "$http_code" = "304" ]; then
            status="running"
        else
            status="starting"
            details=" (port in use but not responding)"
        fi
    fi
    
    echo "$status|$details"
}

# Function to start Backend API
start_backend() {
    echo -e "${BLUE}Starting Backend API...${NC}"
    
    if check_port $BACKEND_PORT; then
        echo -e "${YELLOW}⚠️  Port $BACKEND_PORT is already in use${NC}"
        return 0
    fi
    
    if [ ! -d "api" ]; then
        echo -e "${RED}❌ API directory not found${NC}"
        return 1
    fi
    
    if [ ! -f "api/package.json" ]; then
        echo -e "${RED}❌ API package.json not found${NC}"
        return 1
    fi
    
    # Start in background
    cd api
    npm run dev > /tmp/charm-cards-api.log 2>&1 &
    local pid=$!
    cd ..
    
    echo -e "${GREEN}✅ Backend API starting (PID: $pid)${NC}"
    echo "   Logs: /tmp/charm-cards-api.log"
    
    # Wait up to 10 seconds for server to start
    local max_wait=10
    local waited=0
    while [ $waited -lt $max_wait ]; do
        if curl -s http://localhost:$BACKEND_PORT/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Backend API is ready!${NC}"
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done
    
    echo -e "${YELLOW}⚠️  Backend API started but not responding yet${NC}"
    return 0
}

# Function to start Frontend
start_frontend() {
    echo -e "${BLUE}Starting Frontend...${NC}"
    
    if check_port $FRONTEND_PORT; then
        echo -e "${YELLOW}⚠️  Port $FRONTEND_PORT is already in use${NC}"
        return 0
    fi
    
    if [ ! -f "package.json" ]; then
        echo -e "${RED}❌ package.json not found${NC}"
        return 1
    fi
    
    # Start in background
    npm run dev > /tmp/charm-cards-frontend.log 2>&1 &
    local pid=$!
    
    echo -e "${GREEN}✅ Frontend starting (PID: $pid)${NC}"
    echo "   Logs: /tmp/charm-cards-frontend.log"
    
    # Wait up to 15 seconds for server to start (Next.js takes longer)
    local max_wait=15
    local waited=0
    while [ $waited -lt $max_wait ]; do
        if curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Frontend is ready!${NC}"
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done
    
    echo -e "${YELLOW}⚠️  Frontend started but not responding yet (Next.js may take 30-60 seconds)${NC}"
    return 0
}

# Main execution
echo -e "${CYAN}🔍 Charm Cards Service Manager${NC}"
echo "======================================"
echo ""

# Check status of all services
BACKEND_STATUS=$(check_backend)
FRONTEND_STATUS=$(check_frontend)

BACKEND_STATE=$(echo "$BACKEND_STATUS" | cut -d'|' -f1)
BACKEND_DETAILS=$(echo "$BACKEND_STATUS" | cut -d'|' -f2)
FRONTEND_STATE=$(echo "$FRONTEND_STATUS" | cut -d'|' -f1)
FRONTEND_DETAILS=$(echo "$FRONTEND_STATUS" | cut -d'|' -f2)

# Display status
echo -e "${BLUE}Service Status:${NC}"
echo ""

# Backend API
if [ "$BACKEND_STATE" = "running" ]; then
    echo -e "  ${GREEN}✅ Backend API: RUNNING${NC}${BACKEND_DETAILS} (http://localhost:$BACKEND_PORT)"
elif [ "$BACKEND_STATE" = "starting" ]; then
    echo -e "  ${YELLOW}⏳ Backend API: STARTING${NC}${BACKEND_DETAILS}"
else
    echo -e "  ${RED}❌ Backend API: STOPPED${NC} (http://localhost:$BACKEND_PORT)"
fi

# Frontend
if [ "$FRONTEND_STATE" = "running" ]; then
    echo -e "  ${GREEN}✅ Frontend: RUNNING${NC}${FRONTEND_DETAILS} (http://localhost:$FRONTEND_PORT)"
elif [ "$FRONTEND_STATE" = "starting" ]; then
    echo -e "  ${YELLOW}⏳ Frontend: STARTING${NC}${FRONTEND_DETAILS}"
else
    echo -e "  ${RED}❌ Frontend: STOPPED${NC} (http://localhost:$FRONTEND_PORT)"
fi

echo ""

# If status only, exit here
if [ "$STATUS_ONLY" = true ]; then
    exit 0
fi

# Determine what needs to be started
NEEDS_BACKEND=false
NEEDS_FRONTEND=false

if [ "$BACKEND_STATE" != "running" ]; then
    NEEDS_BACKEND=true
fi

if [ "$FRONTEND_STATE" != "running" ]; then
    NEEDS_FRONTEND=true
fi

# If all services are running, exit
if [ "$NEEDS_BACKEND" = false ] && [ "$NEEDS_FRONTEND" = false ]; then
    echo -e "${GREEN}✅ All services are running!${NC}"
    echo ""
    echo "🌐 Access your application:"
    echo "   Frontend: http://localhost:$FRONTEND_PORT"
    echo "   Backend API: http://localhost:$BACKEND_PORT"
    exit 0
fi

# Ask user if not --start flag
if [ "$START_ALL" = false ]; then
    echo -e "${YELLOW}Some services are not running.${NC}"
    echo ""
    if [ "$NEEDS_BACKEND" = true ]; then
        echo "  • Backend API needs to be started"
    fi
    if [ "$NEEDS_FRONTEND" = true ]; then
        echo "  • Frontend needs to be started"
    fi
    echo ""
    read -p "Start missing services? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Exiting. Use --start to auto-start all services."
        exit 0
    fi
fi

# Start services
echo ""
echo -e "${CYAN}Starting services...${NC}"
echo ""

if [ "$NEEDS_BACKEND" = true ]; then
    start_backend
    echo ""
fi

if [ "$NEEDS_FRONTEND" = true ]; then
    start_frontend
    echo ""
fi

# Final status check
echo -e "${CYAN}Final Status:${NC}"
sleep 2

BACKEND_STATUS=$(check_backend)
FRONTEND_STATUS=$(check_frontend)

BACKEND_STATE=$(echo "$BACKEND_STATUS" | cut -d'|' -f1)
FRONTEND_STATE=$(echo "$FRONTEND_STATUS" | cut -d'|' -f1)

echo ""
if [ "$BACKEND_STATE" = "running" ]; then
    echo -e "  ${GREEN}✅ Backend API: RUNNING${NC}"
else
    echo -e "  ${YELLOW}⏳ Backend API: Starting...${NC}"
fi

if [ "$FRONTEND_STATE" = "running" ]; then
    echo -e "  ${GREEN}✅ Frontend: RUNNING${NC}"
else
    echo -e "  ${YELLOW}⏳ Frontend: Starting...${NC}"
fi

echo ""
echo -e "${GREEN}✅ Service startup initiated!${NC}"
echo ""
echo "📝 Notes:"
echo "   • Services are running in the background"
echo "   • Check logs: /tmp/charm-cards-*.log"
echo "   • Frontend may take 30-60 seconds to fully start"
echo ""
echo "🌐 Access your application:"
echo "   Frontend: http://localhost:$FRONTEND_PORT"
echo "   Backend API: http://localhost:$BACKEND_PORT"
echo ""
echo "💡 To check status again: ./start-services.sh --status"
