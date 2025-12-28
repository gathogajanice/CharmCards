"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
// Blockstream API for broadcasting (may require auth for mainnet, testnet might work without)
// Note: Blockstream may only support testnet3, not testnet4
const BLOCKSTREAM_BASE_URL = NETWORK === 'testnet4'
    ? 'https://blockstream.info/testnet/api' // Try testnet endpoint (may need testnet3)
    : 'https://blockstream.info/api';
// CryptoAPIs for broadcasting (requires API key)
// Supports testnet (may work for testnet4 if they treat it as testnet)
// Read API key dynamically to ensure it's available after dotenv.config() runs
const getCryptoApisApiKey = () => {
    return process.env.CRYPTOAPIS_API_KEY?.trim();
};
// CryptoAPIs base URL - try both v2 and non-v2 formats
const CRYPTOAPIS_BASE_URL_V2 = 'https://rest.cryptoapis.io/v2/broadcast-transactions';
const CRYPTOAPIS_BASE_URL = 'https://rest.cryptoapis.io/broadcast-transactions';
// Network mapping: testnet4 → testnet, testnet → testnet, mainnet → mainnet
const getCryptoApisNetwork = (network) => {
    if (network === 'testnet4' || network === 'testnet' || network === 'testnet3') {
        return 'testnet';
    }
    return 'mainnet';
};
/**
 * Check if a transaction is in the mempool
 */
async function checkTransactionInMempool(txid) {
    try {
        const txUrl = `${MEMEPOOL_BASE_URL}/api/tx/${txid}`;
        const response = await axios_1.default.get(txUrl, {
            timeout: 10000,
            validateStatus: (status) => status < 500,
        });
        return response.status === 200;
    }
    catch (error) {
        return false;
    }
}
/**
 * Wait for a transaction to be accepted into mempool
 */
