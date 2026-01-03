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
// Bitcoin Core RPC removed - Charms Prover API handles all broadcasting

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
  
  // Broadcast configuration
  const broadcastMode = (process.env.BROADCAST_MODE || 'charms').toLowerCase();
  console.log(`📡 Broadcast Mode: ${broadcastMode}`);
  console.log(`   ✅ Charms Prover API handles package submission internally using full nodes`);
  console.log(`   ✅ No separate broadcast step is required or expected from the client`);
  console.log(`   ✅ Bitcoin Core is not required - all broadcasting handled by Charms infrastructure`);
});

