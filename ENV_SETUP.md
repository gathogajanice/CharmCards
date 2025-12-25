# Environment Variables Setup Guide

## Overview
This document describes all environment variables required for the CharmCards application.

## Backend Environment Variables (`api/.env`)

### Required Variables

```bash
# Server Configuration
PORT=3001

# Charms App Configuration
CHARMS_APP_PATH=../gift-cards
CHARMS_APP_VK=1d7adfd77c17fec0df6ce3262d26a83318234c7d4e8a60659d331b395f67d6f0

# Network Configuration
BITCOIN_NETWORK=testnet4

# Prover API Configuration
PROVER_API_URL=https://v8.charms.dev/spells/prove

# Development Mode
MOCK_MODE=true
```

### Variable Descriptions

- **PORT**: Port number for the API server (default: 3001)
- **CHARMS_APP_PATH**: Relative path to the gift-cards Rust app directory
- **CHARMS_APP_VK**: App verification key (64-character hex string). This is required for spell validation. If not set, the service will attempt to build the app to get the VK.
- **BITCOIN_NETWORK**: Bitcoin network to use (`testnet4` or `mainnet`)
- **PROVER_API_URL**: URL for the Charms Prover API (default: `https://v8.charms.dev/spells/prove`)
- **MOCK_MODE**: Set to `true` to enable mock mode, which allows the Prover API to work without requiring the WASM file (`app_bins`)

## Frontend Environment Variables (`.env`)

### Required Variables

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001

# Network Configuration
NEXT_PUBLIC_BITCOIN_NETWORK=testnet4

# Explorer URLs
NEXT_PUBLIC_CHARMS_EXPLORER_URL=https://memepool.space/testnet4

# Prover API Configuration
NEXT_PUBLIC_PROVER_API_URL=https://v8.charms.dev/spells/prove

# Development Mode
NEXT_PUBLIC_MOCK_MODE=true
```

### Variable Descriptions

- **NEXT_PUBLIC_API_URL**: URL of the backend API server (default: `http://localhost:3001`)
- **NEXT_PUBLIC_BITCOIN_NETWORK**: Bitcoin network to use (`testnet4` or `mainnet`)
- **NEXT_PUBLIC_CHARMS_EXPLORER_URL**: Base URL for the Bitcoin explorer (default: `https://memepool.space/testnet4`)
- **NEXT_PUBLIC_PROVER_API_URL**: URL for the Charms Prover API (default: `https://v8.charms.dev/spells/prove`)
- **NEXT_PUBLIC_MOCK_MODE**: Set to `true` to enable mock mode on the frontend

## Important Notes

### Next.js Environment Variables
- All frontend environment variables **must** be prefixed with `NEXT_PUBLIC_` to be accessible in the browser
- Variables without this prefix are only available on the server side

### MOCK_MODE
- When `MOCK_MODE=true`, the Prover API can generate proofs without requiring the WASM file
- This is useful for development when the Rust app hasn't been built yet
- Set `MOCK_MODE=false` in production when you have the built WASM file

### CHARMS_APP_VK
- The app verification key is a 64-character hexadecimal string
- It's generated when you build the Charms app: `charms app vk ./target/wasm32-wasip1/release/gift-cards.wasm`
- Setting this in `api/.env` avoids the need to build the app on every server start
- If not set, the service will attempt to build the app automatically (slower startup)

### Network Configuration
- **Testnet4**: Use for development and testing
- **Mainnet**: Use for production (requires real Bitcoin)

## Verification

To verify your environment variables are set correctly:

```bash
# Check backend .env
cat api/.env

# Check frontend .env
cat .env

# Verify backend server loads them correctly
# (Check console output when starting the API server)
```

## Troubleshooting

### Issue: "CharmsService initialized WITHOUT app VK"
- **Solution**: Ensure `CHARMS_APP_VK` is set in `api/.env`
- The VK should be a 64-character hex string

### Issue: "MOCK_MODE not working"
- **Solution**: Ensure both `MOCK_MODE=true` in `api/.env` and `NEXT_PUBLIC_MOCK_MODE=true` in `.env`

### Issue: "Cannot connect to API"
- **Solution**: Verify `NEXT_PUBLIC_API_URL` matches the backend server port
- Default is `http://localhost:3001`

### Issue: "Network mismatch errors"
- **Solution**: Ensure `BITCOIN_NETWORK` in `api/.env` matches `NEXT_PUBLIC_BITCOIN_NETWORK` in `.env`
- Both should be `testnet4` for development