async function waitForMempoolAcceptance(txid, timeoutMs = 30000, pollIntervalMs = 1000) {
    const startTime = Date.now();
    let attempt = 0;
    while (Date.now() - startTime < timeoutMs) {
        attempt++;
        const inMempool = await checkTransactionInMempool(txid);
        if (inMempool) {
            const elapsed = Date.now() - startTime;
            console.log(`✅ Transaction ${txid} accepted into mempool after ${elapsed}ms (attempt ${attempt})`);
            return true;
        }
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
    console.warn(`⚠️ Transaction ${txid} not accepted into mempool within ${timeoutMs}ms (${attempt} attempts)`);
    return false;
}
/**
 * POST /api/broadcast/tx
 * Broadcast a single transaction to Bitcoin network
 * Tries CryptoAPIs first (if API key available), then Blockstream as fallback
 *
 * Request body: transaction hex (plain text)
 * Response: transaction ID (plain text)
 */
router.post('/tx', async (req, res) => {
    try {
        // Get transaction hex from request body
        // Can be sent as plain text or JSON with 'tx' field
        let txHex;
        if (typeof req.body === 'string') {
            txHex = req.body.trim();
        }
        else if (req.body && typeof req.body === 'object' && req.body.tx) {
            txHex = typeof req.body.tx === 'string' ? req.body.tx.trim() : String(req.body.tx).trim();
        }
        else {
            return res.status(400).json({ error: 'Transaction hex is required in request body' });
        }
        if (!txHex || txHex.length === 0) {
            return res.status(400).json({ error: 'Transaction hex cannot be empty' });
        }
        // Validate hex format
        if (!/^[0-9a-fA-F]+$/.test(txHex)) {
            return res.status(400).json({ error: 'Invalid transaction hex format' });
        }
        // Parse transaction to extract input UTXOs for debugging
        // This helps identify "orphaned transaction" errors (missing UTXO references)
        let inputUtxos = [];
        try {
            const bitcoin = await Promise.resolve().then(() => __importStar(require('bitcoinjs-lib')));
            const network = NETWORK === 'testnet4' || NETWORK === 'testnet'
                ? { messagePrefix: '\x18Bitcoin Signed Message:\n', bech32: 'tb', bip32: { public: 0x043587cf, private: 0x04358394 }, pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef }
                : bitcoin.networks.bitcoin;
            const tx = bitcoin.Transaction.fromHex(txHex);
            console.log(`📋 Transaction details: ${tx.ins.length} input(s), ${tx.outs.length} output(s)`);
            // Log input UTXOs for debugging orphaned transaction errors
            for (let i = 0; i < tx.ins.length; i++) {
                const input = tx.ins[i];
                const hashBuffer = Buffer.from(input.hash);
                const txid = hashBuffer.reverse().toString('hex');
                const vout = input.index;
                const utxo = `${txid}:${vout}`;
                inputUtxos.push(utxo);
                console.log(`   Input ${i}: ${utxo}`);
            }
        }
        catch (parseError) {
            console.warn(`⚠️ Could not parse transaction for validation: ${parseError.message}`);
            // Continue anyway - the broadcaster will validate
        }
        // memepool.space doesn't support broadcasting (read-only explorer)
        // Try CryptoAPIs first (if API key available), then Blockstream as fallback
        console.log(`📤 Broadcasting transaction (${txHex.length} bytes, network: ${NETWORK})...`);
        let broadcastUrl;
        let broadcastService;
        let lastError = null;
        // Try CryptoAPIs first (if API key is available) - good for testnet4
        const cryptoApisApiKey = getCryptoApisApiKey();
        if (cryptoApisApiKey) {
            const cryptoApisNetwork = getCryptoApisNetwork(NETWORK);
            // Try testnet4 directly first, then fallback to testnet
            const networksToTry = NETWORK === 'testnet4' ? ['testnet4', 'testnet'] : [cryptoApisNetwork];
            let cryptoApisSuccess = false;
            for (const network of networksToTry) {
                // Try both v2 and non-v2 base URLs
                const baseUrls = [CRYPTOAPIS_BASE_URL_V2, CRYPTOAPIS_BASE_URL];
                for (const baseUrl of baseUrls) {
                    broadcastUrl = `${baseUrl}/bitcoin/${network}`;
                    broadcastService = `CryptoAPIs (${network})`;
                    console.log(`📤 Attempting broadcast via ${broadcastService}: ${broadcastUrl}`);
                    try {
                        const response = await axios_1.default.post(broadcastUrl, {
                            context: 'charm-cards-broadcast',
                            data: {
                                item: {
                                    transactionHex: txHex
                                }
                            }
                        }, {
                            timeout: 60000, // 60 second timeout
                            headers: {
                                'Content-Type': 'application/json',
                                'X-API-Key': cryptoApisApiKey,
                            },
                            validateStatus: (status) => status < 500,
                        });
                        if (response.status >= 200 && response.status < 300) {
                            // CryptoAPIs returns JSON with transactionId in data.item.transactionId
                            // Response structure: { data: { item: { transactionId: "..." } } }
                            const txid = response.data?.data?.item?.transactionId ||
                                response.data?.data?.transactionId ||
                                response.data?.item?.transactionId ||
                                (typeof response.data === 'string' ? response.data.trim() : String(response.data).trim());
                            if (txid && txid.length > 0) {
                                console.log(`✅ Transaction broadcast successfully via ${broadcastService}: ${txid}`);
                                res.setHeader('Content-Type', 'text/plain');
                                return res.send(txid);
                            }
                            else {
                                console.error('❌ CryptoAPIs response structure:', JSON.stringify(response.data, null, 2));
                                throw new Error('CryptoAPIs returned success but no transaction ID in response');
                            }
                        }
                        else {
                            // CryptoAPIs returned error status - try next URL/network
                            const errorMsg = typeof response.data === 'string'
                                ? response.data
                                : response.data?.error?.message || response.data?.message ||
                                    response.data?.error || `Broadcast failed with status ${response.status}`;
                            console.warn(`⚠️ ${broadcastService} broadcast failed (${response.status}): ${errorMsg}`);
                            // Continue to next URL/network combination
                            continue;
                        }
                    }
                    catch (cryptoApisError) {
                        // Log error but continue to next URL/network combination
                        if (cryptoApisError.response) {
                            const errorMsg = typeof cryptoApisError.response.data === 'string'
                                ? cryptoApisError.response.data
                                : cryptoApisError.response.data?.error?.message || cryptoApisError.response.data?.message ||
                                    cryptoApisError.response.data?.error || `Error ${cryptoApisError.response.status}`;
                            console.warn(`⚠️ ${broadcastService} failed: ${errorMsg}`);
                        }
                        else {
                            console.warn(`⚠️ ${broadcastService} failed: ${cryptoApisError.message || 'Network error'}`);
                        }
                        // Continue to next URL/network combination
                        continue;
                    }
                }
            }
            // If we get here, all CryptoAPIs attempts failed
            if (lastError) {
                console.warn(`⚠️ All CryptoAPIs attempts failed, last error: ${lastError}`);
            }
        }
        else {
            console.log('ℹ️ CryptoAPIs API key not configured, skipping CryptoAPIs broadcast');
        }
        // Try Blockstream (may work without auth for testnet)
        broadcastUrl = `${BLOCKSTREAM_BASE_URL}/tx`;
        broadcastService = 'Blockstream';
        console.log(`📤 Attempting broadcast via ${broadcastService}: ${broadcastUrl}`);
        try {
            const response = await axios_1.default.post(broadcastUrl, txHex, {
                timeout: 60000, // Increased to 60 seconds
                headers: {
                    'Content-Type': 'text/plain',
                },
                validateStatus: (status) => status < 500, // Don't throw on 4xx errors
            });
            if (response.status >= 200 && response.status < 300) {
                const txid = typeof response.data === 'string'
                    ? response.data.trim()
                    : String(response.data).trim();
                console.log(`✅ Transaction broadcast successfully via ${broadcastService}: ${txid}`);
                res.setHeader('Content-Type', 'text/plain');
                return res.send(txid);
            }
            else {
                // Blockstream returned error status
                const errorMsg = typeof response.data === 'string'
                    ? response.data
                    : response.data?.error || `Broadcast failed with status ${response.status}`;
                lastError = `${broadcastService}: ${errorMsg}`;
                console.warn(`⚠️ ${broadcastService} broadcast failed (${response.status}): ${errorMsg}`);
            }
        }
        catch (blockstreamError) {
            // Log detailed error information
            console.error(`❌ ${broadcastService} broadcast error:`);
            console.error('   Error type:', blockstreamError.constructor?.name || typeof blockstreamError);
            console.error('   Error message:', blockstreamError.message || 'No error message');
            console.error('   Error code:', blockstreamError.code || 'No error code');
            if (blockstreamError.response) {
                console.error('   Response status:', blockstreamError.response.status);
                console.error('   Response headers:', JSON.stringify(blockstreamError.response.headers));
                console.error('   Response data type:', typeof blockstreamError.response.data);
                console.error('   Response data:', blockstreamError.response.data);
                // Try to extract meaningful error message
                let errorMsg = 'Unknown error';
                if (typeof blockstreamError.response.data === 'string') {
                    errorMsg = blockstreamError.response.data;
                }
                else if (blockstreamError.response.data?.error) {
                    errorMsg = blockstreamError.response.data.error;
                }
                else if (blockstreamError.response.data?.message) {
                    errorMsg = blockstreamError.response.data.message;
                }
                else if (blockstreamError.response.data) {
                    errorMsg = JSON.stringify(blockstreamError.response.data);
                }
                lastError = `${broadcastService}: ${errorMsg}`;
            }
            else {
                lastError = `${broadcastService}: ${blockstreamError.message || blockstreamError.code || 'Network error'}`;
            }
            console.error('   Request URL:', broadcastUrl);
            console.error('   Transaction hex length:', txHex.length);
            console.error('   Transaction hex (first 200 chars):', txHex.substring(0, 200));
            if (inputUtxos.length > 0) {
                console.error('   Input UTXOs being spent:', inputUtxos.join(', '));
                console.error('   ⚠️ If transaction is "orphaned", check if these UTXOs exist and are unspent');
            }
        }
        // All broadcasting services failed
        let finalErrorMessage = `All broadcasting endpoints failed. ${lastError || 'Unknown error'}`;
        if (inputUtxos.length > 0) {
            finalErrorMessage += ` Input UTXOs: ${inputUtxos.join(', ')}. If transaction is "orphaned", the UTXO may not exist or may have been spent.`;
        }
        const finalError = new Error(finalErrorMessage);
        throw finalError;
    }
    catch (error) {
        // Comprehensive error logging
        console.error('❌ Error broadcasting transaction');
        console.error('   Error type:', error.constructor?.name || typeof error);
        console.error('   Error message:', error.message || 'No error message');
        console.error('   Error code:', error.code || 'No error code');
        console.error('   Error stack:', error.stack || 'No stack trace');
        if (typeof txHex !== 'undefined') {
            console.error('   Transaction hex length:', txHex.length);
        }
        if (error.response) {
            console.error('   Response status:', error.response.status);
            console.error('   Response headers:', error.response.headers);
            console.error('   Response data:', error.response.data);
            const errorMessage = typeof error.response.data === 'string'
                ? error.response.data
                : error.response.data?.error || error.response.data?.message || 'Failed to broadcast transaction';
            return res.status(error.response.status).json({
                error: errorMessage,
                status: error.response.status,
                details: error.response.data,
            });
        }
        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({
                error: 'Failed to connect to broadcasting service. The service may be unavailable.',
                message: error.message,
            });
        }
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            return res.status(504).json({
                error: 'Broadcast request timed out. Please try again.',
                message: error.message,
            });
        }
        // Extract error message from various possible formats
        let errorMsg = 'Unknown error';
        if (error.message) {
            errorMsg = error.message;
        }
        else if (typeof error === 'string') {
            errorMsg = error;
        }
        else if (error.toString && error.toString() !== '[object Object]') {
            errorMsg = error.toString();
        }
        else {
            errorMsg = JSON.stringify(error);
        }
        return res.status(500).json({
            error: `Failed to broadcast transaction: ${errorMsg}`,
            errorType: error.constructor?.name || typeof error,
            errorCode: error.code,
            fullError: error.toString ? error.toString() : String(error),
        });
    }
});
/**
 * POST /api/broadcast/package
 * Broadcast commit and spell transactions as a package
 * Based on: https://docs.charms.dev/guides/wallet-integration/transactions/broadcasting/
 *
 * Request body: { commitTx: string, spellTx: string }
 * Response: { commitTxid: string, spellTxid: string }
 */
