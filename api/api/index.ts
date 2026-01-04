// Vercel serverless function entry point
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.json({
    status: 'ok',
    service: 'charm-cards-api',
    version: '1.0.0',
    network: process.env.BITCOIN_NETWORK || 'testnet4',
    endpoints: ['/api/health', '/api/gift-cards', '/api/utxo', '/api/broadcast'],
    message: 'Charm Cards API is running. Visit /api/health for health check.'
  });
}

