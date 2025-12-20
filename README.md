# CharmyGifts - Gift Cards on Bitcoin

> A decentralized gift card platform where merchants create gift cards that land directly in your Bitcoin wallet as NFTs. Secure, transferable, and programmable. Powered by Charms.

[![Built with Charms](https://img.shields.io/badge/Built%20with-Charms-orange)](https://charms.dev)
[![Bitcoin Native](https://img.shields.io/badge/Bitcoin-Native-orange)](https://bitcoin.org)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 🎯 What We're Building

**CharmyGifts** is a decentralized gift card platform that enables merchants to create gift cards (Uber, Amazon, Netflix, etc.) that land directly in users' wallets as NFTs. Unlike traditional gift cards that use email codes, our gift cards are secured by Bitcoin, fully transferable, and programmable.

### The Problem We Solve

Traditional gift card platforms (like CoinsBee) have significant limitations:
- ❌ **Email voucher codes** - Can be lost, stolen, or copied
- ❌ **Not transferable** - Hard to gift or share
- ❌ **No programmable features** - Static codes with no logic
- ❌ **Centralized** - Company controls everything
- ❌ **High fees** - Platform takes significant cut
- ❌ **Geographic restrictions** - Limited availability

### Our Solution

- ✅ **NFTs in Wallet** - Gift cards land directly in your Bitcoin wallet
- ✅ **Fully Transferable** - Send gift cards to anyone, anywhere
- ✅ **Programmable** - Automatic expiration, partial redemption, custom rules
- ✅ **Decentralized** - Secured by Bitcoin, no central authority
- ✅ **Low Fees** - Bitcoin transaction fees (~$0.10)
- ✅ **Global** - Works everywhere, no borders

---

## 🚀 Why Charms?

### The Challenge

We needed a way to create programmable NFTs on Bitcoin that could:
1. Store unique information (brand, amount, expiration)
2. Manage token balances (spendable balance)
3. Enforce programmable rules (expiration, partial redemption)
4. Work cross-chain (Bitcoin, Ethereum, Solana)
5. Maintain Bitcoin-level security

### Why Charms is Perfect

**Charms is the only solution that enables:**

#### 1. **Bitcoin-Native NFTs**
- Create NFTs directly on Bitcoin (most secure blockchain)
- No layer-2 solutions or sidechains needed
- Leverages Bitcoin's proven security model

#### 2. **Programmable Logic**
- Custom issuance models (fair launch, airdrops)
- Conditional transfers (expiration, balance checks)
- Complex asset logic (partial redemption, revenue sharing)
- All logic runs on Bitcoin via Charms

#### 3. **Cross-Chain Compatibility**
- Launch on Bitcoin, trade on Solana/Ethereum DEXs
- No bridges required (trustless)
- Universal compatibility (ERC-20, SPL, etc.)
- Works with existing wallets and dApps

#### 4. **Enhanced UTXO Model (EUTXO)**
- Multiple assets in single transaction
- Arbitrary programmable data in outputs
- Extends Bitcoin's UTXO model for complex logic

#### 5. **Zero-Knowledge Verification**
- Cryptographically succinct proofs
- Verifiable programs
- Maintains trustlessness

### Why Not Other Solutions?

| Solution | Why It Doesn't Work |
|----------|-------------------|
| **Ethereum** | High gas fees, slow, expensive for users |
| **Solana** | Less secure, can go down, not as trusted |
| **Runes/Ordinals** | Not programmable enough, limited functionality |
| **Layer-2 (Lightning)** | Separate chain, less secure, complex |
| **Wrapped Tokens** | Need bridges (risky), custodians required |

**Only Charms enables programmable NFTs on Bitcoin with cross-chain compatibility and automatic enforcement.**

---

## 💡 How It Works

### The Flow

```
Merchant Creates Gift Card → User Buys Gift Card → Gift Card Lands in Wallet → User Redeems Gift Card
```

### Step-by-Step

1. **Merchant Creates Gift Card**
   - Merchant chooses brand (Uber, Amazon, etc.)
   - Sets amount ($50, $100, etc.)
   - Sets expiration (optional)
   - NFT + tokens created on Bitcoin via Charms

2. **User Buys Gift Card**
   - User browses available gift cards
   - Selects gift card and pays with Bitcoin
   - Gift card lands directly in wallet as NFT + tokens
   - User owns it immediately

3. **User Redeems Gift Card**
   - User goes to brand app/website
   - Connects wallet and redeems amount
   - Balance decreases (NFT stays, tokens decrease)
   - Programmable logic enforces rules automatically

4. **User Can Transfer**
   - User sends gift card to friend
   - Friend receives NFT + tokens
   - Friend can use at brand

---

## 🎨 Key Features

### For Merchants

- **Low Cost** - Bitcoin transaction fees (~$0.10)
- **No Platform Dependency** - Decentralized on Bitcoin
- **Programmable Features** - Custom rules, expiration, partial use
- **Global Reach** - Works everywhere, no borders
- **Secure** - Bitcoin-level security
- **No Chargebacks** - Immutable transactions
- **Customer Retention** - Transferable credits increase engagement

### For Users

- **Secure** - Can't be lost, stolen, or copied
- **Transferable** - Send to anyone, anywhere
- **Programmable** - Automatic expiration, partial redemption
- **Self-Custody** - You control your gift cards
- **Clear Expiration** - Know when gift cards expire
- **Partial Use** - Spend part, keep the rest
- **Global** - Works everywhere
- **Lands in Wallet** - Instant ownership, no email codes

### Programmable Features

- ✅ **Automatic Expiration** - Gift cards expire after date
- ✅ **Partial Redemption** - Spend part, keep the rest
- ✅ **Balance Checking** - Can't redeem more than balance
- ✅ **Transfer Rules** - Custom transfer logic
- ✅ **Redemption History** - Track all redemptions
- ✅ **Custom Rules** - Brand-specific logic

---

## 🏗️ Technical Architecture

### Core Components

1. **Charms Backend (Rust)**
   - NFT minting logic
   - Token balance management
   - Programmable redemption rules
   - Expiration enforcement

2. **Frontend (React/Next.js)**
   - Merchant dashboard (create gift cards)
   - User wallet (view gift cards)
   - Redemption interface
   - Buy gift cards interface

3. **Charms SDK Integration**
   - Create spells (mint, redeem)
   - Check gift card status
   - Get balances
   - Transaction signing

### Technology Stack

- **Backend**: Rust, Charms CLI, Bitcoin
- **Frontend**: React, Next.js, TypeScript
- **Wallet**: Unisat, Xverse (Bitcoin wallets)
- **Blockchain**: Bitcoin (mainnet/testnet)

---

## 📊 Use Cases

### 1. Uber Gift Card
- Buy $50 Uber gift card
- Gift card lands in wallet
- Redeem $10 at Uber (balance → $40)
- Transfer $30 to friend
- Friend redeems at Uber

### 2. Amazon Gift Card
- Buy $100 Amazon gift card
- Gift card lands in wallet
- Redeem at Amazon
- Transfer to family
- Expiration tracking

### 3. Netflix Gift Card
- Buy subscription gift card
- Gift card lands in wallet
- Auto-renewal (programmable)
- Transfer to family
- Expiration enforcement

### 4. Corporate Gifts
- Bulk gift card distribution
- Employee rewards
- Corporate gifting
- Usage tracking

---

## 🌍 Competitive Advantage

### vs. CoinsBee (Traditional Gift Cards)

| Feature | CoinsBee | Our Solution |
|---------|----------|--------------|
| **Storage** | Email codes | NFTs in wallet |
| **Security** | Can be lost/stolen | Can't be lost/stolen |
| **Transferability** | Not transferable | Fully transferable |
| **Expiration** | No enforcement | Automatic enforcement |
| **Platform** | One platform only | Multiple platforms |
| **Fees** | High platform fees | Low Bitcoin fees (~$0.10) |
| **Infrastructure** | Requires platform | Uses Bitcoin network |
| **Geographic** | Restrictions | Works globally |
| **Authority** | Centralized | Decentralized |
| **Features** | Static codes | Programmable |

---

## 🎯 Vision

### Short Term
- ✅ Basic gift card creation & redemption
- ✅ Onboard merchants (gift card companies)
- ✅ Support major brands (Uber, Amazon, Netflix)
- ✅ Early adopters

### Medium Term
- 🔄 Multi-brand marketplace
- 🔄 Wallet integration
- 🔄 Loyalty programs
- 🔄 Corporate gift card programs

### Long Term
- 🚀 Standard for Bitcoin gift cards
- 🚀 Multi-currency support
- 🚀 Brand integration
- 🚀 Trading marketplace
- 🚀 Global gift card economy

---

## 🔐 Security & Trust

- **Bitcoin Security** - Leverages Bitcoin's proven security model
- **Cryptographic Proofs** - zkVM provides verifiable proofs
- **Client-Side Validation** - No reliance on external validators
- **Trustless** - No trusted third parties
- **Self-Custody** - Users control their gift cards
- **Immutable** - Transactions can't be reversed

---

## 📈 Scalability

- **Built on Bitcoin** - Global, decentralized, 24/7
- **No Infrastructure Costs** - No servers/databases
- **Works with Existing Wallets** - Universal compatibility
- **Programmable Features** - Expiration, transfers, partial use
- **Low Transaction Costs** - ~$0.10 per transaction
- **Global Reach** - No borders, instant transactions

---

## 🚀 Getting Started

### Prerequisites

- Rust (latest stable version)
- Node.js 18+ and npm
- Bitcoin wallet (Unisat, Xverse, etc.)
- Basic understanding of Bitcoin and NFTs

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/charmygifts.git
cd charmygifts

# Install Charms CLI
export CARGO_TARGET_DIR=$(mktemp -d)/target
cargo install --locked charms

# Set up Charms app
cd charms-app
charms app new gift-cards
charms app vk  # Save this verification key

# Set up frontend
cd ../frontend
npm install
npm run dev
```

### Usage

1. **Create Gift Card (Merchant)**
   - Go to merchant dashboard
   - Fill form: Brand, Amount, Expiration
   - Click "Create Gift Card"
   - NFT + tokens created on Bitcoin

2. **Buy Gift Card (User)**
   - Browse available gift cards
   - Select gift card and pay with Bitcoin
   - Gift card lands in wallet

3. **Redeem Gift Card (User)**
   - Open wallet and select gift card
   - Enter amount to redeem
   - Confirm transaction
   - Balance updates automatically

---

## 📚 Documentation

- [Charms Documentation](https://docs.charms.dev)
- [Charms Whitepaper](https://docs.charms.dev/Charms-whitepaper.pdf)
- [Getting Started Guide](docs/getting-started.md)
- [API Reference](docs/api-reference.md)

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with [Charms Protocol](https://charms.dev)
- Powered by Bitcoin
- Inspired by the need for better gift card solutions

---

## 📞 Contact

- **Website**: [Your Website]
- **Twitter**: [@YourTwitter]
- **Discord**: [Your Discord]
- **Email**: [Your Email]

---

## ⭐ Why This Matters

Traditional gift cards are broken. They use email codes that can be lost, stolen, or copied. They're not transferable, have no programmable features, and require trust in centralized platforms.

**CharmyGifts** fixes all of this by:
- Using NFTs instead of codes (secure, can't be lost)
- Landing directly in wallets (instant ownership)
- Enabling programmable features (expiration, partial redemption)
- Leveraging Bitcoin's security (most trusted blockchain)
- Working globally (no borders, no restrictions)

**This is the future of gift cards: secure, transferable, programmable, and decentralized.**

---

**Built with ❤️ using Charms Protocol**

