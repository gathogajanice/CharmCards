#!/bin/bash
# Comprehensive Charms CLI and App Setup Verification

echo "🔍 Charms Setup Verification"
echo "============================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ALL_GOOD=true

# 1. Check Charms CLI
echo "1. Charms CLI Installation:"
if command -v charms &> /dev/null; then
    VERSION=$(charms --version 2>/dev/null || echo "unknown")
    echo -e "   ${GREEN}✅ Charms CLI installed: $VERSION${NC}"
    echo "   Location: $(which charms)"
else
    echo -e "   ${RED}❌ Charms CLI not found${NC}"
    echo "   Install with: cargo install --locked charms"
    ALL_GOOD=false
fi
echo ""

# 2. Check Rust WASM target
echo "2. Rust WASM Target:"
if rustup target list 2>/dev/null | grep -q "wasm32-wasip1 (installed)"; then
    echo -e "   ${GREEN}✅ wasm32-wasip1 target installed${NC}"
else
    echo -e "   ${RED}❌ wasm32-wasip1 target not installed${NC}"
    echo "   Install with: rustup target add wasm32-wasip1"
    ALL_GOOD=false
fi
echo ""

# 3. Check WASM binary
echo "3. Charms App WASM Binary:"
WASM_PATH="gift-cards/target/wasm32-wasip1/release/gift-cards.wasm"
if [ -f "$WASM_PATH" ]; then
    SIZE=$(ls -lh "$WASM_PATH" | awk '{print $5}')
    echo -e "   ${GREEN}✅ WASM binary found${NC}"
    echo "   Path: $WASM_PATH"
    echo "   Size: $SIZE"
else
    echo -e "   ${RED}❌ WASM binary not found${NC}"
    echo "   Build with: cd gift-cards && charms app build"
    ALL_GOOD=false
fi
echo ""

# 4. Check Verification Key
echo "4. Verification Key (VK):"
if [ -f "$WASM_PATH" ]; then
    # Get VK from built app
    APP_VK=$(cd gift-cards && timeout 10 charms app vk 2>/dev/null | tail -1 | tr -d '\n')
    if [ -n "$APP_VK" ] && [ ${#APP_VK} -eq 64 ]; then
        echo "   App VK: $APP_VK"
        
        # Check .env file
        if [ -f "api/.env" ]; then
            ENV_VK=$(grep "^CHARMS_APP_VK=" api/.env | cut -d'=' -f2 | tr -d '\n')
            if [ "$ENV_VK" = "$APP_VK" ]; then
                echo -e "   ${GREEN}✅ VK matches in api/.env${NC}"
            else
                echo -e "   ${RED}❌ VK mismatch!${NC}"
                echo "   App VK:    $APP_VK"
                echo "   .env VK:   $ENV_VK"
                echo "   Fix with: ./setup-charms-app.sh"
                ALL_GOOD=false
            fi
        else
            echo -e "   ${YELLOW}⚠️  api/.env file not found${NC}"
            ALL_GOOD=false
        fi
    else
        echo -e "   ${YELLOW}⚠️  Could not get VK from app${NC}"
    fi
else
    echo -e "   ${YELLOW}⚠️  Cannot verify VK - WASM binary not found${NC}"
fi
echo ""

# 5. Check Spell Templates
echo "5. Spell Templates:"
SPELL_COUNT=$(ls -1 gift-cards/spells/*.yaml 2>/dev/null | wc -l)
if [ "$SPELL_COUNT" -gt 0 ]; then
    echo -e "   ${GREEN}✅ Found $SPELL_COUNT spell template(s)${NC}"
    ls -1 gift-cards/spells/*.yaml 2>/dev/null | sed 's/^/      - /'
else
    echo -e "   ${YELLOW}⚠️  No spell templates found${NC}"
fi
echo ""

# 6. Check API Configuration
echo "6. API Configuration:"
if [ -f "api/.env" ]; then
    echo -e "   ${GREEN}✅ api/.env file exists${NC}"
    
    # Check required variables
    if grep -q "^CHARMS_APP_PATH=" api/.env; then
        APP_PATH=$(grep "^CHARMS_APP_PATH=" api/.env | cut -d'=' -f2)
        echo "   CHARMS_APP_PATH: $APP_PATH"
        if [ -d "$APP_PATH" ] || [ -d "api/$APP_PATH" ]; then
            echo -e "      ${GREEN}✅ Path exists${NC}"
        else
            echo -e "      ${RED}❌ Path does not exist${NC}"
            ALL_GOOD=false
        fi
    else
        echo -e "   ${RED}❌ CHARMS_APP_PATH not set${NC}"
        ALL_GOOD=false
    fi
    
    if grep -q "^PROVER_API_URL=" api/.env; then
        PROVER_URL=$(grep "^PROVER_API_URL=" api/.env | cut -d'=' -f2)
        echo "   PROVER_API_URL: $PROVER_URL"
    else
        echo -e "   ${YELLOW}⚠️  PROVER_API_URL not set${NC}"
    fi
else
    echo -e "   ${RED}❌ api/.env file not found${NC}"
    ALL_GOOD=false
fi
echo ""

# Summary
echo "============================"
if [ "$ALL_GOOD" = true ]; then
    echo -e "${GREEN}✅ All checks passed! Charms setup is complete.${NC}"
    echo ""
    echo "You're ready to test the application!"
    echo ""
    echo "Next steps:"
    echo "1. Start API server: cd api && npm run dev"
    echo "2. Start Frontend: npm run dev (from root)"
    echo "3. Open: http://localhost:3000"
else
    echo -e "${YELLOW}⚠️  Some issues found. Please fix them before testing.${NC}"
    echo ""
    echo "Run ./setup-charms-app.sh to fix most issues automatically."
fi
echo ""
