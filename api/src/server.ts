import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import giftCardsRoutes from './routes/gift-cards';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/gift-cards', giftCardsRoutes);

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