router.post('/package', async (req, res) => {
    try {
        const { commitTx, spellTx } = req.body;
        if (!commitTx || typeof commitTx !== 'string') {
            return res.status(400).json({ error: 'commitTx (commit transaction hex) is required' });
        }
        if (!spellTx || typeof spellTx !== 'string') {
            return res.status(400).json({ error: 'spellTx (spell transaction hex) is required' });
        }
        const commitTxHex = commitTx.trim();
        const spellTxHex = spellTx.trim();
        // Validate hex formats
        if (!/^[0-9a-fA-F]+$/.test(commitTxHex)) {
            return res.status(400).json({ error: 'Invalid commitTx hex format' });
        }
        if (!/^[0-9a-fA-F]+$/.test(spellTxHex)) {
            return res.status(400).json({ error: 'Invalid spellTx hex format' });
        }
        // memepool.space doesn't support broadcasting (read-only explorer)
        // Try CryptoAPIs first (if API key available), then Blockstream as fallback
        console.log(`📤 Broadcasting transaction package (network: ${NETWORK}, commit: ${commitTxHex.length} bytes, spell: ${spellTxHex.length} bytes)`);
        // Helper function to broadcast a single transaction with fallbacks
        const broadcastSingleTx = async (txHex, txName) => {
            let broadcastUrl;
            let broadcastService;
            let lastError = null;
            // Try CryptoAPIs first (if API key is available) - good for testnet4
            const cryptoApisApiKey = getCryptoApisApiKey();
            if (cryptoApisApiKey) {
                // Try testnet4 directly first, then fallback to testnet
                const networksToTry = NETWORK === 'testnet4' ? ['testnet4', 'testnet'] : [getCryptoApisNetwork(NETWORK)];
                let cryptoApisSuccess = false;
                for (const network of networksToTry) {
                    // Try both v2 and non-v2 base URLs
                    const baseUrls = [CRYPTOAPIS_BASE_URL_V2, CRYPTOAPIS_BASE_URL];
                    for (const baseUrl of baseUrls) {
                        broadcastUrl = `${baseUrl}/bitcoin/${network}`;
                        broadcastService = `CryptoAPIs (${network})`;
                        console.log(`📤 Attempting ${txName} broadcast via ${broadcastService}: ${broadcastUrl}`);
                        try {
                            const response = await axios_1.default.post(broadcastUrl, {
                                context: 'charm-cards-broadcast',
                                data: {
                                    item: {
                                        transactionHex: txHex
                                    }
                                }
                            }, {
                                timeout: 60000, // 60 second timeout
                                headers: {
                                    'Content-Type': 'application/json',
                                    'X-API-Key': cryptoApisApiKey,
                                },
                                validateStatus: (status) => status < 500,
                            });
                            if (response.status >= 200 && response.status < 300) {
                                // CryptoAPIs returns JSON with transactionId in data.item.transactionId
                                const txid = response.data?.data?.item?.transactionId ||
                                    response.data?.data?.transactionId ||
                                    response.data?.item?.transactionId ||
                                    (typeof response.data === 'string' ? response.data.trim() : String(response.data).trim());
                                if (txid && txid.length > 0) {
                                    console.log(`✅ ${txName} broadcast successfully via ${broadcastService}: ${txid}`);
                                    return txid;
                                }
                                else {
                                    console.error(`❌ CryptoAPIs ${txName} response structure:`, JSON.stringify(response.data, null, 2));
                                    throw new Error('CryptoAPIs returned success but no transaction ID in response');
                                }
                            }
                            else {
                                // Try next URL/network combination
                                const errorMsg = typeof response.data === 'string'
                                    ? response.data
                                    : response.data?.error?.message || response.data?.message ||
                                        response.data?.error || `Broadcast failed with status ${response.status}`;
                                console.warn(`⚠️ ${broadcastService} ${txName} failed (${response.status}): ${errorMsg}`);
                                continue;
                            }
                        }
                        catch (cryptoApisError) {
                            // Log error but continue to next URL/network combination
                            if (cryptoApisError.response) {
                                const errorMsg = typeof cryptoApisError.response.data === 'string'
                                    ? cryptoApisError.response.data
                                    : cryptoApisError.response.data?.error?.message || cryptoApisError.response.data?.message ||
                                        cryptoApisError.response.data?.error || `Error ${cryptoApisError.response.status}`;
                                console.warn(`⚠️ ${broadcastService} ${txName} failed: ${errorMsg}`);
                            }
                            else {
                                console.warn(`⚠️ ${broadcastService} ${txName} failed: ${cryptoApisError.message || 'Network error'}`);
                            }
                            continue;
                        }
                    }
                }
                // If we get here, all CryptoAPIs attempts failed
                if (!lastError) {
                    lastError = 'CryptoAPIs: All endpoint attempts failed';
                }
                console.warn(`⚠️ All CryptoAPIs attempts failed for ${txName}, trying Blockstream...`);
            }
            else {
                console.log(`ℹ️ CryptoAPIs API key not configured, skipping CryptoAPIs broadcast for ${txName}`);
            }
            // Try Blockstream
            broadcastUrl = `${BLOCKSTREAM_BASE_URL}/tx`;
            broadcastService = 'Blockstream';
            console.log(`📤 Attempting ${txName} broadcast via ${broadcastService}: ${broadcastUrl}`);
            try {
                const response = await axios_1.default.post(broadcastUrl, txHex, {
                    timeout: 60000, // 60 second timeout
                    headers: {
                        'Content-Type': 'text/plain',
                    },
                    validateStatus: (status) => status < 500,
                });
                if (response.status >= 200 && response.status < 300) {
                    const txid = typeof response.data === 'string'
                        ? response.data.trim()
                        : String(response.data).trim();
                    console.log(`✅ ${txName} broadcast successfully via ${broadcastService}: ${txid}`);
                    return txid;
                }
                else {
                    const errorMsg = typeof response.data === 'string'
                        ? response.data
                        : response.data?.error || `Broadcast failed with status ${response.status}`;
                    lastError = `${broadcastService}: ${errorMsg}`;
                    console.warn(`⚠️ ${broadcastService} ${txName} broadcast failed (${response.status}): ${errorMsg}`);
                }
            }
            catch (blockstreamError) {
                console.error(`❌ ${broadcastService} ${txName} broadcast error:`);
                console.error('   Error type:', blockstreamError.constructor?.name || typeof blockstreamError);
                console.error('   Error message:', blockstreamError.message || 'No error message');
                console.error('   Error code:', blockstreamError.code || 'No error code');
                if (blockstreamError.response) {
                    console.error('   Response status:', blockstreamError.response.status);
                    console.error('   Response data:', blockstreamError.response.data);
                }
                console.error('   Request URL:', broadcastUrl);
                console.error('   Transaction hex length:', txHex.length);
                lastError = `${broadcastService}: ${blockstreamError.message || blockstreamError.code || 'Network error'}`;
            }
            // All broadcasting services failed
            if (!lastError) {
                lastError = 'No broadcasting service available';
            }
            throw new Error(`All broadcasting endpoints failed for ${txName}. ${lastError}`);
        };
        // Step 1: Broadcast commit transaction first
        // The commit transaction creates the Taproot output that the spell transaction spends
        let commitTxid;
        try {
            commitTxid = await broadcastSingleTx(commitTxHex, 'commit transaction');
        }
        catch (commitError) {
            // Comprehensive error logging
            console.error('❌ Commit transaction broadcast failed');
            console.error('   Error type:', commitError.constructor?.name || typeof commitError);
            console.error('   Error message:', commitError.message || 'No error message');
            console.error('   Error code:', commitError.code || 'No error code');
            console.error('   Error stack:', commitError.stack || 'No stack trace');
            if (commitError.response) {
                console.error('   Response status:', commitError.response.status);
                console.error('   Response headers:', commitError.response.headers);
                console.error('   Response data:', commitError.response.data);
                const errorMessage = typeof commitError.response.data === 'string'
                    ? commitError.response.data
                    : commitError.response.data?.error || commitError.response.data?.message || 'Failed to broadcast commit transaction';
                return res.status(commitError.response.status).json({
                    error: `Commit transaction broadcast failed: ${errorMessage}`,
                    status: commitError.response.status,
                    details: commitError.response.data,
                });
            }
            // Network or other errors
            if (commitError.code === 'ECONNREFUSED') {
                return res.status(503).json({
                    error: 'Failed to connect to broadcasting service. The service may be unavailable.',
                    message: commitError.message,
                });
            }
            if (commitError.code === 'ECONNABORTED' || commitError.message?.includes('timeout')) {
                return res.status(504).json({
                    error: 'Broadcast request timed out. Please try again.',
                    message: commitError.message,
                });
            }
            // Extract error message from various possible formats
            let errorMsg = 'Unknown error';
            if (commitError.message) {
                errorMsg = commitError.message;
            }
            else if (typeof commitError === 'string') {
                errorMsg = commitError;
            }
            else if (commitError.toString && commitError.toString() !== '[object Object]') {
                errorMsg = commitError.toString();
            }
            else {
                errorMsg = JSON.stringify(commitError);
            }
            return res.status(500).json({
                error: `Failed to broadcast commit transaction: ${errorMsg}`,
                errorType: commitError.constructor?.name || typeof commitError,
                errorCode: commitError.code,
                fullError: commitError.toString ? commitError.toString() : String(commitError),
            });
        }
        // Step 2: Wait for commit transaction to be accepted into mempool
        // Per Charms docs: "The commit transaction must be in mempool before the spell transaction can be accepted"
        // This ensures the spell transaction can properly reference the commit transaction's output
        console.log('⏳ Waiting for commit transaction to be accepted into mempool...');
        const commitAccepted = await waitForMempoolAcceptance(commitTxid, 30000, 1000);
        if (!commitAccepted) {
            console.warn(`⚠️ Warning: Commit transaction ${commitTxid} was not accepted into mempool within timeout`);
            console.warn('⚠️ Proceeding with spell broadcast anyway - it may fail if commit is not in mempool');
            // Continue anyway - the spell broadcast will fail if commit is not in mempool
            // This gives the user visibility into what happened
        }
        else {
            console.log(`✅ Commit transaction ${commitTxid} confirmed in mempool - safe to broadcast spell transaction`);
        }
        // Step 3: Broadcast spell transaction
        // Now that commit transaction is broadcast, we can broadcast the spell transaction
        let spellTxid;
        try {
            spellTxid = await broadcastSingleTx(spellTxHex, 'spell transaction');
        }
        catch (spellError) {
            // Comprehensive error logging
            console.error('❌ Spell transaction broadcast failed');
            console.error('   Error type:', spellError.constructor?.name || typeof spellError);
            console.error('   Error message:', spellError.message || 'No error message');
            console.error('   Error code:', spellError.code || 'No error code');
            console.error('   Error stack:', spellError.stack || 'No stack trace');
            console.error('   Commit txid (already broadcast):', commitTxid);
            // Even if spell broadcast fails, we return the commit txid so the user knows what happened
            if (spellError.response) {
                console.error('   Response status:', spellError.response.status);
                console.error('   Response headers:', spellError.response.headers);
                console.error('   Response data:', spellError.response.data);
                const errorMessage = typeof spellError.response.data === 'string'
                    ? spellError.response.data
                    : spellError.response.data?.error || spellError.response.data?.message || 'Failed to broadcast spell transaction';
                return res.status(spellError.response.status).json({
                    error: `Spell transaction broadcast failed: ${errorMessage}`,
                    commitTxid, // Return commit txid even if spell failed
                    status: spellError.response.status,
                    details: spellError.response.data,
                });
            }
            // Network or other errors
            if (spellError.code === 'ECONNREFUSED') {
                return res.status(503).json({
                    error: 'Failed to connect to broadcasting service. The service may be unavailable.',
                    message: spellError.message,
                    commitTxid, // Return commit txid even if spell failed
                });
            }
            if (spellError.code === 'ECONNABORTED' || spellError.message?.includes('timeout')) {
                return res.status(504).json({
                    error: 'Broadcast request timed out. Please try again.',
                    message: spellError.message,
                    commitTxid, // Return commit txid even if spell failed
                });
            }
            // Extract error message from various possible formats
            let errorMsg = 'Unknown error';
            if (spellError.message) {
                errorMsg = spellError.message;
            }
            else if (typeof spellError === 'string') {
                errorMsg = spellError;
            }
            else if (spellError.toString && spellError.toString() !== '[object Object]') {
                errorMsg = spellError.toString();
            }
            else {
                errorMsg = JSON.stringify(spellError);
            }
            return res.status(500).json({
                error: `Failed to broadcast spell transaction: ${errorMsg}`,
                errorType: spellError.constructor?.name || typeof spellError,
                errorCode: spellError.code,
                fullError: spellError.toString ? spellError.toString() : String(spellError),
                commitTxid, // Return commit txid even if spell failed
            });
        }
        // Step 4: Return both transaction IDs
        console.log(`✅ Package broadcast successful: commit=${commitTxid}, spell=${spellTxid}`);
        return res.json({
            commitTxid,
            spellTxid,
        });
    }
    catch (error) {
        // Comprehensive error logging for outer catch block
        console.error('❌ Error broadcasting transaction package');
        console.error('   Error type:', error.constructor?.name || typeof error);
        console.error('   Error message:', error.message || 'No error message');
        console.error('   Error code:', error.code || 'No error code');
        console.error('   Error stack:', error.stack || 'No stack trace');
        if (error.response) {
            console.error('   Response status:', error.response.status);
            console.error('   Response headers:', error.response.headers);
            console.error('   Response data:', error.response.data);
            return res.status(error.response.status).json({
                error: error.response.data?.error || error.response.data?.message || 'Failed to broadcast transaction package',
                status: error.response.status,
                details: error.response.data,
            });
        }
        // Network or other errors
        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({
                error: 'Failed to connect to broadcasting service. The service may be unavailable.',
                message: error.message,
            });
        }
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            return res.status(504).json({
                error: 'Broadcast request timed out. Please try again.',
                message: error.message,
            });
        }
        // Extract error message from various possible formats
        let errorMsg = 'Unknown error';
        if (error.message) {
            errorMsg = error.message;
        }
        else if (typeof error === 'string') {
            errorMsg = error;
        }
        else if (error.toString && error.toString() !== '[object Object]') {
            errorMsg = error.toString();
        }
        else {
            errorMsg = JSON.stringify(error);
        }
        return res.status(500).json({
            error: `Failed to broadcast transaction package: ${errorMsg}`,
            errorType: error.constructor?.name || typeof error,
            errorCode: error.code,
            fullError: error.toString ? error.toString() : String(error),
        });
    }
});
exports.default = router;
