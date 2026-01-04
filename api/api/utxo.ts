// UTXO API endpoint for Vercel
import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

const NETWORK = process.env.BITCOIN_NETWORK || 'testnet4';
const MEMEPOOL_BASE_URL = NETWORK === 'testnet4'
  ? 'https://memepool.space/testnet4'
  : 'https://memepool.space';

// Handle UTXO routes
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const path = req.url?.split('?')[0] || '';
  const address = req.query.address as string;

  // Route: GET /api/utxo/:address
  if (req.method === 'GET' && address) {
    try {
      const utxoUrl = `${MEMEPOOL_BASE_URL}/api/address/${address}/utxo`;
      const response = await axios.get(utxoUrl, {
        timeout: 10000,
      });

      const utxos = response.data.map((utxo: any) => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        status: utxo.status,
      }));

      return res.status(200).json(utxos);
    } catch (error: any) {
      console.error('UTXO fetch error:', error);
      return res.status(500).json({
        error: 'Failed to fetch UTXOs',
        message: error.message || 'Unknown error',
      });
    }
  }

  // Default: Method not allowed
  return res.status(405).json({ error: 'Method not allowed' });
}

