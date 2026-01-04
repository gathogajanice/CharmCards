// Broadcast API endpoint for Vercel
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Handle broadcast routes
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Route: POST /api/broadcast
  if (req.method === 'POST') {
    // Note: Broadcasting is handled by Charms Prover API internally
    // This endpoint is kept for compatibility but doesn't need to do anything
    return res.status(200).json({
      message: 'Broadcasting is handled by Charms Prover API automatically',
      note: 'No separate broadcast step is required',
    });
  }

  // Default: Method not allowed
  return res.status(405).json({ error: 'Method not allowed' });
}

