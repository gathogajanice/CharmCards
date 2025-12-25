# Charm Cards - Programmable Bitcoin Gift Cards

**Create, transfer, and redeem programmable gift cards directly on Bitcoin using the Charms Protocol.**

[![Charms Protocol](https://img.shields.io/badge/Charms-Protocol-orange)](https://charms.dev)
[![Bitcoin Testnet4](https://img.shields.io/badge/Network-Testnet4-blue)](https://memepool.space/testnet4)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## 🎯 Overview

Charm Cards enables merchants to create programmable Bitcoin gift cards as NFTs with fungible token balances. Built on the Charms Protocol, these gift cards run directly on Bitcoin with programmable logic for expiration dates, partial redemption, and transfers - all without layer-2 solutions.

### Key Features

- ✅ **Bitcoin-Native**: Gift cards are NFTs on Bitcoin, not layer-2
- ✅ **Programmable**: Custom logic for expiration, redemption, transfers
- ✅ **Secure**: Leverages Bitcoin's security model
- ✅ **User-Friendly**: Simple UI for complex blockchain operations
- ✅ **Network Detection**: Automatically detects and prompts for Testnet4
- ✅ **Faucet Integration**: Easy access to Testnet4 BTC

---

## 🏗️ App Structure

### Three Components

```
CharmCards/
├── gift-cards/     # Charms App (Rust) - Built once, not run
├── api/            # API Server (Node.js) - MUST RUN
└── src/            # Frontend (Next.js) - MUST RUN
```

**How they work:**
- **`gift-cards/`**: Rust library that defines programmable logic. Built once to create WASM binary. API server uses this binary.
- **`api/`**: Express server that bridges frontend and Charms. Must run continuously from `api/` directory.
- **`src/`**: Next.js frontend. Must run continuously from root directory.

**Visual Flow:**
```
Frontend (src/) → API Server (api/) → Charms CLI/Prover API
                              ↓
                    Uses gift-cards/ WASM binary
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Rust** and Cargo (for Charms CLI)
- **Bitcoin Testnet4 Wallet** (Unisat, Xverse, or Leather)

### Installation

```bash
# 1. Install frontend dependencies (root directory)
npm install

# 2. Install API dependencies
cd api
npm install
cd ..

# 3. Install Charms CLI (one-time setup)
export CARGO_TARGET_DIR=$(mktemp -d)/target
cargo install --locked charms

# 4. Build Charms app (one-time, creates WASM binary)
cd gift-cards
charms app build
cd ..
```

### Environment Setup

**Create `api/.env`:**
```env
PORT=3001
CHARMS_APP_PATH=../gift-cards
CHARMS_APP_VK=1d7adfd77c17fec0df6ce3262d26a83318234c7d4e8a60659d331b395f67d6f0
BITCOIN_NETWORK=testnet4
PROVER_API_URL=https://v8.charms.dev/spells/prove
```

**Create `.env.local` (root directory):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_BITCOIN_NETWORK=testnet4
NEXT_PUBLIC_CHARMS_EXPLORER_URL=https://memepool.space/testnet4
NEXT_PUBLIC_PROVER_API_URL=https://v8.charms.dev/spells/prove
```

### Running the Application

**⚠️ IMPORTANT: You need TWO terminals open!**

**Terminal 1 - API Server:**
```bash
cd api
npm run dev
# Server runs on http://localhost:3001
# Keep this terminal open!
```

**Terminal 2 - Frontend (NEW terminal, root directory):**
```bash
# Make sure you're in the root directory (not in api/)
npm run dev
# App runs on http://localhost:3000
# Keep this terminal open!
```

**Open Browser:** http://localhost:3000

---

## 📁 Project Structure

```
CharmCards/
├── gift-cards/              # Charms App (Rust) - Built once, not run
│   ├── src/lib.rs          # zk-app logic (programmable rules)
│   └── spells/             # Spell templates (YAML files)
│   └── target/             # Built WASM binary (created after build)
│
├── api/                     # API Server (Express) - MUST RUN
│   ├── src/
│   │   ├── services/       # Charms service (uses gift-cards/)
│   │   └── routes/         # API endpoints
│   ├── package.json        # API dependencies
│   └── .env                # API environment variables
│
├── src/                     # Frontend (Next.js) - MUST RUN
│   ├── components/         # React components
│   ├── hooks/              # React hooks (use-charms.ts)
│   ├── lib/charms/         # Charms utilities
│   └── app/               # Next.js pages
│
├── README.md               # This file (quick start)
└── APP_OVERVIEW.md         # Complete technical documentation
```

---

## 🎮 How to Use

### 1. Get Testnet4 BTC

1. Connect your Bitcoin wallet (Unisat, Xverse, or Leather)
2. Switch to Testnet4 network (app will prompt you automatically)
3. Click "Get Testnet4 BTC from Faucet" in the network modal
4. Copy your address and use it in a Testnet4 faucet

### 2. Mint a Gift Card

1. Navigate to any gift card (e.g., Amazon, Uber)
2. Select an amount
3. Click **"Mint with Charms"**
4. Check browser console (F12) for spell and proof
5. Sign and broadcast transactions (when wallet API available)

### 3. View Your Gift Cards

- Go to "My Wallet" page
- View all your gift cards
- See balances and expiration dates

---

## 🔧 Features

### Implemented

- ✅ **Gift Card Minting**: Create programmable gift cards as NFTs
- ✅ **Network Detection**: Automatic Testnet4 detection and switching
- ✅ **Faucet Integration**: Easy access to Testnet4 BTC
- ✅ **Wallet Connection**: Support for Unisat, Xverse, Leather
- ✅ **Spell Creation**: Generate Charms spells for operations
- ✅ **Proof Generation**: Generate zero-knowledge proofs via Prover API
- ✅ **Transaction Signing**: Infrastructure for signing transactions
- ✅ **Transaction Broadcasting**: Broadcast to Bitcoin Testnet4

### Ready for Expansion

- ⏳ Transfer gift cards
- ⏳ Redeem gift card balance
- ⏳ View gift cards in wallet
- ⏳ Gift card marketplace

See `APP_OVERVIEW.md` for detailed feature documentation and expansion guide.

---

## 🛠️ Development

### Building the Charms App

```bash
cd gift-cards
charms app build
# Output: target/wasm32-wasip1/release/gift-cards.wasm
```

### Getting Verification Key

```bash
cd gift-cards
charms app vk
# Returns: 1d7adfd77c17fec0df6ce3262d26a83318234c7d4e8a60659d331b395f67d6f0
```

### API Endpoints

- `GET /health` - Health check
- `POST /api/gift-cards/mint` - Mint a gift card
- `GET /api/gift-cards/:tokenId` - Get gift card details

---

## 🧪 Testing

### Test on Bitcoin Testnet4

1. **Get Testnet4 BTC**:
   - Use faucet: https://bitcoinfaucet.uo1.net/
   - Or click "Get Testnet4 BTC" in the app

2. **Connect Wallet**:
   - Install Unisat, Xverse, or Leather
   - Switch to Testnet4 network
   - Connect to app

3. **Test Minting**:
   - Navigate to any gift card
   - Select amount
   - Click "Mint with Charms"
   - Verify on memepool.space/testnet4

---

## 📚 Documentation

- **README.md** (this file) - Quick start and overview
- **APP_OVERVIEW.md** - Complete technical documentation, architecture, features, and expansion guide

---

## 🔗 Resources

- [Charms Protocol](https://charms.dev)
- [Charms Documentation](https://docs.charms.dev)
- [Charms Wallet Integration](https://docs.charms.dev/guides/wallet-integration/)
- [Bitcoin Testnet4 Faucet](https://bitcoinfaucet.uo1.net/)
- [Mempool Explorer Testnet4](https://memepool.space/testnet4)

---

## 🏗️ Architecture

### Backend (Charms App)
- **Language**: Rust
- **Framework**: Charms SDK
- **Location**: `gift-cards/`
- **Purpose**: Defines programmable logic for gift cards

### API Server
- **Language**: TypeScript/Node.js
- **Framework**: Express
- **Location**: `api/`
- **Purpose**: Interfaces between frontend and Charms CLI/Prover API

### Frontend
- **Framework**: Next.js 15
- **Language**: TypeScript/React
- **Location**: `src/`
- **Purpose**: User interface and wallet integration

---

## 🎯 Programmable Features

### Gift Card Rules

- ✅ **Expiration**: Gift cards can have expiration dates
- ✅ **Balance Tracking**: Fungible tokens track remaining balance
- ✅ **Partial Redemption**: Redeem portion of gift card balance
- ✅ **Transfer Support**: Transfer gift card tokens
- ✅ **Metadata**: NFT stores brand, image, creation date

### Enforced Logic

```rust
// Expiration check
check!(current_time < expiration_date);

// Balance enforcement
check!(output_amount < input_amount);

// Transfer validation
check!(input_amount == output_amount);
```

---

## 🐛 Troubleshooting

### API Server Not Starting
- Check if port 3001 is available
- Verify `api/.env` file exists
- Run `cd api && npm install`

### Frontend Not Loading
- Check if port 3000 is available
- Verify `.env.local` file exists
- Run `npm install` in root directory
- Clear cache: `rm -rf .next && npm run dev`

### Wallet Connection Issues
- Ensure wallet is on Testnet4 network
- Check browser console for errors
- Try disconnecting and reconnecting wallet

### Charms CLI Issues
- Verify Rust and Cargo are installed
- Check `charms --version`
- Reinstall: `cargo install --locked charms`

---

## 📝 License

MIT License - see LICENSE file for details.

---

## 🙏 Acknowledgments

- Charms Protocol team for the amazing SDK
- Bitcoin community for Testnet4
- All open-source contributors

---

**Built with ❤️ for the Charms Hackathon**
