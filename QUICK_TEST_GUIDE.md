# 🚀 Quick Testing Guide - Charm Cards

## ✅ Pre-Flight Checklist

### 1. Verify Servers Are Running

**Backend API (Terminal 1):**
```bash
cd api
npm run dev
# Should see: "🚀 Charms Gift Cards API server running on port 3001"
# Test: curl http://localhost:3001/health
```

**Frontend (Terminal 2):**
```bash
npm run dev
# Should see: "Ready on http://localhost:3000"
# Open: http://localhost:3000
```

### 2. Verify Environment Files

✅ `api/.env` - Backend config
✅ `.env.local` - Frontend config

### 3. Verify WASM Binary

✅ `gift-cards/target/wasm32-wasip1/release/gift-cards.wasm` exists

---

## 🧪 Step-by-Step Testing

### Step 1: Open the App
1. Open browser: **http://localhost:3000**
2. Check console (F12) - should see no red errors
3. Verify homepage loads with:
   - Hero banner ✅
   - BRO promotional banner ✅
   - Gift cards grid ✅

### Step 2: Connect Wallet
1. Click **"Connect"** button in navbar
2. Select Bitcoin wallet:
   - **Unisat** (recommended)
   - **Xverse**
   - **Leather**
3. Approve connection in wallet extension
4. Verify:
   - Address appears in navbar ✅
   - Wallet icon shows connected ✅

### Step 3: Network Check
1. App automatically detects network
2. If on wrong network, modal appears:
   - Shows current network
   - Instructions to switch to Testnet4
   - Link to faucet
3. Switch wallet to **Bitcoin Testnet4**
4. Reconnect if needed

### Step 4: Get Testnet BTC
1. Click **"Get Testnet4 BTC"** (in network modal or navbar)
2. Copy your Bitcoin address
3. Use faucet: **https://bitcoinfaucet.uo1.net/**
4. Paste address and request Testnet4 BTC
5. Wait 1-2 minutes for confirmation
6. Verify UTXOs available (check wallet or explorer)

### Step 5: Mint a Gift Card
1. Navigate to any gift card (e.g., Amazon, Uber)
2. Select amount:
   - Choose preset denomination OR
   - Enter custom amount
3. Click **"Mint with Charms"** button
4. Watch for:
   - ✅ Toast: "Spell created! Proof generated"
   - ✅ Console shows spell YAML
   - ✅ Console shows proof with `commit_tx` and `spell_tx`
   - ⚠️ May need manual signing (see below)

### Step 6: Transaction Signing (if automatic fails)
**Current Status**: Bitcoin wallets typically require PSBT format, but Prover API returns raw hex.

**Options:**
1. **Check Console** - Transaction hex strings are logged
2. **Manual Signing** - Use Charms CLI or wallet's PSBT signing
3. **Broadcasting** - Once signed, use `broadcastSpellTransactions()` function

**Console Output Should Show:**
```javascript
Commit TX (hex): 0200000001...
Spell TX (hex): 0200000001...
UTXO: { txid: "...", vout: 0, amount: 10000, address: "..." }
```

### Step 7: Verify Transaction
1. Check console for transaction IDs
2. View on explorer: `https://mempool.space/testnet4/tx/<txid>`
3. Verify gift card NFT was created
4. Check wallet for new Charms assets

---

## ✅ What Should Work

### Frontend
- ✅ Homepage loads
- ✅ BRO promotional banner displays
- ✅ Wallet connects (Unisat/Xverse/Leather)
- ✅ Network detection works
- ✅ Gift card pages load
- ✅ Amount selection works
- ✅ "Mint with Charms" button works

### Backend
- ✅ API server responds (`/health` endpoint)
- ✅ Spell creation works (`/api/gift-cards/mint`)
- ✅ Proof generation works (via Prover API)
- ✅ Transaction preparation works

### Charms Integration
- ✅ Spell YAML created
- ✅ Proof generated with commit_tx and spell_tx
- ✅ Transactions ready for signing

---

## ⚠️ Known Limitations

### Transaction Signing
- **Issue**: Prover API returns raw hex, wallets expect PSBT
- **Status**: Automatic signing may not work with all wallets
- **Workaround**: Manual signing via Charms CLI or PSBT conversion

### Wallet APIs
- Different wallets have different signing methods
- Code attempts automatic detection (Unisat, Xverse, Leather)
- May require wallet-specific implementation

---

## 🐛 Troubleshooting

### Wallet Won't Connect
- Ensure wallet extension is installed
- Check browser console for errors
- Try disconnecting and reconnecting
- Verify wallet is on Testnet4

### No UTXOs Available
- Get Testnet4 BTC from faucet
- Wait a few minutes for confirmation
- Refresh the page
- Check wallet balance

### Spell Creation Fails
- Check API server logs
- Verify `api/.env` is correct
- Check Charms app is built
- Verify UTXO format is correct (txid:vout)

### API Server Not Responding
- Check Terminal 1 (API server)
- Verify port 3001 is available
- Check `api/.env` file exists
- Restart: `cd api && npm run dev`

### Frontend Not Loading
- Check Terminal 2 (Frontend)
- Verify port 3000 is available
- Check `.env.local` file exists
- Clear cache: `rm -rf .next && npm run dev`

---

## 📊 Testing Checklist

### Basic Functionality
- [ ] App loads without errors
- [ ] BRO banner displays
- [ ] Wallet connects successfully
- [ ] Network detection works
- [ ] Gift card pages load
- [ ] Amount selection works

### Minting Flow
- [ ] "Mint with Charms" button works
- [ ] Spell is created
- [ ] Proof is generated
- [ ] Transactions are prepared (commit_tx + spell_tx)
- [ ] Console shows transaction hex

### Error Handling
- [ ] Network errors handled gracefully
- [ ] Missing UTXO shows helpful message
- [ ] Invalid inputs show errors
- [ ] API errors show in console

---

## 🎯 Expected Results

### Successful Mint Flow

**Console Output:**
```javascript
Spell: version: 8
apps:
  $00: n/<app_id>/<app_vk>
  $01: t/<app_id>/<app_vk>
...

Proof: {
  commit_tx: "0200000001...",
  spell_tx: "0200000001...",
  proof: "..."
}
```

**Transactions Ready:**
- Commit transaction hex ✅
- Spell transaction hex ✅
- Ready for signing and broadcasting ✅

---

## 🚀 Ready to Test!

Everything is set up and ready. Follow the steps above to test the complete flow!

**Remember:**
- Use Testnet4 network
- Get Testnet BTC from faucet
- Check browser console for details
- Transactions will be ready for signing/broadcasting

**Need Help?**
- Check `README.md` for setup instructions
- Check `APP_OVERVIEW.md` for technical details
- Check `READINESS_CHECKLIST.md` for comprehensive status

