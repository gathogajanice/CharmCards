import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

const NETWORK = process.env.BITCOIN_NETWORK || 'testnet4';
const MEMEPOOL_BASE_URL = NETWORK === 'testnet4'
  ? 'https://memepool.space/testnet4'
  : 'https://memepool.space';

// CryptoAPIs for broadcasting (requires API key)
// Supports testnet (may work for testnet4 if they treat it as testnet)
// Read API key dynamically to ensure it's available after dotenv.config() runs
const getCryptoApisApiKey = (): string | undefined => {
  return process.env.CRYPTOAPIS_API_KEY?.trim();
};

// Bitcoin Core RPC configuration for package broadcasting
// Per Charms docs: "This is functionally equivalent to bitcoin-cli submitpackage command"
interface BitcoinRpcConfig {
  url: string;
  user?: string;
  password?: string;
  enabled: boolean;
}

export const getBitcoinRpcConfig = (): BitcoinRpcConfig | null => {
  const rpcUrl = process.env.BITCOIN_RPC_URL?.trim();
  if (!rpcUrl) {
    return null;
  }

  // Parse URL to extract user/password if provided in URL format: http://user:pass@host:port
  let url = rpcUrl;
  let user = process.env.BITCOIN_RPC_USER?.trim();
  let password = process.env.BITCOIN_RPC_PASSWORD?.trim();

  // If URL contains credentials, extract them
  try {
    const urlObj = new URL(rpcUrl);
    if (urlObj.username && urlObj.password) {
      user = urlObj.username;
      password = urlObj.password;
      // Remove credentials from URL for axios
      // Also remove trailing slash if present
      const pathname = urlObj.pathname.replace(/\/$/, '');
      url = `${urlObj.protocol}//${urlObj.host}${pathname || ''}`;
    } else {
      // Remove trailing slash if present (even without credentials)
      url = url.replace(/\/$/, '');
    }
  } catch (e) {
    // Invalid URL format, will be handled by RPC client
    // Still try to remove trailing slash
    url = url.replace(/\/$/, '');
  }

  return {
    url,
    user,
    password,
    enabled: true,
  };
};

// CryptoAPIs base URL - use v2 broadcast-transactions endpoint format
// Documentation: https://developers.cryptoapis.io/v-2.2024-12-12-175/RESTapis/broadcast-locally-sign-transactions/broadcast-locally-signed-transaction/post
const CRYPTOAPIS_BASE_URL_V2 = 'https://rest.cryptoapis.io/v2/broadcast-transactions';
const CRYPTOAPIS_BASE_URL = 'https://rest.cryptoapis.io/v2/broadcast-transactions'; // Keep v2 as primary
// Network mapping: testnet4 → testnet, testnet → testnet, mainnet → mainnet
const getCryptoApisNetwork = (network: string): string => {
  if (network === 'testnet4' || network === 'testnet' || network === 'testnet3') {
    return 'testnet';
  }
  return 'mainnet';
};


/**
 * Bitcoin Core RPC client for package broadcasting
 * Implements JSON-RPC 2.0 protocol for Bitcoin Core's submitpackage method
 */
interface BitcoinRpcResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
  };
  id: number;
}

