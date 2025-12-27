#!/bin/bash
# Charms App Setup Script
# Run this before starting the API server to ensure everything is configured correctly

set -e  # Exit on error

echo "🔧 Charms App Setup Script"
echo "=========================="
echo ""

# Step 1: Check if we're in the right directory
if [ ! -d "gift-cards" ]; then
    echo "❌ Error: gift-cards directory not found. Please run this from the project root."
    exit 1
fi

cd gift-cards

# Step 2: Ensure wasm32-wasip1 target is installed
echo "Step 1: Checking Rust WASM target..."
if ! rustup target list | grep -q "wasm32-wasip1 (installed)"; then
    echo "   Installing wasm32-wasip1 target..."
    rustup target add wasm32-wasip1
else
    echo "   ✅ wasm32-wasip1 target is installed"
fi
echo ""

# Step 3: Build the app
echo "Step 2: Building Charms app..."
unset CARGO_TARGET_DIR
app_bin=$(charms app build)
echo "   ✅ App built: $app_bin"
echo ""

# Step 4: Get app verification key
echo "Step 3: Getting app verification key..."
app_vk=$(charms app vk "$app_bin")
echo "   ✅ App VK: $app_vk"
echo "   ✅ Length: ${#app_vk} characters"
echo ""

# Step 5: Update .env file with correct VK
echo "Step 4: Updating api/.env with correct app VK..."
cd ../api
if [ -f ".env" ]; then
    # Check if VK needs updating
    current_vk=$(grep "^CHARMS_APP_VK=" .env | cut -d'=' -f2)
    if [ "$current_vk" != "$app_vk" ]; then
        echo "   ⚠️  App VK mismatch detected!"
        echo "   Current: $current_vk"
        echo "   New:     $app_vk"
        echo "   Updating .env file..."
        sed -i "s/^CHARMS_APP_VK=.*/CHARMS_APP_VK=$app_vk/" .env
        echo "   ✅ .env file updated"
    else
        echo "   ✅ App VK is already correct in .env"
    fi
else
    echo "   ⚠️  .env file not found, creating it..."
    echo "CHARMS_APP_VK=$app_vk" >> .env
    echo "   ✅ Created .env file"
fi
echo ""

# Step 6: Verify spell templates exist
echo "Step 5: Verifying spell templates..."
cd ../gift-cards
spell_count=$(ls -1 spells/*.yaml 2>/dev/null | wc -l)
if [ "$spell_count" -gt 0 ]; then
    echo "   ✅ Found $spell_count spell template(s)"
else
    echo "   ⚠️  No spell templates found in spells/ directory"
fi
echo ""

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Start the API server: cd api && npm run dev"
echo "2. The app VK is now correctly set in api/.env"
echo "3. Try minting a gift card - the 'app.vk mismatch' error should be resolved"
echo ""

