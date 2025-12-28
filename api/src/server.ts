// Load .env file FIRST, before any other imports
// This ensures environment variables are available when modules are loaded
import dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Now import other modules (they can now access process.env)
import express from 'express';
import cors from 'cors';
import giftCardsRoutes from './routes/gift-cards';
import utxoRoutes from './routes/utxo';
import broadcastRoutes from './routes/broadcast';
import { testBitcoinRpcConnection, getBitcoinRpcConfig } from './routes/broadcast';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/gift-cards', giftCardsRoutes);
app.use('/api/utxo', utxoRoutes);
app.use('/api/broadcast', broadcastRoutes);

// Root route - API status
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'charm-cards-api',
    version: '1.0.0',
    network: process.env.BITCOIN_NETWORK || 'testnet4',
    endpoints: ['/health', '/api/gift-cards', '/api/utxo', '/api/broadcast'],
    message: 'Charm Cards API is running. Visit /health for health check.'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'charm-cards-api' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Charms Gift Cards API server running on port ${PORT}`);
  console.log(`📦 App path: ${process.env.CHARMS_APP_PATH || '../gift-cards'}`);
  console.log(`🔑 App VK: ${process.env.CHARMS_APP_VK?.substring(0, 16)}...`);
  // Debug: Check if CryptoAPIs API key is loaded
  if (process.env.CRYPTOAPIS_API_KEY) {
    console.log(`✅ CryptoAPIs API key loaded (length: ${process.env.CRYPTOAPIS_API_KEY.trim().length} chars)`);
  } else {
    console.warn(`⚠️ CryptoAPIs API key not found. Check api/.env file for CRYPTOAPIS_API_KEY`);
  }
  
  // Debug: Check if Bitcoin Core RPC is configured
  const bitcoinRpcConfig = getBitcoinRpcConfig();
  if (bitcoinRpcConfig) {
    const rpcUrl = process.env.BITCOIN_RPC_URL;
    // Hide credentials in log
    const safeUrl = rpcUrl?.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@') || 'unknown';
    console.log(`✅ Bitcoin Core RPC configured: ${safeUrl}`);
    console.log(`   Package broadcasting will use submitpackage RPC method`);
    
    // Test RPC connection on startup
    console.log(`🔍 Testing Bitcoin Core RPC connection...`);
    testBitcoinRpcConnection(bitcoinRpcConfig)
      .then((result) => {
        if (result.connected) {
          console.log(`✅ Bitcoin Core RPC connection successful`);
          if (result.details) {
            console.log(`   Chain: ${result.details.chain || 'unknown'}, Blocks: ${result.details.blocks?.toLocaleString() || 'unknown'}`);
          }
        } else {
          console.warn(`⚠️ Bitcoin Core RPC connection failed: ${result.error}`);
          console.warn(`   The node may still be starting up. Package broadcasting will fail until the node is available.`);
          console.warn(`   Run ./check-bitcoin-rpc.sh for detailed diagnostics and troubleshooting steps.`);
        }
      })
      .catch((error) => {
        console.warn(`⚠️ Error testing Bitcoin Core RPC connection: ${error.message}`);
        console.warn(`   The node may still be starting up. Package broadcasting will fail until the node is available.`);
      });
  } else {
    console.log(`ℹ️ Bitcoin Core RPC not configured (BITCOIN_RPC_URL not set)`);
    console.log(`   Package broadcasting will use sequential method (CryptoAPIs → Mempool.space)`);
  }
});

