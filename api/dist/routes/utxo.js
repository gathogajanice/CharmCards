"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const router = (0, express_1.Router)();
const NETWORK = process.env.BITCOIN_NETWORK || 'testnet4';
const MEMEPOOL_BASE_URL = NETWORK === 'testnet4'
    ? 'https://memepool.space/testnet4'
    : 'https://memepool.space';
/**
 * GET /api/utxo/:address
 * Proxy UTXO fetching from memepool.space to bypass CORS
 * Includes retry logic for better reliability on testnet4
 */
router.get('/:address', async (req, res) => {
    try {
        const { address } = req.params;
        if (!address) {
            return res.status(400).json({ error: 'Address is required' });
        }
        // Fetch UTXOs from memepool.space API with retry logic
        const utxoUrl = `${MEMEPOOL_BASE_URL}/api/address/${address}/utxo`;
        const maxRetries = 3;
        const timeout = NETWORK === 'testnet4' ? 20000 : 10000; // 20s for testnet4, 10s for others
        console.log(`Fetching UTXOs for address ${address} from ${utxoUrl} (network: ${NETWORK})`);
        let lastError = null;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    const delay = 2000 * attempt; // 2s, 4s delays
                    console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                const response = await axios_1.default.get(utxoUrl, {
                    timeout,
                    validateStatus: (status) => status < 500, // Don't throw on 4xx errors
                });
                if (response.status === 200 && response.data && Array.isArray(response.data)) {
                    // Map to consistent format
                    const utxos = response.data.map((utxo) => ({
                        txid: utxo.txid || utxo.tx_hash,
                        vout: utxo.vout !== undefined ? utxo.vout : (utxo.index !== undefined ? utxo.index : 0),
                        value: utxo.value || utxo.amount || 0,
                    }));
                    console.log(`✅ Fetched ${utxos.length} UTXOs for address ${address}${attempt > 0 ? ` (on retry ${attempt})` : ''}`);
                    return res.json(utxos);
                }
                else if (response.status === 404) {
                    // Address not found or no UTXOs - return empty array (not an error)
                    console.log(`Address ${address} has no UTXOs (404)`);
                    return res.json([]);
                }
                else {
                    // Other 4xx errors - log and retry if not last attempt
                    console.warn(`UTXO fetch returned status ${response.status} on attempt ${attempt + 1}`);
                    lastError = { status: response.status, data: response.data };
                    if (attempt < maxRetries - 1) {
                        continue; // Retry
                    }
                }
            }
            catch (error) {
                lastError = error;
                console.warn(`UTXO fetch attempt ${attempt + 1} failed:`, error.message);
                // If it's a network error and not the last attempt, retry
                if (attempt < maxRetries - 1 && (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || !error.response)) {
                    continue; // Retry
                }
                // If it's the last attempt or a non-retryable error, break
                break;
            }
        }
        // All retries failed
        console.error(`Failed to fetch UTXOs after ${maxRetries} attempts for address ${address}`);
        if (lastError?.response) {
            return res.status(lastError.response.status).json({
                error: lastError.response.data?.error || 'Failed to fetch UTXOs',
                status: lastError.response.status,
                details: lastError.response.data,
            });
        }
        return res.status(500).json({
            error: 'Failed to fetch UTXOs from memepool.space after retries',
            message: lastError?.message || 'Unknown error',
            network: NETWORK,
        });
    }
    catch (error) {
        console.error('Unexpected error fetching UTXOs:', error.message);
        return res.status(500).json({
            error: 'Unexpected error fetching UTXOs',
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
router.get('/tx/:txid/hex', async (req, res) => {
    try {
        const { txid } = req.params;
        if (!txid) {
            return res.status(400).json({ error: 'Transaction ID is required' });
        }
        const txHexUrl = `${MEMEPOOL_BASE_URL}/api/tx/${txid}/hex`;
        console.log(`Fetching transaction hex for ${txid} from ${txHexUrl}`);
        const response = await axios_1.default.get(txHexUrl, {
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
    }
    catch (error) {
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
router.get('/tx/:txid', async (req, res) => {
    try {
        const { txid } = req.params;
        if (!txid) {
            return res.status(400).json({ error: 'Transaction ID is required' });
        }
        const txUrl = `${MEMEPOOL_BASE_URL}/api/tx/${txid}`;
        const response = await axios_1.default.get(txUrl, {
            timeout: 10000,
        });
        return res.json(response.data);
    }
    catch (error) {
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
exports.default = router;