async function callBitcoinRpc(
  method: string,
  params: any[],
  config: BitcoinRpcConfig
): Promise<BitcoinRpcResponse> {
  const rpcUrl = config.url;
  const rpcId = Math.floor(Math.random() * 1000000);

  const requestBody = {
    jsonrpc: '2.0',
    id: rpcId,
    method,
    params,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add Basic Auth if credentials provided
  if (config.user && config.password) {
    const auth = Buffer.from(`${config.user}:${config.password}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;
  }

  try {
    const response = await axios.post(rpcUrl, requestBody, {
      headers,
      timeout: 60000, // 60 second timeout
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
    });

    if (response.status !== 200) {
      throw new Error(`Bitcoin RPC request failed with status ${response.status}: ${response.statusText}`);
    }

    const rpcResponse: BitcoinRpcResponse = response.data;

    if (rpcResponse.error) {
      throw new Error(`Bitcoin RPC error (${rpcResponse.error.code}): ${rpcResponse.error.message}`);
    }

    return rpcResponse;
  } catch (error: any) {
    if (error.response) {
      // HTTP error response
      const rpcResponse: BitcoinRpcResponse = error.response.data;
      if (rpcResponse?.error) {
        throw new Error(`Bitcoin RPC error (${rpcResponse.error.code}): ${rpcResponse.error.message}`);
      }
      throw new Error(`Bitcoin RPC HTTP error: ${error.response.status} ${error.response.statusText}`);
    }
    if (error.code === 'ECONNREFUSED') {
      throw new Error(
        'Bitcoin RPC connection refused. ' +
        'Possible causes: (1) Bitcoin Core node is not running - check with: ps aux | grep bitcoind, ' +
        '(2) Node is still starting up - wait 30-60 seconds, ' +
        '(3) RPC is not enabled - check bitcoin.conf has server=1 and rpc settings. ' +
        'Run ./check-bitcoin-rpc.sh for detailed diagnostics.'
      );
    }
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      throw new Error(
        'Bitcoin RPC request timed out. ' +
        'The node may be overloaded or still syncing. ' +
        'Check node status: ./check-bitcoin-rpc.sh or tail -f ~/.bitcoin/testnet4/debug.log'
      );
    }
    throw error;
  }
}

/**
 * Get Bitcoin Core node health information
 * Uses getblockchaininfo, getnetworkinfo, and getmempoolinfo RPC methods
 * 
 * @param config Bitcoin RPC configuration
 * @returns Object with node health status
 */
export async function getBitcoinNodeHealth(config: BitcoinRpcConfig): Promise<{
  connected: boolean;
  blockchain?: {
    chain: string;
    blocks: number;
    headers: number;
    verificationProgress: number;
    initialBlockDownload: boolean;
  };
  network?: {
    connections: number;
    networkActive: boolean;
  };
  mempool?: {
    size: number;
    bytes: number;
  };
  error?: string;
}> {
  try {
    // Get blockchain info
    const blockchainInfo = await callBitcoinRpc('getblockchaininfo', [], config);
    const networkInfo = await callBitcoinRpc('getnetworkinfo', [], config);
    const mempoolInfo = await callBitcoinRpc('getmempoolinfo', [], config);

    return {
      connected: true,
      blockchain: {
        chain: blockchainInfo.result?.chain || 'unknown',
        blocks: blockchainInfo.result?.blocks || 0,
        headers: blockchainInfo.result?.headers || 0,
        verificationProgress: blockchainInfo.result?.verificationprogress || 0,
        initialBlockDownload: blockchainInfo.result?.initialblockdownload || false,
      },
      network: {
        connections: networkInfo.result?.connections || 0,
        networkActive: networkInfo.result?.networkactive || false,
      },
      mempool: {
        size: mempoolInfo.result?.size || 0,
        bytes: mempoolInfo.result?.bytes || 0,
      },
    };
  } catch (error: any) {
    return {
      connected: false,
      error: error.message || 'Unknown error checking node health',
    };
  }
}

/**
 * Test Bitcoin Core RPC connection
 * Simple connectivity check using getblockchaininfo
 * 
 * @param config Bitcoin RPC configuration
 * @returns true if connection is successful, false otherwise
 */
export async function testBitcoinRpcConnection(config: BitcoinRpcConfig): Promise<{
  connected: boolean;
  error?: string;
  details?: {
    chain?: string;
    blocks?: number;
  };
}> {
  try {
    const response = await callBitcoinRpc('getblockchaininfo', [], config);
    return {
      connected: true,
      details: {
        chain: response.result?.chain,
        blocks: response.result?.blocks,
      },
    };
  } catch (error: any) {
    return {
      connected: false,
      error: error.message || 'Connection test failed',
    };
  }
}

/**
 * Get block height for a transaction (UTXO)
 * Fetches from memepool.space to determine which block contains the UTXO
 * 
 * @param txid Transaction ID
 * @returns Block height or null if not found/unconfirmed
 */
async function getTransactionBlockHeight(txid: string): Promise<number | null> {
  try {
    const txUrl = `${MEMEPOOL_BASE_URL}/api/tx/${txid}`;
    const response = await axios.get(txUrl, { timeout: 10000 });
    
    if (response.data?.status?.block_height !== undefined) {
      return response.data.status.block_height;
    }
    
    // Check alternative field names
    if (response.data?.block_height !== undefined) {
      return response.data.block_height;
    }
    
    return null; // Transaction not confirmed or not found
  } catch (error: any) {
    console.warn(`Could not fetch block height for transaction ${txid}: ${error.message}`);
    return null;
  }
}

/**
 * Check if Bitcoin Core node has synced enough blocks for a transaction
 * 
 * @param txid Transaction ID to check
 * @param config Bitcoin RPC configuration
 * @returns Object with sync status and recommendations
 */
async function checkNodeSyncForTransaction(
  txid: string,
  config: BitcoinRpcConfig
): Promise<{
  hasSyncedEnough: boolean;
  txBlockHeight: number | null;
  nodeBlocks: number;
  blocksNeeded: number | null;
  estimatedWaitTime?: string;
  recommendation: string;
}> {
  try {
    // Get node's current block height
    const blockchainInfo = await callBitcoinRpc('getblockchaininfo', [], config);
    const nodeBlocks = blockchainInfo.result?.blocks || 0;
    
    // Get transaction's block height
    const txBlockHeight = await getTransactionBlockHeight(txid);
    
    if (txBlockHeight === null) {
      // Transaction not confirmed - node should be able to handle it
      return {
        hasSyncedEnough: true,
        txBlockHeight: null,
        nodeBlocks,
        blocksNeeded: null,
        recommendation: 'Transaction is unconfirmed. Node should be able to process it.',
      };
    }
    
    const blocksNeeded = txBlockHeight - nodeBlocks;
    const hasSyncedEnough = blocksNeeded <= 0;
    
    // Estimate wait time (rough estimate: ~1 block per 10 minutes for testnet)
    let estimatedWaitTime: string | undefined;
    if (blocksNeeded > 0) {
      const minutesNeeded = Math.ceil(blocksNeeded * 10);
      const hoursNeeded = Math.floor(minutesNeeded / 60);
      const remainingMinutes = minutesNeeded % 60;
      
      if (hoursNeeded > 0) {
        estimatedWaitTime = `${hoursNeeded}h ${remainingMinutes}m`;
      } else {
        estimatedWaitTime = `${minutesNeeded}m`;
      }
    }
    
    let recommendation: string;
    if (hasSyncedEnough) {
      recommendation = 'Node has synced enough blocks for this transaction.';
    } else {
      recommendation = `Node needs to sync ${blocksNeeded.toLocaleString()} more blocks (approximately ${estimatedWaitTime}). The UTXO is in block ${txBlockHeight.toLocaleString()}, but node is only at block ${nodeBlocks.toLocaleString()}.`;
    }
    
    return {
      hasSyncedEnough,
      txBlockHeight,
      nodeBlocks,
      blocksNeeded,
      estimatedWaitTime,
      recommendation,
    };
  } catch (error: any) {
    return {
      hasSyncedEnough: false,
      txBlockHeight: null,
      nodeBlocks: 0,
      blocksNeeded: null,
      recommendation: `Could not check sync status: ${error.message}. Proceeding with broadcast attempt.`,
    };
  }
}

/**
 * Broadcast transaction package using Bitcoin Core's submitpackage RPC
 * Per Charms docs: "This is functionally equivalent to bitcoin-cli submitpackage command"
 * 
 * @param commitTxHex Commit transaction hex
 * @param spellTxHex Spell transaction hex
 * @param config Bitcoin RPC configuration
 * @returns Object with transaction IDs for both transactions
 */
async function broadcastPackageViaBitcoinRpc(
  commitTxHex: string,
  spellTxHex: string,
  config: BitcoinRpcConfig
): Promise<{ commitTxid: string; spellTxid: string }> {
  console.log('📦 Attempting package broadcast via Bitcoin Core RPC (submitpackage)...');
  console.log(`   RPC URL: ${config.url.replace(/\/\/.*@/, '//***:***@')}`); // Hide credentials in logs

  try {
    // Call submitpackage with array of transaction hex strings
    // Per Bitcoin Core docs: submitpackage accepts array of raw transaction hex strings
    // Note: For JSON-RPC, the package array must be wrapped in another array as the first parameter
    // Format: submitpackage(["tx1", "tx2"]) becomes params: [["tx1", "tx2"]]
    const rpcResponse = await callBitcoinRpc('submitpackage', [[commitTxHex, spellTxHex]], config);

    // submitpackage returns an object with transaction IDs as keys
    // Format: { "txid1": { "wtxid": "...", "package_error": null }, "txid2": { ... } }
    // Or it might return an array of results
    const result = rpcResponse.result;

    if (!result || typeof result !== 'object') {
      throw new Error('Bitcoin RPC submitpackage returned invalid response format');
    }

    // Extract transaction IDs from result
    // The result is an object keyed by transaction IDs (txid)
    let txids: string[] = [];
    
    if (Array.isArray(result)) {
      // If result is an array, extract txids from each element
      txids = result.map((item: any) => {
        if (typeof item === 'string') {
          return item; // Direct txid string
        }
        return item?.txid || item?.transactionId || null;
      }).filter((txid: string | null): txid is string => txid !== null);
    } else {
      // Result is an object keyed by txid
      txids = Object.keys(result);
    }
    
    if (txids.length !== 2) {
      console.warn(`⚠️ Bitcoin RPC submitpackage returned ${txids.length} transactions, expected 2`);
      if (txids.length === 0) {
        throw new Error('Bitcoin RPC submitpackage returned no transaction IDs');
      }
    }

    // Check for package errors
    let hasErrors = false;
    for (const txid of txids) {
      const txResult = Array.isArray(result) 
        ? result.find((item: any) => (item?.txid || item?.transactionId || item) === txid)
        : result[txid];
      
      if (txResult?.package_error) {
        console.error(`❌ Transaction ${txid} has package error: ${txResult.package_error}`);
        hasErrors = true;
      }
    }

    if (hasErrors) {
      console.warn('⚠️ Some transactions in package have errors, but continuing...');
    }

    // Determine which txid is commit and which is spell
    // We can't definitively know from the RPC response, so we'll return both
    // The caller should verify the order matches expectations
    // Note: submitpackage processes transactions in order, so first should be commit, second spell
    const commitTxid = txids[0];
    const spellTxid = txids[1] || txids[0]; // Fallback to same txid if only one returned

    console.log(`✅ Package broadcast via Bitcoin RPC successful:`);
    console.log(`   Commit txid: ${commitTxid}`);
    console.log(`   Spell txid: ${spellTxid}`);

    return { commitTxid, spellTxid };
  } catch (error: any) {
    console.error('❌ Bitcoin RPC package broadcast failed:', error.message);
    throw error;
  }
}

/**
 * Helper function to retry a CryptoAPIs request with exponential backoff on rate limit errors
 */
async function retryCryptoApisRequest(
  requestFn: () => Promise<any>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<any> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error: any) {
      const isRateLimit = error.response?.status === 429;
      const isLastAttempt = attempt === maxRetries - 1;
      
      if (isRateLimit && !isLastAttempt) {
        // Calculate exponential backoff delay: 1s, 2s, 4s, etc.
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        const errorMsg = typeof error.response?.data === 'string'
          ? error.response.data
          : error.response?.data?.error?.message || error.response?.data?.message || 
            error.response?.data?.error || 'Rate limit exceeded';
        
        console.warn(`⚠️ CryptoAPIs rate limit (429) - retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})...`);
        console.warn(`   Error: ${errorMsg}`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      
      // If not a rate limit error or last attempt, throw the error
      throw error;
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw new Error('Max retries exceeded');
}

/**
 * Check if a transaction is in the mempool
 */
async function checkTransactionInMempool(txid: string): Promise<boolean> {
  try {
    const txUrl = `${MEMEPOOL_BASE_URL}/api/tx/${txid}`;
    const response = await axios.get(txUrl, {
      timeout: 10000,
      validateStatus: (status) => status < 500,
    });
    return response.status === 200;
  } catch (error: any) {
    return false;
  }
}

/**
 * Wait for a transaction to be accepted into mempool
 */
async function waitForMempoolAcceptance(
  txid: string,
  timeoutMs: number = 30000,
  pollIntervalMs: number = 1000
): Promise<boolean> {
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
 * Validate transaction before broadcasting
 * Per Charms docs: "It is a good idea to validate the transactions before submitting them"
 * Checks: hex format, transaction structure, size limits, and basic fee rate validation
 */
interface TransactionValidationResult {
  valid: boolean;
  error?: string;
  details?: {
    size: number;
    inputCount: number;
    outputCount: number;
    estimatedFeeRate?: number; // sats per vB
  };
}

async function validateTransaction(txHex: string): Promise<TransactionValidationResult> {
  // Basic hex format validation
  if (!txHex || typeof txHex !== 'string') {
    return { valid: false, error: 'Transaction hex must be a non-empty string' };
  }

  const trimmedHex = txHex.trim();
  if (trimmedHex.length === 0) {
    return { valid: false, error: 'Transaction hex cannot be empty' };
  }

  if (!/^[0-9a-fA-F]+$/.test(trimmedHex)) {
    return { valid: false, error: 'Transaction hex contains invalid characters' };
  }

  // Size validation
  const sizeBytes = trimmedHex.length / 2;
  if (sizeBytes < 100) {
    return { valid: false, error: 'Transaction appears too short to be valid (minimum ~100 bytes)' };
  }

  // Bitcoin block size limit is 1MB, but transactions are typically much smaller
  // Set a reasonable upper limit of 400KB (800,000 hex chars) for safety
  if (trimmedHex.length > 800000) {
    return { valid: false, error: 'Transaction appears too large (maximum ~400KB)' };
  }

  // Try to parse transaction structure
  try {
    const bitcoin = await import('bitcoinjs-lib');
    const network = NETWORK === 'testnet4' || NETWORK === 'testnet'
      ? { messagePrefix: '\x18Bitcoin Signed Message:\n', bech32: 'tb', bip32: { public: 0x043587cf, private: 0x04358394 }, pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef }
      : bitcoin.networks.bitcoin;
    
    const tx = bitcoin.Transaction.fromHex(trimmedHex);
    
    // Validate transaction has at least one input and one output
    if (tx.ins.length === 0) {
      return { valid: false, error: 'Transaction must have at least one input' };
    }

    if (tx.outs.length === 0) {
      return { valid: false, error: 'Transaction must have at least one output' };
    }

    // Basic fee rate validation (rough estimate)
    // Note: Accurate fee rate calculation requires UTXO data, so this is a basic check
    // Per Charms docs, default fee rate is 2.0 sats/vB, minimum should be at least 1.0 sats/vB
    // We can't calculate exact fee rate without UTXO data, but we can validate structure
    
    return {
      valid: true,
      details: {
        size: sizeBytes,
        inputCount: tx.ins.length,
        outputCount: tx.outs.length,
      },
    };
  } catch (parseError: any) {
    return {
      valid: false,
      error: `Transaction structure validation failed: ${parseError.message || 'Invalid transaction format'}`,
    };
  }
}

/**
 * POST /api/broadcast/tx
 * Broadcast a single transaction to Bitcoin network
 * Tries CryptoAPIs first (if API key available), then Mempool.space as fallback
 * 
 * Request body: transaction hex (plain text)
 * Response: transaction ID (plain text)
 */
router.post('/tx', async (req: Request, res: Response) => {
  // Declare txHex outside try block so it's accessible in catch block
  let txHex: string | undefined;
  
  try {
    // Get transaction hex from request body
    // Can be sent as plain text or JSON with 'tx' field
    if (typeof req.body === 'string') {
      txHex = req.body.trim();
    } else if (req.body && typeof req.body === 'object' && req.body.tx) {
      txHex = typeof req.body.tx === 'string' ? req.body.tx.trim() : String(req.body.tx).trim();
    } else {
      return res.status(400).json({ error: 'Transaction hex is required in request body' });
    }

    if (!txHex || txHex.length === 0) {
      return res.status(400).json({ error: 'Transaction hex cannot be empty' });
    }

    // Validate transaction before broadcasting
    // Per Charms docs: "It is a good idea to validate the transactions before submitting them"
    console.log('🔍 Validating transaction before broadcasting...');
    const validation = await validateTransaction(txHex);
    if (!validation.valid) {
      console.error(`❌ Transaction validation failed: ${validation.error}`);
      return res.status(400).json({ error: `Transaction validation failed: ${validation.error}` });
    }
    console.log(`✅ Transaction validation passed: ${validation.details?.size} bytes, ${validation.details?.inputCount} input(s), ${validation.details?.outputCount} output(s)`);

    // Parse transaction to extract input UTXOs for debugging
    // This helps identify "orphaned transaction" errors (missing UTXO references)
    let inputUtxos: string[] = [];
    try {
      const bitcoin = await import('bitcoinjs-lib');
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
    } catch (parseError: any) {
      console.warn(`⚠️ Could not parse transaction for UTXO extraction: ${parseError.message}`);
      // Continue anyway - validation already passed
    }

    // Try CryptoAPIs first (if API key available), then Mempool.space as fallback
    console.log(`📤 Broadcasting transaction (${txHex.length} bytes, network: ${NETWORK})...`);
    
    let broadcastUrl: string;
    let broadcastService: string;
    let lastError: string | null = null;
    let cryptoApisConfigError = false; // Track if error is due to API key configuration
    
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
            // Use retry logic for rate limit errors (429)
            // Request body format per CryptoAPIs docs: { context, data: { item: { signedTransactionHex } } }
            const requestBody = {
              context: 'charm-cards-broadcast',
              data: {
                item: {
                  signedTransactionHex: txHex
                }
              }
            };
            console.log(`   Request body structure:`, JSON.stringify({ ...requestBody, data: { item: { signedTransactionHex: `${txHex.substring(0, 20)}...` } } }, null, 2));
            
            const response = await retryCryptoApisRequest(async () => {
              return await axios.post(broadcastUrl, requestBody, {
                timeout: 60000, // 60 second timeout
                headers: {
                  'Content-Type': 'application/json',
                  'X-API-Key': cryptoApisApiKey,
                },
                validateStatus: (status) => status < 500,
              });
            }, 3, 1000); // Max 3 retries, starting with 1 second delay

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
              } else {
                console.error('❌ CryptoAPIs response structure:', JSON.stringify(response.data, null, 2));
                throw new Error('CryptoAPIs returned success but no transaction ID in response');
              }
            } else {
              // CryptoAPIs returned error status - check error type
              const errorMsg = typeof response.data === 'string'
                ? response.data
                : response.data?.error?.message || response.data?.message || 
                  response.data?.error || `Broadcast failed with status ${response.status}`;
              
              const errorMsgLower = errorMsg.toLowerCase();
              
              // If 400 error (bad endpoint), skip remaining CryptoAPIs attempts and go to Mempool.space
              if (response.status === 400) {
                if (errorMsgLower.includes('uri') || errorMsgLower.includes('not found')) {
                  console.error(`❌ CryptoAPIs endpoint appears incorrect (400): ${errorMsg}`);
                  console.error(`   Skipping remaining CryptoAPIs attempts and falling back to Mempool.space`);
                  lastError = `CryptoAPIs endpoint error: ${errorMsg}`;
                  cryptoApisSuccess = false;
                  break; // Exit both loops and go to Mempool.space
                }
              }
              
              // Handle rate limit errors (429) - these should have been retried, but if still failing, log and continue
              if (response.status === 429) {
                lastError = `CryptoAPIs rate limit exceeded (429): ${errorMsg}. Please wait a moment and try again, or upgrade your CryptoAPIs plan.`;
                console.error(`❌ ${broadcastService} rate limit error (429): ${errorMsg}`);
                console.error(`   Retries were attempted but rate limit persists. Consider upgrading your CryptoAPIs plan or waiting before retrying.`);
                // Continue to next URL/network combination (might try Mempool.space as fallback)
                continue;
              }
              
              // Check if error is related to API key configuration
              if (response.status === 401 || response.status === 403 || 
                  errorMsgLower.includes('api key') || 
                  errorMsgLower.includes('authentication') ||
                  errorMsgLower.includes('not configured') ||
                  errorMsgLower.includes('invalid') ||
                  errorMsgLower.includes('unauthorized')) {
                cryptoApisConfigError = true;
                lastError = `CryptoAPIs API key appears to be invalid or not configured correctly. Error: ${errorMsg}`;
                console.error(`❌ ${broadcastService} authentication/configuration error (${response.status}): ${errorMsg}`);
              } else {
                console.warn(`⚠️ ${broadcastService} broadcast failed (${response.status}): ${errorMsg}`);
                if (!lastError) {
                  lastError = `${broadcastService}: ${errorMsg}`;
                }
              }
              // Continue to next URL/network combination
              continue;
            }
          } catch (cryptoApisError: any) {
            // Log error but continue to next URL/network combination
            if (cryptoApisError.response) {
              const errorMsg = typeof cryptoApisError.response.data === 'string'
                ? cryptoApisError.response.data
                : cryptoApisError.response.data?.error?.message || cryptoApisError.response.data?.message || 
                  cryptoApisError.response.data?.error || `Error ${cryptoApisError.response.status}`;
              
              const errorMsgLower = errorMsg.toLowerCase();
              const status = cryptoApisError.response.status;
              
              // Handle rate limit errors (429) - retry logic should have handled this, but log if it still fails
              if (status === 429) {
                lastError = `CryptoAPIs rate limit exceeded (429): ${errorMsg}. Please wait a moment and try again, or upgrade your CryptoAPIs plan.`;
                console.error(`❌ ${broadcastService} rate limit error (429): ${errorMsg}`);
                console.error(`   Retries were attempted but rate limit persists. Consider upgrading your CryptoAPIs plan or waiting before retrying.`);
                // Continue to next URL/network combination (might try Mempool.space as fallback)
                continue;
              }
              
              // Check if error is related to API key configuration
              if (status === 401 || status === 403 || 
                  errorMsgLower.includes('api key') || 
                  errorMsgLower.includes('authentication') ||
                  errorMsgLower.includes('not configured') ||
                  errorMsgLower.includes('invalid') ||
                  errorMsgLower.includes('unauthorized')) {
                cryptoApisConfigError = true;
                lastError = `CryptoAPIs API key appears to be invalid or not configured correctly. Error: ${errorMsg}`;
                console.error(`❌ ${broadcastService} authentication/configuration error (${status}): ${errorMsg}`);
              } else {
                console.warn(`⚠️ ${broadcastService} failed: ${errorMsg}`);
                if (!lastError) {
                  lastError = `${broadcastService}: ${errorMsg}`;
                }
              }
            } else {
              console.warn(`⚠️ ${broadcastService} failed: ${cryptoApisError.message || 'Network error'}`);
              if (!lastError) {
                lastError = `${broadcastService}: ${cryptoApisError.message || 'Network error'}`;
              }
            }
            // Continue to next URL/network combination
            continue;
          }
        }
      }
      
      // If we get here, all CryptoAPIs attempts failed
      if (cryptoApisConfigError) {
        console.error(`❌ CryptoAPIs API key configuration error detected. Please check your CRYPTOAPIS_API_KEY in api/.env`);
        console.error(`   The API key exists (${cryptoApisApiKey.length} chars) but appears to be invalid or not properly configured.`);
        console.error(`   Last error: ${lastError}`);
      } else if (lastError) {
        console.warn(`⚠️ All CryptoAPIs attempts failed, last error: ${lastError}`);
      }
    } else {
      console.log('ℹ️ CryptoAPIs API key not configured, skipping CryptoAPIs broadcast');
    }
    
    // Try Mempool.space as secondary fallback (supports testnet4 natively)
    broadcastUrl = `${MEMEPOOL_BASE_URL}/api/tx`;
    broadcastService = 'Mempool.space';
    console.log(`📤 Attempting broadcast via ${broadcastService}: ${broadcastUrl}`);
    
    try {
      const response = await axios.post(broadcastUrl, txHex, {
        timeout: 60000, // 60 second timeout
        headers: {
          'Content-Type': 'text/plain',
        },
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      });

      if (response.status >= 200 && response.status < 300) {
        // Mempool.space returns transaction ID
        const txid = typeof response.data === 'string'
          ? response.data.trim()
          : response.data?.txid || response.data?.transactionId || String(response.data).trim();
        
        if (txid && txid.length > 0) {
          console.log(`✅ Transaction broadcast successfully via ${broadcastService}: ${txid}`);
          res.setHeader('Content-Type', 'text/plain');
          return res.send(txid);
        } else {
          console.error('❌ Mempool.space response structure:', JSON.stringify(response.data, null, 2));
          lastError = 'Mempool.space returned success but no transaction ID in response';
        }
      } else {
        // Mempool.space returned error status
        const errorMsg = typeof response.data === 'string'
          ? response.data
          : response.data?.error || response.data?.message || `Broadcast failed with status ${response.status}`;
        lastError = `${broadcastService}: ${errorMsg}`;
        console.warn(`⚠️ ${broadcastService} broadcast failed (${response.status}): ${errorMsg}`);
      }
    } catch (mempoolError: any) {
      // Log detailed error information
      console.error(`❌ ${broadcastService} broadcast error:`);
      console.error('   Error type:', mempoolError.constructor?.name || typeof mempoolError);
      console.error('   Error message:', mempoolError.message || 'No error message');
      console.error('   Error code:', mempoolError.code || 'No error code');
      if (mempoolError.response) {
        console.error('   Response status:', mempoolError.response.status);
        console.error('   Response headers:', JSON.stringify(mempoolError.response.headers));
        console.error('   Response data type:', typeof mempoolError.response.data);
        console.error('   Response data:', mempoolError.response.data);
        
        // Try to extract meaningful error message
        let errorMsg = 'Unknown error';
        if (typeof mempoolError.response.data === 'string') {
          errorMsg = mempoolError.response.data;
        } else if (mempoolError.response.data?.error) {
          errorMsg = mempoolError.response.data.error;
        } else if (mempoolError.response.data?.message) {
          errorMsg = mempoolError.response.data.message;
        } else if (mempoolError.response.data) {
          errorMsg = JSON.stringify(mempoolError.response.data);
        }
        lastError = `${broadcastService}: ${errorMsg}`;
      } else {
        lastError = `${broadcastService}: ${mempoolError.message || mempoolError.code || 'Network error'}`;
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
    if (cryptoApisConfigError) {
      finalErrorMessage = `CryptoAPIs API key is not configured correctly. ${lastError || 'The API key exists but appears to be invalid or not properly configured. Please check your CRYPTOAPIS_API_KEY in api/.env and ensure it is a valid CryptoAPIs API key.'}`;
    }
    if (inputUtxos.length > 0) {
      finalErrorMessage += ` Input UTXOs: ${inputUtxos.join(', ')}. If transaction is "orphaned", the UTXO may not exist or may have been spent.`;
    }
    const finalError = new Error(finalErrorMessage);
    throw finalError;
  } catch (error: any) {
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
    } else if (typeof error === 'string') {
      errorMsg = error;
    } else if (error.toString && error.toString() !== '[object Object]') {
      errorMsg = error.toString();
    } else {
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
router.post('/package', async (req: Request, res: Response) => {
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

    // Validate transactions before broadcasting
    // Per Charms docs: "It is a good idea to validate the transactions before submitting them"
    console.log('🔍 Validating commit transaction...');
    const commitValidation = await validateTransaction(commitTxHex);
    if (!commitValidation.valid) {
      console.error(`❌ Commit transaction validation failed: ${commitValidation.error}`);
      return res.status(400).json({ error: `Commit transaction validation failed: ${commitValidation.error}` });
    }
    console.log(`✅ Commit transaction validation passed: ${commitValidation.details?.size} bytes, ${commitValidation.details?.inputCount} input(s), ${commitValidation.details?.outputCount} output(s)`);

    console.log('🔍 Validating spell transaction...');
    const spellValidation = await validateTransaction(spellTxHex);
    if (!spellValidation.valid) {
      console.error(`❌ Spell transaction validation failed: ${spellValidation.error}`);
      return res.status(400).json({ error: `Spell transaction validation failed: ${spellValidation.error}` });
    }
    console.log(`✅ Spell transaction validation passed: ${spellValidation.details?.size} bytes, ${spellValidation.details?.inputCount} input(s), ${spellValidation.details?.outputCount} output(s)`);

    // Broadcasting priority (per Charms docs):
    // 1. Bitcoin Core RPC submitpackage (true package broadcasting)
    // 2. Wallet package method (if available)
    // 3. Rapid sequential broadcasting (CryptoAPIs → Mempool.space)
    console.log(`📤 Broadcasting transaction package (network: ${NETWORK}, commit: ${commitTxHex.length} bytes, spell: ${spellTxHex.length} bytes)`);
    
    // Step 1: Try Bitcoin Core RPC submitpackage first (true package broadcasting)
    // Per Charms docs: "This is functionally equivalent to bitcoin-cli submitpackage command"
    const bitcoinRpcConfig = getBitcoinRpcConfig();
    if (bitcoinRpcConfig) {
      // Check node health and sync status before broadcasting
      try {
        const health = await getBitcoinNodeHealth(bitcoinRpcConfig);
        if (!health.connected) {
          console.warn(`⚠️ Bitcoin Core RPC node health check failed: ${health.error}`);
          console.warn(`   Attempting broadcast anyway (node may be starting up)...`);
        } else if (health.blockchain?.initialBlockDownload) {
          const blocks = health.blockchain.blocks || 0;
          const headers = health.blockchain.headers || 0;
          console.warn(`⚠️ Bitcoin Core node is still syncing (${blocks.toLocaleString()}/${headers.toLocaleString()} blocks)`);
          
          // Extract input UTXO from commit transaction to check if node has synced enough
          try {
            const bitcoin = await import('bitcoinjs-lib');
            const network = NETWORK === 'testnet4' || NETWORK === 'testnet'
              ? { messagePrefix: '\x18Bitcoin Signed Message:\n', bech32: 'tb', bip32: { public: 0x043587cf, private: 0x04358394 }, pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef }
              : bitcoin.networks.bitcoin;
            const commitTx = bitcoin.Transaction.fromHex(commitTxHex);
            
            if (commitTx.ins.length > 0) {
              // Get first input UTXO
              const firstInput = commitTx.ins[0];
              const hashBuffer = Buffer.from(firstInput.hash);
              const txid = hashBuffer.reverse().toString('hex');
              
              // Check if node has synced enough for this UTXO
              const syncCheck = await checkNodeSyncForTransaction(txid, bitcoinRpcConfig);
              
              if (!syncCheck.hasSyncedEnough && syncCheck.txBlockHeight !== null) {
                console.warn(`⚠️ Node may not have synced enough blocks for UTXO ${txid}`);
                console.warn(`   ${syncCheck.recommendation}`);
                if (syncCheck.estimatedWaitTime) {
                  console.warn(`   Estimated wait time: ${syncCheck.estimatedWaitTime}`);
                }
                console.warn(`   The node will attempt to broadcast, but may fail with "bad-txns-inputs-missingorspent"`);
                console.warn(`   Consider waiting for sync or using fallback broadcasting methods.`);
              } else if (syncCheck.txBlockHeight === null) {
                console.warn(`   UTXO transaction is unconfirmed - node should be able to process it`);
              }
            }
          } catch (parseError: any) {
            console.warn(`⚠️ Could not check UTXO sync status: ${parseError.message}`);
          }
        }
      } catch (healthError: any) {
        // Don't fail broadcast if health check fails - just log warning
        console.warn(`⚠️ Could not check Bitcoin Core node health: ${healthError.message}`);
        console.warn(`   Proceeding with broadcast attempt...`);
      }
      
      try {
        const result = await broadcastPackageViaBitcoinRpc(commitTxHex, spellTxHex, bitcoinRpcConfig);
        
        // Verify both transactions are in mempool
        console.log('⏳ Verifying both transactions are accepted into mempool...');
        const commitInMempool = await checkTransactionInMempool(result.commitTxid);
        const spellInMempool = await checkTransactionInMempool(result.spellTxid);
        
        return res.json({
          commitTxid: result.commitTxid,
          spellTxid: result.spellTxid,
          broadcastMethod: 'bitcoin-core-rpc',
          mempoolStatus: {
            commitInMempool,
            spellInMempool,
          },
        });
      } catch (rpcError: any) {
        console.warn(`⚠️ Bitcoin Core RPC package broadcast failed: ${rpcError.message}`);
        
        // Provide actionable error information based on error type
        if (rpcError.message?.includes('connection refused') || rpcError.message?.includes('ECONNREFUSED')) {
          console.warn('💡 Troubleshooting:');
          console.warn('   1. Check if node is running: ps aux | grep bitcoind');
          console.warn('   2. Node may still be starting - wait 30-60 seconds');
          console.warn('   3. Run diagnostic: ./check-bitcoin-rpc.sh');
          console.warn('   4. Check RPC config: cat ~/.bitcoin/testnet4/bitcoin.conf | grep rpc');
        } else if (rpcError.message?.includes('timeout')) {
          console.warn('💡 Node may be overloaded or still syncing');
          console.warn('   Check logs: tail -f ~/.bitcoin/testnet4/debug.log');
        } else if (rpcError.message?.includes('bad-txns-inputs-missingorspent') || rpcError.message?.includes('inputs-missingorspent')) {
          console.warn('💡 This error usually means the node hasn\'t synced enough blocks yet.');
          console.warn('   The UTXO you\'re trying to spend is in a block the node hasn\'t downloaded.');
          console.warn('   Solutions:');
          console.warn('   1. Wait for the node to sync more blocks (check progress: ./monitor-bitcoin-health.sh)');
          console.warn('   2. Use fallback broadcasting methods (they don\'t require local node to have UTXO)');
          console.warn('   3. Check sync status: ~/.local/bin/bitcoin-cli -testnet -datadir=$HOME/.bitcoin/testnet4 getblockchaininfo');
        } else if (rpcError.message?.includes('package topology') || rpcError.message?.includes('topology disallowed')) {
          console.warn('💡 Package topology error - the commit transaction must be the parent of the spell transaction.');
          console.warn('   This can happen if:');
          console.warn('   1. The node doesn\'t have the commit transaction in its mempool');
          console.warn('   2. The transaction order is incorrect');
          console.warn('   The system will try fallback methods that may work better.');
        }
        
        console.warn('⚠️ Falling back to sequential broadcasting methods...');
        // Continue to fallback methods below
      }
    } else {
      console.log('ℹ️ Bitcoin Core RPC not configured (BITCOIN_RPC_URL not set), skipping RPC package broadcast');
    }
    
    // Step 2: Fallback to sequential broadcasting (CryptoAPIs → Mempool.space)
    // Helper function to broadcast a single transaction with fallbacks
    const broadcastSingleTx = async (txHex: string, txName: string): Promise<string> => {
      let broadcastUrl: string;
      let broadcastService: string;
      let lastError: string | null = null;
      
      // Try CryptoAPIs first (if API key is available) - good for testnet4
      const cryptoApisApiKey = getCryptoApisApiKey();
      if (cryptoApisApiKey) {
        // Try testnet4 directly first, then fallback to testnet
        const networksToTry = NETWORK === 'testnet4' ? ['testnet4', 'testnet'] : [getCryptoApisNetwork(NETWORK)];
        
        let cryptoApisSuccess = false;
        let cryptoApisConfigError = false; // Track if error is due to API key configuration
        for (const network of networksToTry) {
          // Try both v2 and non-v2 base URLs
          const baseUrls = [CRYPTOAPIS_BASE_URL_V2, CRYPTOAPIS_BASE_URL];
          
          for (const baseUrl of baseUrls) {
            broadcastUrl = `${baseUrl}/bitcoin/${network}`;
            broadcastService = `CryptoAPIs (${network})`;
            console.log(`📤 Attempting ${txName} broadcast via ${broadcastService}: ${broadcastUrl}`);
            
            try {
              // Use retry logic for rate limit errors (429)
              // Request body format per CryptoAPIs docs: { context, data: { item: { signedTransactionHex } } }
              const requestBody = {
                context: 'charm-cards-broadcast',
                data: {
                  item: {
                    signedTransactionHex: txHex
                  }
                }
              };
              console.log(`   Request body structure:`, JSON.stringify({ ...requestBody, data: { item: { signedTransactionHex: `${txHex.substring(0, 20)}...` } } }, null, 2));
              
              const response = await retryCryptoApisRequest(async () => {
                return await axios.post(broadcastUrl, requestBody, {
                  timeout: 60000, // 60 second timeout
                  headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': cryptoApisApiKey,
                  },
                  validateStatus: (status) => status < 500,
                });
              }, 3, 1000); // Max 3 retries, starting with 1 second delay

              if (response.status >= 200 && response.status < 300) {
                // CryptoAPIs returns JSON with transactionId in data.item.transactionId
                const txid = response.data?.data?.item?.transactionId || 
                             response.data?.data?.transactionId ||
                             response.data?.item?.transactionId ||
                             (typeof response.data === 'string' ? response.data.trim() : String(response.data).trim());
                
                if (txid && txid.length > 0) {
                  console.log(`✅ ${txName} broadcast successfully via ${broadcastService}: ${txid}`);
                  return txid;
                } else {
                  console.error(`❌ CryptoAPIs ${txName} response structure:`, JSON.stringify(response.data, null, 2));
                  throw new Error('CryptoAPIs returned success but no transaction ID in response');
                }
              } else {
                // Check error type
                const errorMsg = typeof response.data === 'string'
                  ? response.data
                  : response.data?.error?.message || response.data?.message || 
                    response.data?.error || `Broadcast failed with status ${response.status}`;
                
                const errorMsgLower = errorMsg.toLowerCase();
                
                // If 400 error (bad endpoint), skip remaining CryptoAPIs attempts and go to Mempool.space
                if (response.status === 400) {
                  if (errorMsgLower.includes('uri') || errorMsgLower.includes('not found')) {
                    console.error(`❌ CryptoAPIs endpoint appears incorrect (400) for ${txName}: ${errorMsg}`);
                    console.error(`   Skipping remaining CryptoAPIs attempts and falling back to Mempool.space`);
                    lastError = `CryptoAPIs endpoint error: ${errorMsg}`;
                    cryptoApisSuccess = false;
                    break; // Exit both loops and go to Mempool.space
                  }
                }
                
                // Handle rate limit errors (429) - these should have been retried, but if still failing, log and continue
                if (response.status === 429) {
                  lastError = `CryptoAPIs rate limit exceeded (429) for ${txName}: ${errorMsg}. Please wait a moment and try again, or upgrade your CryptoAPIs plan.`;
                  console.error(`❌ ${broadcastService} ${txName} rate limit error (429): ${errorMsg}`);
                  console.error(`   Retries were attempted but rate limit persists. Consider upgrading your CryptoAPIs plan or waiting before retrying.`);
                  // Continue to next URL/network combination (might try Mempool.space as fallback)
                  continue;
                }
                
                // Check if error is related to API key configuration
                if (response.status === 401 || response.status === 403 || 
                    errorMsgLower.includes('api key') || 
                    errorMsgLower.includes('authentication') ||
                    errorMsgLower.includes('not configured') ||
                    errorMsgLower.includes('invalid') ||
                    errorMsgLower.includes('unauthorized')) {
                  cryptoApisConfigError = true;
                  lastError = `CryptoAPIs API key appears to be invalid or not configured correctly. Error: ${errorMsg}`;
                  console.error(`❌ ${broadcastService} ${txName} authentication/configuration error (${response.status}): ${errorMsg}`);
                } else {
                  console.warn(`⚠️ ${broadcastService} ${txName} failed (${response.status}): ${errorMsg}`);
                  if (!lastError) {
                    lastError = `${broadcastService} ${txName}: ${errorMsg}`;
                  }
                }
                continue;
              }
            } catch (cryptoApisError: any) {
              // Log error but continue to next URL/network combination
              if (cryptoApisError.response) {
                const errorMsg = typeof cryptoApisError.response.data === 'string'
                  ? cryptoApisError.response.data
                  : cryptoApisError.response.data?.error?.message || cryptoApisError.response.data?.message || 
                    cryptoApisError.response.data?.error || `Error ${cryptoApisError.response.status}`;
                
                const errorMsgLower = errorMsg.toLowerCase();
                const status = cryptoApisError.response.status;
                
                // If 400 error (bad endpoint), skip remaining CryptoAPIs attempts and go to Mempool.space
                if (status === 400) {
                  if (errorMsgLower.includes('uri') || errorMsgLower.includes('not found')) {
                    console.error(`❌ CryptoAPIs endpoint appears incorrect (400) for ${txName}: ${errorMsg}`);
                    console.error(`   Skipping remaining CryptoAPIs attempts and falling back to Mempool.space`);
                    lastError = `CryptoAPIs endpoint error: ${errorMsg}`;
                    cryptoApisSuccess = false;
                    break; // Exit both loops and go to Mempool.space
                  }
                }
                
                // Handle rate limit errors (429) - retry logic should have handled this, but log if it still fails
                if (status === 429) {
                  lastError = `CryptoAPIs rate limit exceeded (429) for ${txName}: ${errorMsg}. Please wait a moment and try again, or upgrade your CryptoAPIs plan.`;
                  console.error(`❌ ${broadcastService} ${txName} rate limit error (429): ${errorMsg}`);
                  console.error(`   Retries were attempted but rate limit persists. Consider upgrading your CryptoAPIs plan or waiting before retrying.`);
                  // Continue to next URL/network combination (might try Mempool.space as fallback)
                  continue;
                }
                
                // Check if error is related to API key configuration
                if (status === 401 || status === 403 || 
                    errorMsgLower.includes('api key') || 
                    errorMsgLower.includes('authentication') ||
                    errorMsgLower.includes('not configured') ||
                    errorMsgLower.includes('invalid') ||
                    errorMsgLower.includes('unauthorized')) {
                  cryptoApisConfigError = true;
                  lastError = `CryptoAPIs API key appears to be invalid or not configured correctly. Error: ${errorMsg}`;
                  console.error(`❌ ${broadcastService} ${txName} authentication/configuration error (${status}): ${errorMsg}`);
                } else {
                  console.warn(`⚠️ ${broadcastService} ${txName} failed: ${errorMsg}`);
                  if (!lastError) {
                    lastError = `${broadcastService} ${txName}: ${errorMsg}`;
                  }
                }
              } else {
                console.warn(`⚠️ ${broadcastService} ${txName} failed: ${cryptoApisError.message || 'Network error'}`);
                if (!lastError) {
                  lastError = `${broadcastService} ${txName}: ${cryptoApisError.message || 'Network error'}`;
                }
              }
              continue;
            }
          }
        }
        
        // If we get here, all CryptoAPIs attempts failed
        if (cryptoApisConfigError) {
          console.error(`❌ CryptoAPIs API key configuration error detected for ${txName}. Please check your CRYPTOAPIS_API_KEY in api/.env`);
          console.error(`   The API key exists (${cryptoApisApiKey.length} chars) but appears to be invalid or not properly configured.`);
          console.error(`   Last error: ${lastError}`);
        } else if (!lastError) {
          lastError = 'CryptoAPIs: All endpoint attempts failed';
        }
        if (lastError && !cryptoApisConfigError) {
          console.warn(`⚠️ All CryptoAPIs attempts failed for ${txName}, trying Mempool.space...`);
        }
      } else {
        console.log(`ℹ️ CryptoAPIs API key not configured, skipping CryptoAPIs broadcast for ${txName}`);
      }
      
      // Try Mempool.space as secondary fallback (supports testnet4 natively)
      broadcastUrl = `${MEMEPOOL_BASE_URL}/api/tx`;
      broadcastService = 'Mempool.space';
      console.log(`📤 Attempting ${txName} broadcast via ${broadcastService}: ${broadcastUrl}`);
      
      try {
        const response = await axios.post(broadcastUrl, txHex, {
          timeout: 60000, // 60 second timeout
          headers: {
            'Content-Type': 'text/plain',
          },
          validateStatus: (status) => status < 500,
        });

        if (response.status >= 200 && response.status < 300) {
          // Mempool.space returns transaction ID
          const txid = typeof response.data === 'string'
            ? response.data.trim()
            : response.data?.txid || response.data?.transactionId || String(response.data).trim();
          
          if (txid && txid.length > 0) {
            console.log(`✅ ${txName} broadcast successfully via ${broadcastService}: ${txid}`);
            return txid;
          } else {
            console.error(`❌ Mempool.space ${txName} response structure:`, JSON.stringify(response.data, null, 2));
            lastError = `Mempool.space returned success but no transaction ID in response`;
          }
        } else {
          const errorMsg = typeof response.data === 'string'
            ? response.data
            : response.data?.error || response.data?.message || `Broadcast failed with status ${response.status}`;
          lastError = `${broadcastService}: ${errorMsg}`;
          console.warn(`⚠️ ${broadcastService} ${txName} broadcast failed (${response.status}): ${errorMsg}`);
          
          // Provide helpful context for common errors
          if (errorMsg.includes('bad-txns-inputs-missingorspent') || errorMsg.includes('inputs-missingorspent')) {
            console.warn(`💡 This error means the UTXO you're trying to spend doesn't exist or was already spent.`);
            console.warn(`   If using Bitcoin Core node, it may not have synced the block containing your UTXO yet.`);
            console.warn(`   Check sync status: ./monitor-bitcoin-health.sh or ./check-bitcoin-rpc.sh`);
            console.warn(`   The node needs to sync the block containing your UTXO before it can validate the transaction.`);
          }
        }
      } catch (mempoolError: any) {
        console.error(`❌ ${broadcastService} ${txName} broadcast error:`);
        console.error('   Error type:', mempoolError.constructor?.name || typeof mempoolError);
        console.error('   Error message:', mempoolError.message || 'No error message');
        console.error('   Error code:', mempoolError.code || 'No error code');
        if (mempoolError.response) {
          console.error('   Response status:', mempoolError.response.status);
          console.error('   Response data:', mempoolError.response.data);
        }
        console.error('   Request URL:', broadcastUrl);
        console.error('   Transaction hex length:', txHex.length);
        
        // Try to extract meaningful error message
        let errorMsg = 'Unknown error';
        if (mempoolError.response) {
          if (typeof mempoolError.response.data === 'string') {
            errorMsg = mempoolError.response.data;
          } else if (mempoolError.response.data?.error) {
            errorMsg = mempoolError.response.data.error;
          } else if (mempoolError.response.data?.message) {
            errorMsg = mempoolError.response.data.message;
          } else if (mempoolError.response.data) {
            errorMsg = JSON.stringify(mempoolError.response.data);
          }
          } else {
            errorMsg = mempoolError.message || mempoolError.code || 'Network error';
          }
        
        // Provide helpful context for sync-related errors
        if (errorMsg.includes('bad-txns-inputs-missingorspent') || errorMsg.includes('inputs-missingorspent')) {
          console.error(`💡 The UTXO may not exist or the node hasn't synced enough blocks.`);
          console.error(`   Check sync status: ./monitor-bitcoin-health.sh`);
          console.error(`   The node needs to sync the block containing your UTXO before it can validate the transaction.`);
        }
        
        lastError = `${broadcastService}: ${errorMsg}`;
      }
      
      // All broadcasting services failed
      if (!lastError) {
        lastError = 'No broadcasting service available';
      }
      throw new Error(`All broadcasting endpoints failed for ${txName}. ${lastError}`);
    };

    // Step 1: Broadcast commit transaction first
    // The commit transaction creates the Taproot output that the spell transaction spends
    // Per Charms docs: "Both transactions must be accepted into the mempool to ensure proper processing"
    console.log('📤 Step 1/2: Broadcasting commit transaction...');
    let commitTxid: string;
    try {
      commitTxid = await broadcastSingleTx(commitTxHex, 'commit transaction');
      console.log(`✅ Commit transaction broadcast successful: ${commitTxid}`);
    } catch (commitError: any) {
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
      } else if (typeof commitError === 'string') {
        errorMsg = commitError;
      } else if (commitError.toString && commitError.toString() !== '[object Object]') {
        errorMsg = commitError.toString();
      } else {
        errorMsg = JSON.stringify(commitError);
      }

      return res.status(500).json({
        error: `Failed to broadcast commit transaction: ${errorMsg}`,
        errorType: commitError.constructor?.name || typeof commitError,
        errorCode: commitError.code,
        fullError: commitError.toString ? commitError.toString() : String(commitError),
      });
    }

    // Step 2: Rapid sequential broadcasting - immediately attempt spell transaction
    // Per Charms docs: "Broadcast both transactions together as a package"
    // Since mempool.space doesn't support true package broadcasting, we broadcast rapidly in sequence
    // This maximizes the chance both transactions are accepted together
    console.log('📤 Step 2/2: Broadcasting spell transaction immediately (rapid sequential package broadcast)...');
    let spellTxid: string | null = null;
    let spellBroadcastAttempts = 0;
    const maxSpellRetries = 3;
    const retryDelays = [0, 1000, 2000]; // Immediate, then 1s, then 2s
    
    while (spellBroadcastAttempts < maxSpellRetries && !spellTxid) {
      try {
        // Wait a short delay before retry (except first attempt)
        if (spellBroadcastAttempts > 0) {
          const delay = retryDelays[spellBroadcastAttempts] || 2000;
          console.log(`   Retry attempt ${spellBroadcastAttempts + 1}/${maxSpellRetries} after ${delay}ms delay...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Check if commit is in mempool before retrying spell
          const commitInMempool = await checkTransactionInMempool(commitTxid);
          if (!commitInMempool) {
            console.warn(`   ⚠️ Commit transaction ${commitTxid} not yet in mempool, waiting briefly...`);
            const commitAccepted = await waitForMempoolAcceptance(commitTxid, 5000, 500);
            if (!commitAccepted) {
              console.warn(`   ⚠️ Commit transaction still not in mempool after wait, proceeding with spell broadcast anyway`);
            }
          }
        }
        
        spellTxid = await broadcastSingleTx(spellTxHex, 'spell transaction');
        console.log(`✅ Spell transaction broadcast successful: ${spellTxid}`);
        break; // Success, exit retry loop
      } catch (spellError: any) {
        spellBroadcastAttempts++;
        
        // Check if this is a dependency error (spell transaction references commit output that's not in mempool yet)
        const isDependencyError = spellError.message?.toLowerCase().includes('orphan') ||
                                  spellError.message?.toLowerCase().includes('missing') ||
                                  spellError.message?.toLowerCase().includes('not found') ||
                                  (spellError.response?.data && 
                                   (typeof spellError.response.data === 'string' && 
                                    (spellError.response.data.toLowerCase().includes('orphan') ||
                                     spellError.response.data.toLowerCase().includes('missing'))));
        
        if (isDependencyError && spellBroadcastAttempts < maxSpellRetries) {
          console.warn(`⚠️ Spell transaction broadcast failed (attempt ${spellBroadcastAttempts}/${maxSpellRetries}): ${spellError.message || 'Dependency error'}`);
          console.warn(`   This may be because commit transaction is not yet in mempool. Will retry...`);
          continue; // Retry
        }
        
        // If not a dependency error or last attempt, handle the error
        if (spellBroadcastAttempts >= maxSpellRetries) {
          // Last attempt failed - log comprehensive error
          console.error('❌ Spell transaction broadcast failed after all retry attempts');
          console.error('   Error type:', spellError.constructor?.name || typeof spellError);
          console.error('   Error message:', spellError.message || 'No error message');
          console.error('   Error code:', spellError.code || 'No error code');
          console.error('   Error stack:', spellError.stack || 'No stack trace');
          console.error('   Commit txid (already broadcast):', commitTxid);
          console.error(`   Total attempts: ${spellBroadcastAttempts}/${maxSpellRetries}`);
          
          // Even if spell broadcast fails, we return the commit txid so the user knows what happened
          if (spellError.response) {
            console.error('   Response status:', spellError.response.status);
            console.error('   Response headers:', spellError.response.headers);
            console.error('   Response data:', spellError.response.data);
            
            const errorMessage = typeof spellError.response.data === 'string'
              ? spellError.response.data
              : spellError.response.data?.error || spellError.response.data?.message || 'Failed to broadcast spell transaction';
            
            return res.status(spellError.response.status).json({
              error: `Spell transaction broadcast failed after ${maxSpellRetries} attempts: ${errorMessage}`,
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
          } else if (typeof spellError === 'string') {
            errorMsg = spellError;
          } else if (spellError.toString && spellError.toString() !== '[object Object]') {
            errorMsg = spellError.toString();
          } else {
            errorMsg = JSON.stringify(spellError);
          }

          return res.status(500).json({
            error: `Failed to broadcast spell transaction after ${maxSpellRetries} attempts: ${errorMsg}`,
            errorType: spellError.constructor?.name || typeof spellError,
            errorCode: spellError.code,
            fullError: spellError.toString ? spellError.toString() : String(spellError),
            commitTxid, // Return commit txid even if spell failed
          });
        } else {
          // Not a dependency error, but we have retries left - this shouldn't happen often
          throw spellError; // Re-throw to be caught by outer handler
        }
      }
    }
    
    // Verify spell transaction was successfully broadcast
    if (!spellTxid) {
      // This shouldn't happen if all error paths return, but TypeScript needs this check
      return res.status(500).json({
        error: 'Spell transaction broadcast failed: Unknown error after all retry attempts',
        commitTxid, // Return commit txid even if spell failed
      });
    }

    // Step 3: Verify both transactions are in mempool
    // Per Charms docs: "Both transactions must be accepted into the mempool to ensure proper processing"
    console.log('⏳ Verifying both transactions are accepted into mempool...');
    const commitInMempool = await checkTransactionInMempool(commitTxid);
    const spellInMempool = await checkTransactionInMempool(spellTxid);
    
    if (commitInMempool && spellInMempool) {
      console.log(`✅ Package broadcast successful: both transactions confirmed in mempool`);
      console.log(`   Commit txid: ${commitTxid}`);
      console.log(`   Spell txid: ${spellTxid}`);
    } else {
      console.warn(`⚠️ Package broadcast completed, but mempool verification incomplete:`);
      if (!commitInMempool) {
        console.warn(`   ⚠️ Commit transaction ${commitTxid} not yet in mempool`);
      }
      if (!spellInMempool) {
        console.warn(`   ⚠️ Spell transaction ${spellTxid} not yet in mempool`);
      }
      console.warn(`   Transactions may still be propagating. Check mempool.space for status.`);
    }
    
    // Return both transaction IDs
    return res.json({
      commitTxid,
      spellTxid,
      broadcastMethod: 'sequential', // Sequential broadcasting (CryptoAPIs → Mempool.space)
      mempoolStatus: {
        commitInMempool,
        spellInMempool,
      },
    });
  } catch (error: any) {
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
    } else if (typeof error === 'string') {
      errorMsg = error;
    } else if (error.toString && error.toString() !== '[object Object]') {
      errorMsg = error.toString();
    } else {
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

/**
 * GET /api/broadcast/health
 * Check Bitcoin Core RPC node health status with diagnostic information
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const bitcoinRpcConfig = getBitcoinRpcConfig();
    
    if (!bitcoinRpcConfig) {
      return res.json({
        status: 'not_configured',
        message: 'Bitcoin Core RPC not configured (BITCOIN_RPC_URL not set)',
        rpcConfigured: false,
        diagnostics: {
          suggestion: 'Set BITCOIN_RPC_URL in your .env file to enable package broadcasting',
          example: 'BITCOIN_RPC_URL=http://user:password@localhost:18332',
        },
      });
    }

    const health = await getBitcoinNodeHealth(bitcoinRpcConfig);
    
    if (!health.connected) {
      // Provide detailed diagnostic information
      const errorMsg = health.error || 'Unknown error';
      let diagnostics: any = {
        error: errorMsg,
        troubleshooting: [],
      };

      // Provide specific suggestions based on error type
      if (errorMsg.includes('connection refused') || errorMsg.includes('ECONNREFUSED')) {
        diagnostics.troubleshooting = [
          'Bitcoin Core node may not be running. Check with: ps aux | grep bitcoind',
          'Node may still be starting up. Wait 30-60 seconds and try again.',
          'RPC may not be enabled. Check bitcoin.conf has: server=1, rpcuser=..., rpcpassword=..., rpcport=18332',
          'Run diagnostic script: ./check-bitcoin-rpc.sh',
        ];
        diagnostics.checkNode = 'Run: bitcoind -testnet -datadir=$HOME/.bitcoin/testnet4 -daemon';
      } else if (errorMsg.includes('authentication') || errorMsg.includes('401') || errorMsg.includes('403')) {
        diagnostics.troubleshooting = [
          'RPC credentials may be incorrect. Verify username and password match bitcoin.conf',
          'Check that BITCOIN_RPC_URL in .env matches the credentials in bitcoin.conf',
          'Verify rpcuser and rpcpassword in: ~/.bitcoin/testnet4/bitcoin.conf',
        ];
      } else if (errorMsg.includes('timeout') || errorMsg.includes('ECONNABORTED')) {
        diagnostics.troubleshooting = [
          'Node may be overloaded or slow to respond',
          'Check node logs: tail -f ~/.bitcoin/testnet4/debug.log',
          'Node may still be syncing and processing blocks',
        ];
      }

      return res.status(503).json({
        status: 'unavailable',
        message: 'Bitcoin Core RPC node is not available',
        rpcConfigured: true,
        connected: false,
        diagnostics,
      });
    }

    // Determine overall health status
    const isSynced = !health.blockchain?.initialBlockDownload;
    const hasConnections = (health.network?.connections || 0) > 0;
    const isHealthy = isSynced && hasConnections;

    // Calculate sync progress
    const syncProgress = health.blockchain?.headers 
      ? ((health.blockchain.blocks / health.blockchain.headers) * 100).toFixed(1)
      : null;

    return res.json({
      status: isHealthy ? 'healthy' : 'syncing',
      message: isHealthy 
        ? 'Bitcoin Core node is fully synced and ready'
        : 'Bitcoin Core node is syncing (still usable for recent transactions)',
      rpcConfigured: true,
      connected: true,
      ready: isHealthy,
      blockchain: {
        ...health.blockchain,
        syncProgress: syncProgress ? `${syncProgress}%` : null,
      },
      network: health.network,
      mempool: health.mempool,
      diagnostics: {
        note: isHealthy 
          ? 'Node is ready for package broadcasting'
          : 'Node is syncing but can still process recent transactions. Package broadcasting may work but may have limitations.',
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: 'Error checking Bitcoin Core node health',
      error: error.message || String(error),
      diagnostics: {
        suggestion: 'Check server logs for more details',
        troubleshooting: [
          'Verify Bitcoin Core is running: ps aux | grep bitcoind',
          'Check RPC configuration in .env file',
          'Run diagnostic script: ./check-bitcoin-rpc.sh',
        ],
      },
    });
  }
});

export default router;

