// Health check endpoint for Vercel
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.json({ 
    status: 'ok', 
    service: 'charm-cards-api',
    timestamp: new Date().toISOString()
  });
}

