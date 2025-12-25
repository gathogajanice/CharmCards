import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

const NETWORK = process.env.BITCOIN_NETWORK || 'testnet4';
const MEMEPOOL_BASE_URL = NETWORK === 'testnet4'
  ? 'https://memepool.space/testnet4'
  : 'https://memepool.space';

/**
 * GET /api/utxo/:address
 * Proxy UTXO fetching from memepool.space to bypass CORS
 */
router.get('/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    // Fetch UTXOs from memepool.space API
    const utxoUrl = `${MEMEPOOL_BASE_URL}/api/address/${address}/utxo`;
    
    console.log(`Fetching UTXOs for address ${address} from ${utxoUrl}`);
    
    const response = await axios.get(utxoUrl, {
      timeout: 10000, // 10 second timeout
    });

    if (response.data && Array.isArray(response.data)) {
      // Map to consistent format
      const utxos = response.data.map((utxo: any) => ({
        txid: utxo.txid || utxo.tx_hash,
        vout: utxo.vout !== undefined ? utxo.vout : (utxo.index !== undefined ? utxo.index : 0),
        value: utxo.value || utxo.amount || 0,
      }));

      console.log(`Fetched ${utxos.length} UTXOs for address ${address}`);
      return res.json(utxos);
    }

    return res.json([]);
  } catch (error: any) {
    console.error('Error fetching UTXOs:', error.message);
    
    if (error.response) {
      return res.status(error.response.status).json({
        error: error.response.data?.error || 'Failed to fetch UTXOs',
        status: error.response.status,
      });
    }
    
    return res.status(500).json({
      error: 'Failed to fetch UTXOs from memepool.space',
      message: error.message,
    });
  }
});

/**
 * GET /api/utxo/tx/:txid
 * Fetch transaction details for UTXO info
 */
router.get('/tx/:txid', async (req: Request, res: Response) => {
  try {
    const { txid } = req.params;
    
    if (!txid) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    const txUrl = `${MEMEPOOL_BASE_URL}/api/tx/${txid}`;
    
    const response = await axios.get(txUrl, {
      timeout: 10000,
    });

    return res.json(response.data);
  } catch (error: any) {
    console.error('Error fetching transaction:', error.message);
    
    if (error.response) {
      return res.status(error.response.status).json({
        error: error.response.data?.error || 'Failed to fetch transaction',
        status: error.response.status,
      });
    }
    
    return res.status(500).json({
      error: 'Failed to fetch transaction from memepool.space',
      message: error.message,
    });
  }
});

export default router;

