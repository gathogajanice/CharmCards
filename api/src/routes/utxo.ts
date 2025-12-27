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
 * GET /api/utxo/tx/:txid/hex
 * Fetch transaction hex (raw transaction) for nonWitnessUtxo in PSBT
 * Returns plain text hex (not JSON) to match memepool.space format
 * NOTE: This route must come before /tx/:txid to ensure proper matching
 */
router.get('/tx/:txid/hex', async (req: Request, res: Response) => {
  try {
    const { txid } = req.params;
    
    if (!txid) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    const txHexUrl = `${MEMEPOOL_BASE_URL}/api/tx/${txid}/hex`;
    
    console.log(`Fetching transaction hex for ${txid} from ${txHexUrl}`);
    
    const response = await axios.get(txHexUrl, {
      timeout: 15000,
      headers: {
        'Accept': 'text/plain', // memepool.space returns hex as plain text
      },
    });
    
    // memepool.space returns hex as plain text (not JSON)
    const txHex = typeof response.data === 'string' 
      ? response.data.trim() 
      : String(response.data).trim();
    
    if (!txHex || txHex.length === 0) {
      return res.status(404).json({ error: 'Transaction hex not found' });
    }
    
    // Validate it looks like hex
    if (!/^[0-9a-fA-F]+$/.test(txHex)) {
      return res.status(400).json({ error: 'Invalid hex format' });
    }
    
    // Return as plain text to match memepool.space format
    res.setHeader('Content-Type', 'text/plain');
    return res.send(txHex);
  } catch (error: any) {
    console.error('Error fetching transaction hex:', error.message);
    
    if (error.response) {
      return res.status(error.response.status).json({
        error: error.response.data?.error || 'Failed to fetch transaction hex',
        status: error.response.status,
      });
    }
    
    return res.status(500).json({
      error: 'Failed to fetch transaction hex from memepool.space',
      message: error.message,
    });
  }
});

/**
 * GET /api/utxo/tx/:txid
 * Fetch transaction details for UTXO info
 * NOTE: This route comes after /tx/:txid/hex to ensure proper matching
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

