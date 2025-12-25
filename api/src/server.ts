import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import * as path from 'path';
import giftCardsRoutes from './routes/gift-cards';
import utxoRoutes from './routes/utxo';

// Load .env file from api directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/gift-cards', giftCardsRoutes);
app.use('/api/utxo', utxoRoutes);

// Root route - API status
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'charm-cards-api',
    version: '1.0.0',
    network: process.env.BITCOIN_NETWORK || 'testnet4',
    endpoints: ['/health', '/api/gift-cards', '/api/utxo'],
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
});

