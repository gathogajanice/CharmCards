# Charm Cards - Complete App Overview

## 📋 Table of Contents

1. [Introduction](#introduction)
2. [Architecture](#architecture)
3. [Features](#features)
4. [How It Works](#how-it-works)
5. [Technical Stack](#technical-stack)
6. [Setup & Running](#setup--running)
7. [API Reference](#api-reference)
8. [Charms Integration](#charms-integration)
9. [User Flow](#user-flow)
10. [Expansion Guide](#expansion-guide)

---

## Introduction

Charm Cards is a full-stack application that enables merchants to create programmable Bitcoin gift cards using the Charms Protocol. Gift cards are minted as NFTs with associated fungible token balances, all running directly on Bitcoin with programmable logic.

### Problem Solved

Traditional gift cards require centralized systems, layer-2 solutions, or separate blockchains. Charm Cards solves this by:
- Creating gift cards directly on Bitcoin
- Enforcing programmable rules (expiration, redemption, transfers)
- Maintaining Bitcoin-level security
- Enabling cross-chain compatibility through Charms

---

## Architecture

### System Overview

```
┌─────────────┐
│   Frontend  │  Next.js + React + TypeScript
│  (Port 3000)│
└──────┬──────┘
       │ HTTP/REST
       ▼
┌─────────────┐
│  API Server │  Express + TypeScript
│  (Port 3001)│
└──────┬──────┘
       │
       ├──► Charms CLI (spell validation)
       └──► Prover API (proof generation)
              │
              ▼
┌─────────────┐
│   Bitcoin   │  Testnet4 Network
│  Blockchain │
└─────────────┘
```

### Component Breakdown

#### 1. Charms App (Rust)
- **Location**: `gift-cards/`
- **Purpose**: Defines programmable logic for gift cards
- **Key Files**:
  - `src/lib.rs` - zk-app contract logic
  - `spells/*.yaml` - Spell templates

#### 2. API Server (Node.js/Express)
- **Location**: `api/`
- **Purpose**: Interfaces between frontend and Charms ecosystem
- **Key Files**:
  - `src/server.ts` - Express server
  - `src/services/charms-service.ts` - Charms integration
  - `src/routes/gift-cards.ts` - API routes

#### 3. Frontend (Next.js)
- **Location**: `src/`
- **Purpose**: User interface and wallet integration
- **Key Files**:
  - `src/components/sections/gift-card-purchase.tsx` - Main UI
  - `src/hooks/use-charms.ts` - Charms operations hook
  - `src/lib/charms/` - Charms utilities

---

## Features

### ✅ Implemented Features

#### 1. Gift Card Minting
- Create programmable gift cards as NFTs
- Associate fungible token balance
- Set expiration dates
- Store metadata (brand, image, amount)

#### 2. Network Detection & Switching
- Automatic Bitcoin network detection
- Prompts user to switch to Testnet4
- Wallet-specific switching instructions
- Prevents actions on wrong network

#### 3. Testnet Faucet Integration
- Easy access to Testnet4 BTC
- Multiple faucet links
- One-click address copying
- Integrated into network modal

#### 4. Wallet Integration
- Support for Unisat, Xverse, Leather
- Automatic wallet detection
- Connection management
- Address and network detection

#### 5. Spell Creation & Validation
- Generate Charms spells from UI
- Validate spells using Charms CLI
- Error handling and feedback

#### 6. Proof Generation
- Generate zero-knowledge proofs
- Create commit and spell transactions
- Via Prover API (`v8.charms.dev/spells/prove`)

#### 7. Transaction Management
- UTXO fetching from mempool.space
- Transaction signing infrastructure
- Transaction broadcasting to Testnet4

### ⏳ Ready for Expansion

- Transfer gift cards between addresses
- Redeem gift card balance (partial or full)
- View all gift cards in wallet
- Gift card marketplace
- Multi-brand support
- Expiration notifications

---

## How It Works

### Gift Card Minting Flow

```
1. User Action
   └─> User selects gift card and amount
   └─> Clicks "Mint with Charms"

2. Network Check
   └─> App detects network from address
   └─> Prompts switch if not Testnet4

3. UTXO Fetching
   └─> Fetches available UTXOs from mempool.space
   └─> Selects UTXO for funding

4. Spell Creation
   └─> Creates spell YAML with gift card metadata
   └─> Includes NFT and fungible token charms

5. Spell Validation
   └─> Validates spell using Charms CLI
   └─> Checks against app contract

6. Proof Generation
   └─> Sends spell to Prover API
   └─> Receives commit_tx and spell_tx hex

7. Transaction Signing
   └─> Signs commit transaction
   └─> Signs spell transaction

8. Broadcasting
   └─> Broadcasts commit transaction
   └─> Broadcasts spell transaction

9. Verification
   └─> Transaction appears on mempool.space/testnet4
   └─> Gift card NFT created
```

### Programmable Logic

The Charms app enforces these rules:

#### Minting Rules
- Initial amount equals remaining balance
- NFT identity derived from funding UTXO
- Only one NFT can be minted per spell

#### Transfer Rules
- Token amounts must be conserved
- NFT metadata must be preserved
- Balance cannot exceed initial amount

#### Redemption Rules
- Output amount must be less than input amount
- Expiration date must not be passed
- NFT metadata must be preserved

---

## Technical Stack

### Backend

- **Charms App**: Rust + Charms SDK
- **API Server**: Node.js + Express + TypeScript
- **Charms CLI**: For spell validation
- **Prover API**: For proof generation

### Frontend

- **Framework**: Next.js 15 (Turbopack)
- **UI Library**: React 19 + TypeScript
- **Styling**: Tailwind CSS
- **Wallet**: @reown/appkit + BitcoinAdapter
- **State**: React Hooks + Context API

### Dependencies

- `charms-wallet-js` - Bitcoin wallet operations
- `js-yaml` - YAML parsing for spells
- `@reown/appkit` - Wallet connection
- `sonner` - Toast notifications

---

## Setup & Running

### Understanding the Structure

**Three Components:**

1. **`gift-cards/` (Rust)**
   - Purpose: Defines programmable logic for gift cards
   - Action: Build once (creates WASM binary)
   - Command: `cd gift-cards && charms app build`
   - Runs?: **NO** - Just needs to be built. The API server uses the compiled binary.

2. **`api/` (Node.js/Express)**
   - Purpose: Bridge between frontend and Charms ecosystem
   - Action: Run continuously
   - Command: `cd api && npm run dev`
   - Runs?: **YES** - Must be running. Runs from `api/` directory.

3. **`src/` (Next.js)**
   - Purpose: User interface
   - Action: Run continuously
   - Command: `npm run dev` (from root directory)
   - Runs?: **YES** - Must be running. Runs from root directory.

**Why `api/` needs its own directory:**
- Has its own `package.json` and dependencies
- Reads `.env` file from `api/.env`
- Uses relative paths like `../gift-cards`

**Why `gift-cards/` doesn't run:**
- It's a Rust library, not a server
- Gets compiled to WASM binary (one-time build)
- API server uses the compiled binary for validation

### Prerequisites

```bash
# Node.js 18+
node --version

# Rust and Cargo
rustc --version
cargo --version

# npm
npm --version
```

### Installation Steps

```bash
# 1. Install frontend dependencies (root directory)
npm install

# 2. Install API dependencies
cd api
npm install
cd ..

# 3. Install Charms CLI (one-time)
export CARGO_TARGET_DIR=$(mktemp -d)/target
cargo install --locked charms

# 4. Build Charms app (one-time, creates WASM binary)
cd gift-cards
charms app build
cd ..
```

### Running the App

**⚠️ IMPORTANT: You need TWO terminals open!**

**Terminal 1 - API Server:**
```bash
cd api
npm run dev
# Runs on http://localhost:3001
# Keep this terminal open!
```

**Terminal 2 - Frontend (NEW terminal, root directory):**
```bash
# Make sure you're in root directory (not in api/)
# If you're in api/, type: cd ..
npm run dev
# Runs on http://localhost:3000
# Keep this terminal open!
```

**Open Browser:** http://localhost:3000

### Environment Variables

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
NEXT_PUBLIC_CHARMS_EXPLORER_URL=https://mempool.space/testnet4
NEXT_PUBLIC_PROVER_API_URL=https://v8.charms.dev/spells/prove
```

### Environment Setup

Create `api/.env`:
```env
PORT=3001
CHARMS_APP_PATH=../gift-cards
CHARMS_APP_VK=1d7adfd77c17fec0df6ce3262d26a83318234c7d4e8a60659d331b395f67d6f0
BITCOIN_NETWORK=testnet4
PROVER_API_URL=https://v8.charms.dev/spells/prove
```

Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_BITCOIN_NETWORK=testnet4
NEXT_PUBLIC_CHARMS_EXPLORER_URL=https://mempool.space/testnet4
NEXT_PUBLIC_PROVER_API_URL=https://v8.charms.dev/spells/prove
```

---

## API Reference

### Endpoints

#### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "charm-cards-api"
}
```

#### `POST /api/gift-cards/mint`
Mint a new gift card.

**Request Body:**
```json
{
  "inUtxo": "txid:vout",
  "recipientAddress": "tb1p...",
  "brand": "Amazon",
  "image": "https://...",
  "initialAmount": 5000,
  "expirationDate": 1735689600
}
```

**Response:**
```json
{
  "spell": "...",
  "proof": {
    "commit_tx": "...",
    "spell_tx": "..."
  }
}
```

---

## Charms Integration

### Prover API

**Endpoint**: `https://v8.charms.dev/spells/prove`

**Request:**
```json
{
  "spell": { ... },
  "app_bins": "path/to/app.wasm",
  "prev_txs": "..."
}
```

**Response:**
```json
{
  "proof": "...",
  "commit_tx": "...",
  "spell_tx": "..."
}
```

### Spell Format

Spells are defined in YAML format:

```yaml
version: 8
apps:
  $00: n/${app_id}/${app_vk}
  $01: t/${app_id}/${app_vk}
ins:
  - utxo_id: ${utxo}
    charms: {}
outs:
  - address: ${address}
    charms:
      $00: { brand: "...", ... }
      $01: ${amount}
```

---

## User Flow

### 1. First Time User

1. **Open App**: Navigate to http://localhost:3000
2. **Connect Wallet**: Click "Connect Wallet" button
3. **Network Detection**: App detects network and prompts if needed
4. **Get Testnet BTC**: Use faucet integration to get testnet BTC
5. **Browse Gift Cards**: View available gift cards
6. **Mint Gift Card**: Select card, amount, and mint

### 2. Returning User

1. **Open App**: App remembers wallet connection
2. **Network Check**: Automatic network verification
3. **View Gift Cards**: See owned gift cards in wallet
4. **Mint More**: Create additional gift cards

---

## Expansion Guide

### Adding Transfer Feature

1. **Backend**: Add transfer endpoint in `api/src/routes/gift-cards.ts`
2. **Frontend**: Create transfer component
3. **Spell**: Use `transfer-tokens.yaml` template
4. **UI**: Add transfer button to gift card view

### Adding Redemption Feature

1. **Backend**: Add redemption endpoint
2. **Frontend**: Create redemption component
3. **Spell**: Use `redeem-balance.yaml` template
4. **Validation**: Check expiration date

### Adding Wallet View

1. **Install WASM**: Build `charms_lib.wasm` bindings
2. **Extract Charms**: Use `extractAndVerifySpell()` function
3. **Display**: Show NFTs and tokens in wallet UI

See code comments in `src/lib/charms/` for implementation details.

---

## Troubleshooting

### Common Issues

**API Server Not Starting**
- Check port 3001 availability
- Verify `api/.env` exists
- Check Node.js version (18+)

**Frontend Build Errors**
- Clear `.next` directory
- Run `npm install` again
- Check TypeScript errors

**Wallet Connection Issues**
- Ensure wallet extension is installed
- Check browser console for errors
- Verify Testnet4 network

**Charms CLI Errors**
- Verify Rust installation
- Check `charms --version`
- Reinstall Charms CLI if needed

---

## Security Considerations

- ✅ Never expose private keys
- ✅ Validate all user inputs
- ✅ Use Testnet4 for development
- ✅ Verify spells before broadcasting
- ✅ Check network before transactions

---

## Performance

- **Spell Creation**: < 1 second
- **Proof Generation**: 2-5 seconds (depends on Prover API)
- **Transaction Broadcasting**: < 1 second
- **Network Detection**: Instant

---

## Future Enhancements

- [ ] Batch operations for multiple gift cards
- [ ] Gift card marketplace
- [ ] Multi-signature support
- [ ] Advanced expiration rules
- [ ] Gift card analytics
- [ ] Mobile app support

---

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

---

## License

MIT License - see LICENSE file for details.

---

**For detailed technical documentation, see code comments and Charms documentation at https://docs.charms.dev**

