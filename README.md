# Charm Cards - Programmable Bitcoin Gift Cards

**Create, transfer, and redeem programmable gift cards directly on Bitcoin using the Charms Protocol.**

[![Charms Protocol](https://img.shields.io/badge/Charms-Protocol-orange)](https://charms.dev)
[![Bitcoin Testnet4](https://img.shields.io/badge/Network-Testnet4-blue)](https://memepool.space/testnet4)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## Overview

Charm Cards enables merchants to create programmable Bitcoin gift cards as NFTs with fungible token balances. Built on the Charms Protocol, these gift cards run directly on Bitcoin with programmable logic for expiration dates, partial redemption, and transfers - all without layer-2 solutions.

### Key Features

- **Bitcoin-Native**: Gift cards are NFTs on Bitcoin, not layer-2
- **Programmable**: Custom logic for expiration, redemption, transfers
- **Secure**: Leverages Bitcoin's security model
- **User-Friendly**: Simple UI for complex blockchain operations
- **No Local Node Required**: Uses Charms Prover API for all transaction broadcasting

---

## How It Works

### Architecture

The application consists of three main components:

```
CharmCards/
├── gift-cards/     # Charms App (Rust) - Built once, creates WASM binary
├── api/            # API Server (Node.js) - MUST RUN
└── src/            # Frontend (Next.js) - MUST RUN
```

**Component Roles:**

1. **`gift-cards/`** (Rust/Charms SDK)
   - Defines the programmable logic for gift cards
   - Built once to create a WASM binary (`gift-cards.wasm`)
   - The binary is used by the API server for redeem and transfer operations
   - Not a running service - just a library that gets compiled

2. **`api/`** (Express/TypeScript)
   - Bridges the frontend and Charms Prover API
   - Creates spells (transaction templates)
   - Builds and includes WASM binaries when needed
   - Calls Charms Prover API for proof generation and broadcasting
   - Must run continuously on port 3001

3. **`src/`** (Next.js/React)
   - User interface for minting, redeeming, and transferring gift cards
   - Wallet integration (Unisat, Xverse, Leather)
   - Transaction signing via wallet
   - Must run continuously on port 3000

### Application Flow

#### Mint Flow (Creating a Gift Card)

```
User clicks "Mint" 
  → Frontend validates wallet/network
  → Frontend calls API: POST /api/gift-cards/mint
  → API creates spell (YAML template with gift card data)
  → API calls Charms Prover API: POST /spells/prove
    → Prover API generates proof
    → Prover API constructs commit + spell transactions
    → Prover API broadcasts package to Bitcoin network
    → Returns commit_txid and spell_txid
  → API returns proof to Frontend
  → Frontend signs transactions via wallet
  → Frontend shows success (transactions already broadcast)
```

**Key Points:**
- Mint can work in "mock mode" (no WASM binary required)
- Charms Prover API handles all broadcasting internally
- No local Bitcoin node needed
- Transactions are broadcast as a package (commit + spell together)

#### Redeem Flow (Spending Gift Card Balance)

```
User clicks "Redeem" and enters amount
  → Frontend validates amount and balance
  → Frontend calls API: POST /api/gift-cards/redeem
  → API corrects app_vk in spell (if needed)
  → API builds WASM binary (required for state changes)
  → API creates redeem spell with updated balance
  → API calls Charms Prover API with binary included
    → Prover API executes WASM to validate redemption
    → Prover API generates proof with state changes
    → Prover API broadcasts transactions
  → API returns proof to Frontend
  → Frontend signs transactions via wallet
  → Frontend shows success
```

**Key Points:**
- Redeem REQUIRES the WASM binary (cannot use mock mode)
- Binary must match the app_id from the original mint
- App VK is automatically corrected by the API
- State changes are validated by executing the WASM

#### Transfer Flow (Sending Gift Card to Another Address)

```
User clicks "Transfer" and enters recipient address
  → Frontend validates address format
  → Frontend calls API: POST /api/gift-cards/transfer
  → API corrects app_vk in spell (if needed)
  → API builds WASM binary (required for state changes)
  → API creates transfer spell
  → API calls Charms Prover API with binary included
    → Prover API executes WASM to validate transfer
    → Prover API generates proof
    → Prover API broadcasts transactions
  → API returns proof to Frontend
  → Frontend signs transactions via wallet
  → Frontend shows success
```

**Key Points:**
- Transfer REQUIRES the WASM binary (same as redeem)
- Binary must match the app_id from the original mint
- NFT and tokens are transferred together

### Key Concepts

#### App ID and Verification Key (VK)

- **App ID**: 64-character hex string derived from the funding UTXO hash during mint
  - Format: `SHA256(inUtxo)` → 64 hex characters
  - Used to identify the gift card app instance
  - Stored as `tokenId` in the wallet

- **Verification Key (VK)**: 64-character hex string derived from the WASM binary
  - Generated when the WASM is built: `charms app vk <binary>`
  - Must match between mint and redeem/transfer operations
  - If you rebuild the WASM, the VK changes and existing NFTs break

#### Spell Format

Spells are YAML templates that define transactions:

```yaml
version: 8
apps:
  $00: n/<app_id>/<app_vk>  # NFT app
  $01: t/<app_id>/<app_vk>  # Token app
ins:
  - utxo_id: <txid>:<vout>
    charms:
      $00: { ... NFT metadata ... }
      $01: <token_balance>
outs:
  - address: <recipient>
    sats: 1000
    charms:
      $00: { ... updated NFT metadata ... }
      $01: <updated_token_balance>
```

#### Binary Requirements

- **Mint**: Can use mock mode (no binary) or include binary
- **Redeem**: ALWAYS requires binary - executes WASM to update state
- **Transfer**: ALWAYS requires binary - executes WASM to move NFT/tokens

The binary is sent to the Prover API in the `binaries` object:
```json
{
  "binaries": {
    "<app_id>": "<base64_encoded_wasm>"
  }
}
```

Note: The binary key is just the 64-character app_id hex string, not the full `n/<app_id>/<app_vk>` format.

#### Charms Prover API

The Prover API (`https://v8.charms.dev/spells/prove`) handles:

1. **Spell Validation**: Ensures the spell structure is correct
2. **Proof Generation**: Creates zero-knowledge proofs
3. **Transaction Construction**: Builds commit and spell transactions
4. **Package Broadcasting**: Broadcasts both transactions as a package using Charms' full nodes

**Important**: Charms requires commit and spell transactions to be broadcast as a package. When using the Charms Prover API, this package submission is performed internally as part of the `/spells/prove` call using Charms' full nodes. No separate broadcast step is required or expected from the client.

---

## Quick Start

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
CHARMS_APP_VK=<your_app_vk_from_build>
BITCOIN_NETWORK=testnet4
PROVER_API_URL=https://v8.charms.dev/spells/prove
```

To get your app VK:
```bash
cd gift-cards
charms app vk target/wasm32-wasip1/release/gift-cards.wasm
```

**Create `.env.local` (root directory):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_BITCOIN_NETWORK=testnet4
NEXT_PUBLIC_CHARMS_EXPLORER_URL=https://memepool.space/testnet4
NEXT_PUBLIC_PROVER_API_URL=https://v8.charms.dev/spells/prove
```

### Running the Application

**You need TWO terminals open!**

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

**Or use the service manager:**
```bash
./start-services.sh --start
```

---

## Project Structure

```
CharmCards/
├── gift-cards/              # Charms App (Rust) - Built once
│   ├── src/
│   │   ├── lib.rs          # Programmable logic (gift card rules)
│   │   └── main.rs         # App entry point
│   ├── spells/             # Spell templates (YAML)
│   │   ├── mint-gift-card.yaml
│   │   ├── redeem-balance.yaml
│   │   └── send.yaml
│   └── target/             # Built WASM binary (created after build)
│       └── wasm32-wasip1/release/gift-cards.wasm
│
├── api/                     # API Server (Express) - MUST RUN
│   ├── src/
│   │   ├── services/
│   │   │   └── charms-service.ts  # Charms Prover API integration
│   │   ├── routes/
│   │   │   ├── gift-cards.ts      # Mint, redeem, transfer endpoints
│   │   │   └── utxo.ts            # UTXO validation
│   │   └── server.ts              # Express server setup
│   ├── package.json
│   └── .env                # API environment variables
│
├── src/                     # Frontend (Next.js) - MUST RUN
│   ├── components/
│   │   ├── sections/       # Main page sections
│   │   └── ui/             # Reusable UI components
│   ├── hooks/
│   │   └── use-charms.ts   # Charms integration hook
│   ├── lib/charms/         # Charms utilities
│   │   ├── wallet.ts       # Wallet operations
│   │   └── spells.ts      # Spell creation
│   └── app/                # Next.js pages
│
├── setup-charms-app.sh     # Setup script (builds app, gets VK)
├── verify-charms-setup.sh  # Verification script
├── check-utxos.sh          # Check UTXOs for an address
├── start-services.sh       # Service manager (API + Frontend)
└── README.md               # This file
```

---

## How to Use

### 1. Get Testnet4 BTC

1. Connect your Bitcoin wallet (Unisat, Xverse, or Leather)
2. Switch to Testnet4 network (app will prompt you automatically)
3. Click "Get Testnet4 BTC from Faucet" in the network modal
4. Copy your address and use it in a Testnet4 faucet

### 2. Mint a Gift Card

1. Navigate to any gift card (e.g., Amazon, Uber)
2. Select an amount
3. Click **"Mint with Charms"**
4. Approve the transaction in your wallet
5. Wait for confirmation
6. View your gift card in "My Wallet"

### 3. Redeem Gift Card Balance

1. Go to "My Wallet" page
2. Click "Redeem" on a gift card
3. Enter the amount to redeem
4. Approve the transaction in your wallet
5. Balance is updated (NFT remains, balance decreases)

### 4. Transfer Gift Card

1. Go to "My Wallet" page
2. Click "Transfer" on a gift card
3. Enter recipient Bitcoin address (Taproot format)
4. Approve the transaction in your wallet
5. Gift card is transferred to the new owner

---

## Development

### Building the Charms App

```bash
cd gift-cards
charms app build
# Output: target/wasm32-wasip1/release/gift-cards.wasm
```

### Getting Verification Key

```bash
cd gift-cards
charms app vk target/wasm32-wasip1/release/gift-cards.wasm
# Returns: 64-character hex string
# Add this to api/.env as CHARMS_APP_VK
```

### Using Setup Script

```bash
./setup-charms-app.sh
# This will:
# 1. Check Rust WASM target
# 2. Build the app
# 3. Get the VK
# 4. Update api/.env automatically
```

### API Endpoints

- `GET /health` - Health check
- `POST /api/gift-cards/mint` - Mint a gift card
- `POST /api/gift-cards/redeem` - Redeem gift card balance
- `POST /api/gift-cards/transfer` - Transfer gift card
- `GET /api/utxo/:utxo` - Validate UTXO

---

## Troubleshooting

### API Server Not Starting
- Check if port 3001 is available
- Verify `api/.env` file exists with correct values
- Run `cd api && npm install`
- Check logs: `/tmp/charm-cards-api.log` (if using start-services.sh)

### Frontend Not Loading
- Check if port 3000 is available
- Verify `.env.local` file exists
- Run `npm install` in root directory
- Clear cache: `rm -rf .next && npm run dev`

### Wallet Connection Issues
- Ensure wallet is on Testnet4 network
- Check browser console for errors
- Try disconnecting and reconnecting wallet
- Verify wallet supports Taproot addresses

### Charms CLI Issues
- Verify Rust and Cargo are installed: `rustc --version`, `cargo --version`
- Check `charms --version`
- Reinstall: `cargo install --locked charms`

### "App binary not found" Error
- Build the WASM binary: `cd gift-cards && cargo build --release --target wasm32-wasip1`
- Verify binary exists: `ls gift-cards/target/wasm32-wasip1/release/gift-cards.wasm`
- This error occurs for redeem/transfer operations (binary required)

### "App VK mismatch" Error
- Run `./setup-charms-app.sh` to rebuild and update VK
- Ensure `CHARMS_APP_VK` in `api/.env` matches the current WASM binary
- If you rebuilt the WASM, you must re-mint NFTs (existing ones won't work)

### "Expected 64 hex characters" Error
- This means the binary key format is incorrect
- Binary keys should be just the 64-character app_id hex string
- Check that the app_id from mint matches the tokenId being used

---

## Resources

- [Charms Protocol](https://charms.dev)
- [Charms Documentation](https://docs.charms.dev)
- [Charms Wallet Integration](https://docs.charms.dev/guides/wallet-integration/)
- [Charms Prover API](https://docs.charms.dev/guides/wallet-integration/transactions/prover-api/)
- [Bitcoin Testnet4 Faucet](https://bitcoinfaucet.uo1.net/)
- [Mempool Explorer Testnet4](https://memepool.space/testnet4)

---

## License

MIT License - see LICENSE file for details.

---

**Built with ❤️ for  Charms**
