import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

const NETWORK = process.env.BITCOIN_NETWORK || 'testnet4';
const MEMEPOOL_BASE_URL = NETWORK === 'testnet4'
  ? 'https://memepool.space/testnet4'
  : 'https://memepool.space';

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
  return callBitcoinRpcWithTimeout(method, params, config, 60000);
}

/**
 * Call Bitcoin RPC with configurable timeout
 * Useful for health checks that may need longer timeouts during sync
 */
async function callBitcoinRpcWithTimeout(
  method: string,
  params: any[],
  config: BitcoinRpcConfig,
  timeoutMs: number = 60000
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
      timeout: timeoutMs,
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
  loading?: boolean; // Node is connected but still loading block index
  blockchain?: {
    chain: string;
    blocks: number;
    headers: number;
    verificationProgress: number;
    initialBlockDownload: boolean;
    pruned?: boolean;
    pruneHeight?: number;
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
    // Get blockchain info with longer timeout for syncing nodes
    // Use a helper function with extended timeout for health checks
    const blockchainInfo = await callBitcoinRpcWithTimeout('getblockchaininfo', [], config, 120000);
    const networkInfo = await callBitcoinRpcWithTimeout('getnetworkinfo', [], config, 120000);
    const mempoolInfo = await callBitcoinRpcWithTimeout('getmempoolinfo', [], config, 120000);

    return {
      connected: true,
      loading: false,
      blockchain: {
        chain: blockchainInfo.result?.chain || 'unknown',
        blocks: blockchainInfo.result?.blocks || 0,
        headers: blockchainInfo.result?.headers || 0,
        verificationProgress: blockchainInfo.result?.verificationprogress || 0,
        initialBlockDownload: blockchainInfo.result?.initialblockdownload || false,
        pruned: blockchainInfo.result?.pruned || false,
        pruneHeight: blockchainInfo.result?.pruneheight || 0,
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
    // Error -28 means "Loading block index" - RPC is working but node is still initializing
    if (error.message?.includes('error (-28)') || error.message?.includes('Loading block index')) {
      return {
        connected: true, // RPC is connected and responding
        loading: true,   // But node is still loading
        error: 'Node is loading block index. RPC is available but not ready for all operations yet.',
      };
    }
    // Handle timeout errors specifically
    if (error.message?.includes('timeout') || error.code === 'ECONNABORTED' || error.message?.includes('timed out')) {
      return {
        connected: false,
        loading: true, // Node might be syncing/loading
        error: 'Bitcoin RPC request timed out. The node may be overloaded or still syncing. This is common during initial block download. Check node status: ./check-bitcoin-rpc.sh or tail -f ~/.bitcoin/testnet4/debug.log',
      };
    }
    return {
      connected: false,
      error: error.message || 'Unknown error checking node health',
    };
  }
}

/**
 * Check if Bitcoin Core is ready for broadcasting
 * Node is ready if:
 * - RPC is connected and not loading block index
 * - Node is fully synced OR has connections and sufficient verification progress
 * 
 * @param config Bitcoin RPC configuration (optional, will fetch if not provided)
 * @returns Object indicating if Bitcoin Core is ready for broadcasting
 */
export async function isBitcoinCoreReady(config?: BitcoinRpcConfig): Promise<{
  ready: boolean;
  reason?: string;
}> {
  const rpcConfig = config || getBitcoinRpcConfig();
  
  if (!rpcConfig) {
    return {
      ready: false,
      reason: 'Bitcoin Core RPC not configured',
    };
  }

  // Test mode: bypass readiness checks for immediate testing
  if (process.env.BITCOIN_TEST_MODE === 'true') {
    return {
      ready: true,
      reason: 'Test mode enabled - bypassing readiness checks',
    };
  }

  try {
    const health = await getBitcoinNodeHealth(rpcConfig);
    
    // Not connected or still loading block index
    if (!health.connected || health.loading) {
      return {
        ready: false,
        reason: health.error || 'Bitcoin Core RPC not connected or still loading',
      };
    }

    // Check if node is synced or has sufficient progress
    const isSynced = !health.blockchain?.initialBlockDownload;
    const hasConnections = (health.network?.connections || 0) > 0;
    const verificationProgress = health.blockchain?.verificationProgress || 0;
    const blocks = health.blockchain?.blocks || 0;
    
    // Ready if fully synced OR (has connections AND verification progress > 30% AND has synced at least 1000 blocks)
    // Lowered threshold from 50% to 30% and added minimum block requirement for syncing nodes
    // This allows nodes that are actively syncing to process transactions sooner
    if (isSynced || (hasConnections && verificationProgress > 0.3 && blocks > 1000)) {
      return {
        ready: true,
        reason: isSynced 
          ? 'Bitcoin Core is fully synced and ready'
          : `Bitcoin Core is syncing (${(verificationProgress * 100).toFixed(1)}% complete, ${blocks.toLocaleString()} blocks) but has connections and can process recent transactions`,
      };
    }

    return {
      ready: false,
      reason: `Bitcoin Core is syncing (${(verificationProgress * 100).toFixed(1)}% complete, ${blocks.toLocaleString()} blocks) but needs more progress before ready (needs >30% progress and >1000 blocks)`,
    };
  } catch (error: any) {
    return {
      ready: false,
      reason: error.message || 'Error checking Bitcoin Core readiness',
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
    headers?: number;
    verificationprogress?: number;
  };
  loading?: boolean; // Node is connected but still loading
}> {
  try {
    const response = await callBitcoinRpc('getblockchaininfo', [], config);
    return {
      connected: true,
      details: {
        chain: response.result?.chain,
        blocks: response.result?.blocks,
        headers: response.result?.headers,
        verificationprogress: response.result?.verificationprogress,
      },
    };
  } catch (error: any) {
    // Error -28 means "Loading block index" or "Verifying blocks" or "Starting network threads"
    // This is actually a successful connection, just not ready yet
    if (error.message?.includes('error (-28)') || 
        error.message?.includes('Loading block index') ||
        error.message?.includes('Verifying blocks') ||
        error.message?.includes('Starting network threads')) {
      return {
        connected: true, // RPC is connected and responding
        loading: true,   // But node is still loading
        error: 'Node is initializing. RPC is available but not ready for all operations yet.',
      };
    }
    // Timeout errors during sync are common - treat as "connected but busy"
    if (error.message?.includes('timeout') || error.code === 'ECONNABORTED') {
      // Try a quick ping to see if RPC is actually reachable
      try {
        // Use a shorter timeout for the ping test
        const pingResponse = await axios.post(config.url, {
          jsonrpc: '2.0',
          id: 999,
          method: 'getblockcount',
          params: [],
        }, {
          headers: {
            'Content-Type': 'application/json',
            ...(config.user && config.password ? {
              'Authorization': `Basic ${Buffer.from(`${config.user}:${config.password}`).toString('base64')}`
            } : {}),
          },
          timeout: 10000, // 10 second timeout for ping
        });
        
        // If we got any response (even an error), RPC is reachable
        if (pingResponse.status === 200) {
          return {
            connected: true,
            loading: true,
            error: 'Node is busy syncing but RPC is reachable. It may take longer to respond during heavy sync operations.',
          };
        }
      } catch (pingError: any) {
        // If ping also fails, it's a real connection issue
      }
    }
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
 * Verify package topology - check if spell transaction spends an output from commit transaction
 * Bitcoin Core's submitpackage requires child-with-parents relationship
 * 
 * @param commitTxHex Commit transaction hex
 * @param spellTxHex Spell transaction hex
 * @returns Validation result with diagnostics
 */
async function verifyPackageTopology(
  commitTxHex: string,
  spellTxHex: string
): Promise<{
  valid: boolean;
  reason?: string;
  diagnostics?: {
    commitTxid?: string;
    commitOutputs?: number;
    spellInputs?: number;
    matchingInputs?: number;
    commitOutputHashes?: string[];
    spellInputHashes?: string[];
  };
}> {
  try {
    const bitcoin = await import('bitcoinjs-lib');
    const network = NETWORK === 'testnet4' || NETWORK === 'testnet'
      ? { messagePrefix: '\x18Bitcoin Signed Message:\n', bech32: 'tb', bip32: { public: 0x043587cf, private: 0x04358394 }, pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef }
      : bitcoin.networks.bitcoin;

    // Parse commit transaction
    const commitTx = bitcoin.Transaction.fromHex(commitTxHex.trim());
    const commitTxid = commitTx.getId();
    
    // Parse spell transaction
    const spellTx = bitcoin.Transaction.fromHex(spellTxHex.trim());
    
    // Extract commit transaction outputs (these are what spell should spend)
    // The commit transaction creates Taproot outputs that the spell transaction spends
    const commitOutputHashes: string[] = [];
    for (let i = 0; i < commitTx.outs.length; i++) {
      // Create a reference: txid:vout format
      commitOutputHashes.push(`${commitTxid}:${i}`);
    }
    
    // Extract spell transaction inputs and check if any reference commit outputs
    const spellInputHashes: string[] = [];
    let matchingInputs = 0;
    
    for (let i = 0; i < spellTx.ins.length; i++) {
      const input = spellTx.ins[i];
      const hashBuffer = Buffer.from(input.hash);
      const txid = hashBuffer.reverse().toString('hex');
      const vout = input.index;
      const inputRef = `${txid}:${vout}`;
      spellInputHashes.push(inputRef);
      
      // Check if this input references a commit output
      if (commitOutputHashes.includes(inputRef)) {
        matchingInputs++;
      }
    }
    
    const diagnostics = {
      commitTxid,
      commitOutputs: commitTx.outs.length,
      spellInputs: spellTx.ins.length,
      matchingInputs,
      commitOutputHashes,
      spellInputHashes,
    };
    
    // Package topology is valid if spell transaction has at least one input that references commit output
    if (matchingInputs > 0) {
      return {
        valid: true,
        diagnostics,
      };
    }
    
    return {
      valid: false,
      reason: `Spell transaction does not spend any output from commit transaction. Commit has ${commitTx.outs.length} output(s), spell has ${spellTx.ins.length} input(s), but none match.`,
      diagnostics,
    };
  } catch (error: any) {
    return {
      valid: false,
      reason: `Failed to verify package topology: ${error.message}`,
    };
  }
}

/**
 * Extract transaction structure for diagnostics
 * 
 * @param txHex Transaction hex
 * @returns Transaction structure information
 */
async function extractTransactionStructure(txHex: string): Promise<{
  txid: string;
  inputCount: number;
  outputCount: number;
  inputs: Array<{ txid: string; vout: number; ref: string }>;
  size: number;
}> {
  try {
    const bitcoin = await import('bitcoinjs-lib');
    const network = NETWORK === 'testnet4' || NETWORK === 'testnet'
      ? { messagePrefix: '\x18Bitcoin Signed Message:\n', bech32: 'tb', bip32: { public: 0x043587cf, private: 0x04358394 }, pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef }
      : bitcoin.networks.bitcoin;

    const tx = bitcoin.Transaction.fromHex(txHex.trim());
    const txid = tx.getId();
    
    const inputs = tx.ins.map((input, index) => {
      const hashBuffer = Buffer.from(input.hash);
      const inputTxid = hashBuffer.reverse().toString('hex');
      const vout = input.index;
      return {
        txid: inputTxid,
        vout,
        ref: `${inputTxid}:${vout}`,
      };
    });
    
    return {
      txid,
      inputCount: tx.ins.length,
      outputCount: tx.outs.length,
      inputs,
      size: txHex.trim().length / 2, // Size in bytes
    };
  } catch (error: any) {
    throw new Error(`Failed to extract transaction structure: ${error.message}`);
  }
}

/**
 * Submit transactions sequentially as fallback when package submission fails
 * This works even when Bitcoin Core can't verify package topology
 * 
 * @param commitTxHex Commit transaction hex
 * @param spellTxHex Spell transaction hex
 * @param config Bitcoin RPC configuration
 * @returns Object with transaction IDs for both transactions
 */
async function submitTransactionsSequentially(
  commitTxHex: string,
  spellTxHex: string,
  config: BitcoinRpcConfig
): Promise<{ commitTxid: string; spellTxid: string }> {
  console.log('📦 Attempting sequential transaction submission (fallback method)...');
  console.log('   Step 1: Submitting commit transaction...');
  
  try {
    // Step 1: Submit commit transaction
    const commitResponse = await callBitcoinRpc('sendrawtransaction', [commitTxHex.trim()], config);
    const commitTxid = commitResponse.result;
    
    if (!commitTxid || typeof commitTxid !== 'string') {
      throw new Error('Bitcoin Core RPC returned invalid commit transaction ID');
    }
    
    console.log(`✅ Commit transaction submitted: ${commitTxid}`);
    
    // Step 2: Wait for commit transaction to be accepted into mempool
    console.log('   Step 2: Waiting for commit transaction to be accepted into mempool...');
    const commitAccepted = await waitForMempoolAcceptance(commitTxid, 30000, 1000);
    
    if (!commitAccepted) {
      console.warn(`⚠️ Warning: Commit transaction ${commitTxid} was not found in mempool within timeout`);
      console.warn('⚠️ Proceeding with spell broadcast anyway - it may fail if commit is not in mempool');
    } else {
      console.log(`✅ Commit transaction ${commitTxid} confirmed in mempool`);
    }
    
    // Step 3: Submit spell transaction
    console.log('   Step 3: Submitting spell transaction...');
    const spellResponse = await callBitcoinRpc('sendrawtransaction', [spellTxHex.trim()], config);
    const spellTxid = spellResponse.result;
    
    if (!spellTxid || typeof spellTxid !== 'string') {
      throw new Error('Bitcoin Core RPC returned invalid spell transaction ID');
    }
    
    console.log(`✅ Spell transaction submitted: ${spellTxid}`);
    console.log(`✅ Sequential submission successful: commit=${commitTxid}, spell=${spellTxid}`);
    
    return { commitTxid, spellTxid };
  } catch (error: any) {
    console.error('❌ Sequential transaction submission failed:', error.message);
    
    // Check if this is a UTXO not found error (sync issue)
    const isUtxoNotFound = error.message?.includes('bad-txns-inputs-missingorspent') ||
                          error.message?.includes('inputs-missingorspent') ||
                          error.message?.includes('missingorspent');
    
    if (isUtxoNotFound) {
      // Get actual sync status and prune info for accurate error message
      let syncInfo = '';
      let isPrunedNode = false;
      let pruneHeight = 0;
      try {
        const blockchainInfo = await callBitcoinRpc('getblockchaininfo', [], config);
        const blocks = blockchainInfo.result?.blocks || 0;
        const headers = blockchainInfo.result?.headers || 0;
        const progress = blockchainInfo.result?.verificationprogress || 0;
        const progressPercent = (progress * 100).toFixed(1);
        const ibd = blockchainInfo.result?.initialblockdownload || false;
        isPrunedNode = blockchainInfo.result?.pruned || false;
        pruneHeight = blockchainInfo.result?.pruneheight || 0;
        
        if (ibd && headers > 0) {
          const blockPercent = ((blocks / headers) * 100).toFixed(1);
          syncInfo = `Current sync: ${blockPercent}% (${blocks.toLocaleString()}/${headers.toLocaleString()} blocks, verification: ${progressPercent}%)`;
        } else if (progress > 0) {
          syncInfo = `Current sync: ${progressPercent}% complete (${blocks.toLocaleString()} blocks)`;
        } else {
          syncInfo = `Current sync: ${blocks.toLocaleString()} blocks synced`;
        }
        
        if (isPrunedNode && pruneHeight > 0) {
          syncInfo += `. Node is PRUNED (prune height: ${pruneHeight.toLocaleString()}) - only blocks after ${pruneHeight.toLocaleString()} are available`;
        }
      } catch (syncError: any) {
        // If we can't get sync status, use generic message
        syncInfo = 'Unable to determine sync status';
      }
      
      // Determine if this is a prune issue or sync issue
      const errorMessage = isPrunedNode && pruneHeight > 0
        ? `Sequential submission failed: Bitcoin Core cannot verify the UTXO because it's from a pruned block. ` +
          `The node is pruned (prune height: ${pruneHeight.toLocaleString()}) and only has blocks after ${pruneHeight.toLocaleString()}. ` +
          `The UTXO you're trying to spend is from a block that was pruned. ` +
          `Solution: Use a UTXO from a recent block (after ${pruneHeight.toLocaleString()}) or disable pruning. ` +
          `${syncInfo}`
        : `Sequential submission failed: Bitcoin Core doesn't have the UTXO data needed. ` +
          `The commit transaction spends a UTXO that Bitcoin Core hasn't synced yet. ` +
          `This is a sync issue - Bitcoin Core needs to download more blocks to have the UTXO data. ` +
          `${syncInfo}. Please wait for Bitcoin Core to sync more blocks.`;
      
      const enhancedError: any = new Error(errorMessage);
      enhancedError.originalError = error.message;
      enhancedError.errorType = isPrunedNode ? 'utxo_pruned' : 'utxo_not_synced';
      enhancedError.errorCode = isPrunedNode ? 'UTXO_PRUNED' : 'UTXO_NOT_SYNCED';
      // Only set isSyncIssue for actual sync issues (when node is NOT pruned)
      // Pruned issues should NOT be marked as sync issues
      enhancedError.isSyncIssue = !isPrunedNode;
      enhancedError.isPrunedIssue = isPrunedNode;
      enhancedError.pruneHeight = pruneHeight;
      console.log(`🔍 Error type detected: ${enhancedError.errorType} (isPrunedIssue: ${isPrunedNode}, isSyncIssue: ${!isPrunedNode})`);
      throw enhancedError;
    }
    
    throw error;
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

  // Step 1: Verify package topology before submission
  console.log('🔍 Verifying package topology...');
  const topologyCheck = await verifyPackageTopology(commitTxHex, spellTxHex);
  
  if (!topologyCheck.valid) {
    console.warn(`⚠️ Package topology validation failed: ${topologyCheck.reason}`);
    if (topologyCheck.diagnostics) {
      console.warn(`   Diagnostics:`, JSON.stringify(topologyCheck.diagnostics, null, 2));
    }
    console.warn('⚠️ Proceeding with package submission anyway - Bitcoin Core will validate');
  } else {
    console.log('✅ Package topology verified: spell transaction spends commit output');
    if (topologyCheck.diagnostics) {
      console.log(`   Commit outputs: ${topologyCheck.diagnostics.commitOutputs}, Spell inputs: ${topologyCheck.diagnostics.spellInputs}, Matching: ${topologyCheck.diagnostics.matchingInputs}`);
    }
  }

  // Step 2: Extract transaction structure for diagnostics
  let commitStructure: any = null;
  let spellStructure: any = null;
  try {
    commitStructure = await extractTransactionStructure(commitTxHex);
    spellStructure = await extractTransactionStructure(spellTxHex);
    console.log(`📋 Transaction structure:`);
    console.log(`   Commit: ${commitStructure.txid} (${commitStructure.inputCount} inputs, ${commitStructure.outputCount} outputs, ${commitStructure.size} bytes)`);
    console.log(`   Spell: ${spellStructure.txid} (${spellStructure.inputCount} inputs, ${spellStructure.outputCount} outputs, ${spellStructure.size} bytes)`);
  } catch (structError: any) {
    console.warn(`⚠️ Could not extract transaction structure: ${structError.message}`);
  }

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
    
    // Check if this is a package topology error (RPC error -25)
    const isTopologyError = error.message?.includes('error (-25)') || 
                           error.message?.includes('package topology') ||
                           error.message?.includes('topology disallowed') ||
                           error.message?.includes('not child-with-parents');
    
    if (isTopologyError) {
      console.warn('⚠️ Package topology error detected - attempting fallback to sequential submission...');
      console.warn('   This can happen if Bitcoin Core cannot verify the parent-child relationship');
      console.warn('   Possible causes:');
      console.warn('   1. Node hasn\'t synced enough blocks to have UTXO data');
      console.warn('   2. The commit transaction spends UTXOs not yet in the node\'s view');
      console.warn('   3. Package topology validation issue');
      
      // Try fallback: submit transactions sequentially
      try {
        return await submitTransactionsSequentially(commitTxHex, spellTxHex, config);
      } catch (fallbackError: any) {
        // Check for pruned issues FIRST (before sync issues)
        // Pruned errors should be propagated as-is, not treated as sync errors
        const isPrunedIssue = fallbackError.isPrunedIssue || 
                             fallbackError.errorType === 'utxo_pruned' ||
                             fallbackError.errorCode === 'UTXO_PRUNED';
        
        if (isPrunedIssue) {
          // This is a pruned issue - propagate the pruned error
          const enhancedError: any = new Error(
            `Package topology error and sequential fallback failed due to pruned UTXO. ` +
            `${fallbackError.message || 'Bitcoin Core cannot verify the UTXO because it\'s from a pruned block.'} ` +
            `Original error: ${error.message}. ` +
            `Fallback error: ${fallbackError.message}`
          );
          enhancedError.originalError = error.message;
          enhancedError.fallbackError = fallbackError.message;
          enhancedError.errorType = 'utxo_pruned';
          enhancedError.errorCode = 'UTXO_PRUNED';
          enhancedError.isPrunedIssue = true;
          enhancedError.isSyncIssue = false;
          enhancedError.pruneHeight = fallbackError.pruneHeight || 0;
          enhancedError.diagnostics = {
            topologyCheck: topologyCheck.diagnostics,
            commitStructure,
            spellStructure,
            recommendation: 'Use a UTXO from a recent block (after the prune height) or disable pruning.',
          };
          console.log(`🔍 Fallback error detected as PRUNED issue: ${enhancedError.errorType}, prune height: ${enhancedError.pruneHeight}`);
          throw enhancedError;
        }
        
        // Check if fallback failed due to sync issue (only if NOT pruned)
        const isSyncIssue = fallbackError.isSyncIssue || 
                           fallbackError.errorType === 'utxo_not_synced' ||
                           fallbackError.errorType === 'sync_required' ||
                           (fallbackError.message?.includes("doesn't have the UTXO data") && !isPrunedIssue) ||
                           (fallbackError.message?.includes('bad-txns-inputs-missingorspent') && !isPrunedIssue);
        
        if (isSyncIssue) {
          // This is a sync issue - provide clear guidance
          const enhancedError: any = new Error(
            `Package topology error and sequential fallback failed due to sync issue. ` +
            `Bitcoin Core hasn't synced enough blocks to have the UTXO data needed. ` +
            `Original error: ${error.message}. ` +
            `Fallback error: ${fallbackError.message}`
          );
          enhancedError.originalError = error.message;
          enhancedError.fallbackError = fallbackError.message;
          enhancedError.errorType = 'sync_required';
          enhancedError.errorCode = 'SYNC_REQUIRED';
          enhancedError.isSyncIssue = true;
          enhancedError.isPrunedIssue = false;
          enhancedError.diagnostics = {
            topologyCheck: topologyCheck.diagnostics,
            commitStructure,
            spellStructure,
            recommendation: 'Wait for Bitcoin Core to finish syncing. The node needs to download blocks containing the UTXO you\'re trying to spend.',
          };
          console.log(`🔍 Fallback error detected as SYNC issue: ${enhancedError.errorType}`);
          throw enhancedError;
        }
        
        // If fallback also fails for other reasons, throw with enhanced error information
        const enhancedError: any = new Error(
          `Package topology error and sequential fallback failed. ` +
          `Original error: ${error.message}. ` +
          `Fallback error: ${fallbackError.message}`
        );
        enhancedError.originalError = error.message;
        enhancedError.fallbackError = fallbackError.message;
        enhancedError.errorType = 'package_topology_error';
        enhancedError.errorCode = 'PACKAGE_TOPOLOGY_ERROR';
        enhancedError.diagnostics = {
          topologyCheck: topologyCheck.diagnostics,
          commitStructure,
          spellStructure,
        };
        throw enhancedError;
      }
    }
    
    // For other errors, re-throw as-is
    throw error;
  }
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

    console.log(`📤 Broadcasting transaction (${txHex.length} bytes, network: ${NETWORK})...`);
    
    // Check if Bitcoin Core is configured and ready
    const bitcoinRpcConfig = getBitcoinRpcConfig();
    
    if (!bitcoinRpcConfig) {
      return res.status(503).json({
        error: 'Bitcoin Core RPC not configured',
        errorType: 'rpc_not_configured',
        errorCode: 'RPC_NOT_CONFIGURED',
        message: 'Set BITCOIN_RPC_URL in api/.env to enable broadcasting',
        suggestion: 'Add BITCOIN_RPC_URL=http://user:password@localhost:18332 to api/.env',
        healthCheck: 'Check /api/broadcast/health for configuration status',
      });
    }
    
    // Check if Bitcoin Core is ready for broadcasting
    const readiness = await isBitcoinCoreReady(bitcoinRpcConfig);
    
    if (!readiness.ready) {
      // Determine error type based on reason
      let errorType = 'node_not_ready';
      let errorCode = 'NODE_NOT_READY';
      
      if (readiness.reason?.includes('not configured')) {
        errorType = 'rpc_not_configured';
        errorCode = 'RPC_NOT_CONFIGURED';
      } else if (readiness.reason?.includes('not connected') || readiness.reason?.includes('connection')) {
        errorType = 'rpc_connection_failed';
        errorCode = 'RPC_CONNECTION_FAILED';
      } else if (readiness.reason?.includes('timeout')) {
        errorType = 'rpc_timeout';
        errorCode = 'RPC_TIMEOUT';
      } else if (readiness.reason?.includes('loading') || readiness.reason?.includes('syncing')) {
        errorType = 'node_syncing';
        errorCode = 'NODE_SYNCING';
      }
      
      return res.status(503).json({
        error: 'Bitcoin Core RPC is not ready for broadcasting',
        errorType,
        errorCode,
        reason: readiness.reason,
        message: 'Bitcoin Core node must be ready before broadcasting transactions',
        suggestion: 'Wait for Bitcoin Core to finish syncing or check node status',
        healthCheck: 'Check /api/broadcast/ready or /api/broadcast/health for current status',
      });
    }
    
    // Broadcast via Bitcoin Core RPC
    try {
      console.log(`✅ Using Bitcoin Core RPC (healthy): ${readiness.reason}`);
      const response = await callBitcoinRpc('sendrawtransaction', [txHex], bitcoinRpcConfig);
      const txid = response.result;
      
      if (txid && typeof txid === 'string') {
        console.log(`✅ Transaction broadcast successfully via Bitcoin Core RPC: ${txid}`);
        res.setHeader('Content-Type', 'text/plain');
        return res.send(txid);
      } else {
        throw new Error('Bitcoin Core RPC returned invalid transaction ID');
      }
    } catch (rpcError: any) {
      console.error(`❌ Bitcoin Core RPC broadcast failed: ${rpcError.message}`);
      
      // Provide actionable error information
      let troubleshooting: string[] = [];
      if (rpcError.message?.includes('connection refused') || rpcError.message?.includes('ECONNREFUSED')) {
        troubleshooting = [
          'Check if node is running: ps aux | grep bitcoind',
          'Node may still be starting - wait 30-60 seconds',
          'Run diagnostic: ./check-bitcoin-rpc.sh',
          'Check RPC config: cat ~/.bitcoin/testnet4/bitcoin.conf | grep rpc',
        ];
      } else if (rpcError.message?.includes('bad-txns-inputs-missingorspent') || rpcError.message?.includes('inputs-missingorspent')) {
        troubleshooting = [
          'Node may not have synced enough blocks yet',
          'The UTXO you\'re trying to spend is in a block the node hasn\'t downloaded',
          'Wait for node to sync more blocks (check progress: ./monitor-bitcoin-health.sh)',
          'Check sync status: bitcoin-cli -chain=testnet4 -datadir=$HOME/.bitcoin/testnet4 getblockchaininfo',
        ];
      } else if (rpcError.message?.includes('timeout')) {
        troubleshooting = [
          'Node may be overloaded or slow to respond',
          'Check node logs: tail -f ~/.bitcoin/testnet4/testnet4/debug.log',
        ];
      }
      
      return res.status(500).json({
        error: 'Bitcoin Core RPC broadcast failed',
        message: rpcError.message || 'Unknown error',
        troubleshooting,
        healthCheck: 'Check /api/broadcast/health for node status',
      });
    }
  } catch (error: any) {
    // Comprehensive error logging
    console.error('❌ Error broadcasting transaction');
    console.error('   Error type:', error.constructor?.name || typeof error);
    console.error('   Error message:', error.message || 'No error message');
    console.error('   Error code:', error.code || 'No error code');
    
    if (typeof txHex !== 'undefined') {
      console.error('   Transaction hex length:', txHex.length);
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
 * Broadcast a transaction package (commit + spell) via Bitcoin Core RPC
 * Per Charms docs: "Broadcast both transactions together as a package"
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

    // Extract transaction structure for diagnostics
    let commitStructure: any = null;
    let spellStructure: any = null;
    try {
      commitStructure = await extractTransactionStructure(commitTxHex);
      spellStructure = await extractTransactionStructure(spellTxHex);
      console.log(`📋 Package transaction structure:`);
      console.log(`   Commit TX: ${commitStructure.txid}`);
      console.log(`     Inputs: ${commitStructure.inputCount}, Outputs: ${commitStructure.outputCount}, Size: ${commitStructure.size} bytes`);
      if (commitStructure.inputs.length > 0) {
        console.log(`     Input UTXOs: ${commitStructure.inputs.map((i: any) => i.ref).join(', ')}`);
      }
      console.log(`   Spell TX: ${spellStructure.txid}`);
      console.log(`     Inputs: ${spellStructure.inputCount}, Outputs: ${spellStructure.outputCount}, Size: ${spellStructure.size} bytes`);
      if (spellStructure.inputs.length > 0) {
        console.log(`     Input UTXOs: ${spellStructure.inputs.map((i: any) => i.ref).join(', ')}`);
      }
    } catch (structError: any) {
      console.warn(`⚠️ Could not extract transaction structure: ${structError.message}`);
    }

    // Verify package topology before broadcasting
    console.log('🔍 Verifying package topology before broadcast...');
    const topologyCheck = await verifyPackageTopology(commitTxHex, spellTxHex);
    if (topologyCheck.valid) {
      console.log(`✅ Package topology verified: spell transaction spends commit output`);
      if (topologyCheck.diagnostics) {
        console.log(`   Matching inputs: ${topologyCheck.diagnostics.matchingInputs} of ${topologyCheck.diagnostics.spellInputs}`);
      }
    } else {
      console.warn(`⚠️ Package topology check failed: ${topologyCheck.reason}`);
      if (topologyCheck.diagnostics) {
        console.warn(`   Diagnostics:`, JSON.stringify(topologyCheck.diagnostics, null, 2));
      }
      console.warn(`⚠️ Will attempt package submission anyway - Bitcoin Core will validate`);
    }

    // Broadcasting via Bitcoin Core RPC submitpackage (true package broadcasting)
    // Per Charms docs: "This is functionally equivalent to bitcoin-cli submitpackage command"
    console.log(`📤 Broadcasting transaction package (network: ${NETWORK}, commit: ${commitTxHex.length} bytes, spell: ${spellTxHex.length} bytes)`);
    
    // Check if Bitcoin Core is configured and ready
    const bitcoinRpcConfig = getBitcoinRpcConfig();
    
    if (!bitcoinRpcConfig) {
      return res.status(503).json({
        error: 'Bitcoin Core RPC not configured',
        message: 'Set BITCOIN_RPC_URL in api/.env to enable package broadcasting',
        suggestion: 'Add BITCOIN_RPC_URL=http://user:password@localhost:18332 to api/.env',
        healthCheck: 'Check /api/broadcast/health for configuration status',
      });
    }
    
    // Check if Bitcoin Core is ready for broadcasting
    const readiness = await isBitcoinCoreReady(bitcoinRpcConfig);
    
    // In test mode, log warning but allow broadcasting attempt
    if (!readiness.ready && process.env.BITCOIN_TEST_MODE !== 'true') {
      // Determine error type based on reason
      let errorType = 'node_not_ready';
      let errorCode = 'NODE_NOT_READY';
      
      if (readiness.reason?.includes('not configured')) {
        errorType = 'rpc_not_configured';
        errorCode = 'RPC_NOT_CONFIGURED';
      } else if (readiness.reason?.includes('not connected') || readiness.reason?.includes('connection')) {
        errorType = 'rpc_connection_failed';
        errorCode = 'RPC_CONNECTION_FAILED';
      } else if (readiness.reason?.includes('timeout')) {
        errorType = 'rpc_timeout';
        errorCode = 'RPC_TIMEOUT';
      } else if (readiness.reason?.includes('loading') || readiness.reason?.includes('syncing')) {
        errorType = 'node_syncing';
        errorCode = 'NODE_SYNCING';
      }
      
      return res.status(503).json({
        error: 'Bitcoin Core RPC is not ready for broadcasting',
        errorType,
        errorCode,
        reason: readiness.reason,
        message: 'Bitcoin Core node must be ready before broadcasting transaction packages',
        suggestion: 'Wait for Bitcoin Core to finish syncing or check node status',
        healthCheck: 'Check /api/broadcast/ready or /api/broadcast/health for current status',
      });
    }
    
    // In test mode, log that we're bypassing the check
    if (process.env.BITCOIN_TEST_MODE === 'true' && !readiness.ready) {
      console.warn('⚠️ Test mode enabled - bypassing readiness check. Node status:', readiness.reason);
    }
    
    // Broadcast package via Bitcoin Core RPC
    try {
      console.log(`✅ Using Bitcoin Core RPC (healthy): ${readiness.reason}`);
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
      console.error(`❌ Bitcoin Core RPC package broadcast failed: ${rpcError.message}`);
      
      // Determine error type and code
      let errorType = 'rpc_error';
      let errorCode = 'RPC_ERROR';
      let troubleshooting: string[] = [];
      
      if (rpcError.message?.includes('connection refused') || rpcError.message?.includes('ECONNREFUSED')) {
        errorType = 'rpc_connection_failed';
        errorCode = 'RPC_CONNECTION_FAILED';
        troubleshooting = [
          'Check if node is running: ps aux | grep bitcoind',
          'Node may still be starting - wait 30-60 seconds',
          'Run diagnostic: ./check-bitcoin-rpc.sh',
          'Check RPC config: cat ~/.bitcoin/testnet4/bitcoin.conf | grep rpc',
        ];
      } else if (rpcError.message?.includes('timeout')) {
        errorType = 'rpc_timeout';
        errorCode = 'RPC_TIMEOUT';
        troubleshooting = [
          'Node may be overloaded or still syncing',
          'Check node logs: tail -f ~/.bitcoin/testnet4/testnet4/debug.log',
        ];
      } else if (rpcError.isPrunedIssue || rpcError.errorType === 'utxo_pruned' || rpcError.errorCode === 'UTXO_PRUNED') {
        // Specific error for pruned block issues - check this BEFORE sync issues
        errorType = 'utxo_pruned';
        errorCode = 'UTXO_PRUNED';
        const pruneHeight = rpcError.pruneHeight || 0;
        const nodeBlocks = rpcError.nodeBlocks || 0;
        console.log(`🔍 Package endpoint: Detected PRUNED issue (errorType: ${rpcError.errorType}, errorCode: ${rpcError.errorCode}, pruneHeight: ${pruneHeight})`);
        troubleshooting = [
          'Bitcoin Core node is PRUNED and cannot verify UTXOs from pruned blocks',
          `Prune height: ${pruneHeight.toLocaleString()} (node only has blocks after this)`,
          `Current node blocks: ${nodeBlocks.toLocaleString()} (100% synced)`,
          `The UTXO you're trying to spend is from a block before ${pruneHeight.toLocaleString()}`,
          'Pruned nodes only keep the last ~550MB of blocks and delete older block data',
          '',
          'SOLUTION: Get a fresh UTXO from the faucet',
          `  • New coins will be from recent blocks (after ${pruneHeight.toLocaleString()})`,
          '  • These will work with your pruned node',
          '  • Use the Testnet4 faucet to get fresh testnet coins',
          '',
          'Alternative: Disable pruning in bitcoin.conf (requires full re-sync from scratch)',
        ];
      } else if (rpcError.isSyncIssue ||
                 rpcError.errorType === 'sync_required' ||
                 rpcError.errorType === 'utxo_not_synced' ||
                 (rpcError.message?.includes('bad-txns-inputs-missingorspent') && 
                  rpcError.fallbackError?.includes('bad-txns-inputs-missingorspent'))) {
        // Only treat as sync issue if it's NOT a pruned issue (pruned check already happened above)
        errorType = 'sync_required';
        errorCode = 'SYNC_REQUIRED';
        console.log(`🔍 Package endpoint: Detected SYNC issue (isSyncIssue: ${rpcError.isSyncIssue}, errorType: ${rpcError.errorType})`);
        
        // Get actual sync status for accurate troubleshooting message
        let syncStatusMsg = 'Check sync status: ./check-bitcoin-rpc.sh or curl http://localhost:3001/api/broadcast/health';
        try {
          const blockchainInfo = await callBitcoinRpc('getblockchaininfo', [], bitcoinRpcConfig);
          const blocks = blockchainInfo.result?.blocks || 0;
          const headers = blockchainInfo.result?.headers || 0;
          const progress = blockchainInfo.result?.verificationprogress || 0;
          const progressPercent = (progress * 100).toFixed(1);
          const ibd = blockchainInfo.result?.initialblockdownload || false;
          const isPruned = blockchainInfo.result?.pruned || false;
          const pruneHeight = blockchainInfo.result?.pruneheight || 0;
          
          if (ibd && headers > 0) {
            const blockPercent = ((blocks / headers) * 100).toFixed(1);
            syncStatusMsg = `The node is currently ${blockPercent}% synced (${blocks.toLocaleString()}/${headers.toLocaleString()} blocks, verification: ${progressPercent}%) - it needs to sync blocks containing your UTXO`;
          } else if (progress > 0) {
            syncStatusMsg = `The node is currently ${progressPercent}% synced (${blocks.toLocaleString()} blocks) - it needs to sync blocks containing your UTXO`;
          } else {
            syncStatusMsg = `The node has synced ${blocks.toLocaleString()} blocks - it needs to sync blocks containing your UTXO`;
          }
          
          if (isPruned && pruneHeight > 0) {
            syncStatusMsg += `. Note: Node is pruned (prune height: ${pruneHeight.toLocaleString()}) - only blocks after ${pruneHeight.toLocaleString()} are available`;
          }
        } catch (syncError: any) {
          // If we can't get sync status, use generic message
          syncStatusMsg = 'Check sync status: ./check-bitcoin-rpc.sh or curl http://localhost:3001/api/broadcast/health';
        }
        
        troubleshooting = [
          'Bitcoin Core hasn\'t synced enough blocks to have the UTXO data needed',
          'The commit transaction spends a UTXO that Bitcoin Core hasn\'t downloaded yet',
          'This is a sync issue - you need to wait for Bitcoin Core to sync more blocks',
          'Check sync status: ./check-bitcoin-rpc.sh or curl http://localhost:3001/api/broadcast/health',
          syncStatusMsg,
        ];
      } else if (rpcError.message?.includes('bad-txns-inputs-missingorspent') || rpcError.message?.includes('inputs-missingorspent')) {
        errorType = 'utxo_not_found';
        errorCode = 'UTXO_NOT_FOUND';
        troubleshooting = [
          'Node may not have synced enough blocks yet',
          'The UTXO you\'re trying to spend is in a block the node hasn\'t downloaded',
          'Wait for node to sync more blocks (check progress: ./monitor-bitcoin-health.sh)',
          'Check sync status: bitcoin-cli -chain=testnet4 -datadir=$HOME/.bitcoin/testnet4 getblockchaininfo',
        ];
      } else if (rpcError.message?.includes('package topology') || 
                 rpcError.message?.includes('topology disallowed') ||
                 rpcError.message?.includes('error (-25)') ||
                 rpcError.errorType === 'package_topology_error') {
        errorType = 'package_topology_error';
        errorCode = 'PACKAGE_TOPOLOGY_ERROR';
        troubleshooting = [
          'Package topology error - the commit transaction must create an output that the spell transaction spends',
          'This can happen if:',
          '  1. Bitcoin Core hasn\'t synced enough blocks to verify the relationship',
          '  2. The commit transaction spends UTXOs not yet in the node\'s view',
          '  3. The transactions are not properly linked (spell doesn\'t spend commit output)',
          'The system attempted sequential submission as fallback - check if transactions were submitted individually',
        ];
      }
      
      // Include diagnostics if available
      const response: any = {
        error: 'Bitcoin Core RPC package broadcast failed',
        errorType,
        errorCode,
        message: rpcError.message || 'Unknown error',
        troubleshooting,
        healthCheck: 'Check /api/broadcast/health for node status',
      };
      
      // Add diagnostics if available
      if (rpcError.diagnostics) {
        response.diagnostics = rpcError.diagnostics;
      }
      
      // Add original and fallback errors if available
      if (rpcError.originalError) {
        response.originalError = rpcError.originalError;
      }
      if (rpcError.fallbackError) {
        response.fallbackError = rpcError.fallbackError;
      }
      
      return res.status(500).json(response);
    }
  } catch (error: any) {
    // Comprehensive error logging
    console.error('❌ Error broadcasting transaction package');
    console.error('   Error type:', error.constructor?.name || typeof error);
    console.error('   Error message:', error.message || 'No error message');
    console.error('   Error code:', error.code || 'No error code');

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
 * GET /api/broadcast/ready
 * Quick check if Bitcoin Core is ready for broadcasting
 * Returns simple JSON: { ready: boolean, reason?: string }
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const readiness = await isBitcoinCoreReady();
    return res.json({
      ready: readiness.ready,
      reason: readiness.reason,
    });
  } catch (error: any) {
    return res.status(500).json({
      ready: false,
      reason: error.message || 'Error checking Bitcoin Core readiness',
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
        ready: false,
        fallbackEnabled: false,
        diagnostics: {
          suggestion: 'Set BITCOIN_RPC_URL in your .env file to enable package broadcasting',
          example: 'BITCOIN_RPC_URL=http://user:password@localhost:18332',
        },
      });
    }

    const health = await getBitcoinNodeHealth(bitcoinRpcConfig);
    const readiness = await isBitcoinCoreReady(bitcoinRpcConfig);

    if (health.connected && health.loading) {
      return res.json({
        status: 'loading',
        message: 'Bitcoin Core RPC is connected but node is still loading block index',
        rpcConfigured: true,
        connected: true,
        ready: false,
        loading: true,
        fallbackEnabled: false,
        diagnostics: {
          note: health.error || 'Node is initializing. This is normal after starting Bitcoin Core.',
          progress: 'Check node logs: tail -f ~/.bitcoin/testnet4/testnet3/debug.log',
          estimatedTime: 'Loading typically takes a few minutes depending on blockchain size',
        },
      });
    }

    if (!health.connected) {
      const diagnostics: any = {
        suggestion: 'Bitcoin Core RPC is not available. Check if the node is running.',
        troubleshooting: [
          'Verify Bitcoin Core is running: ps aux | grep bitcoind',
          'Check RPC connection: ./check-bitcoin-rpc.sh',
          'Verify BITCOIN_RPC_URL in .env matches your Bitcoin Core configuration',
          'Check Bitcoin Core logs: tail -f ~/.bitcoin/testnet4/testnet4/debug.log',
        ],
      };

      if (health.error) {
        diagnostics.error = health.error;
      }

      return res.status(503).json({
        status: 'unavailable',
        message: 'Bitcoin Core RPC node is not available',
        rpcConfigured: true,
        connected: false,
        ready: false,
        fallbackEnabled: false,
        diagnostics,
      });
    }

    const isSynced = !health.blockchain?.initialBlockDownload;
    const hasConnections = (health.network?.connections || 0) > 0;
    const isHealthy = isSynced && hasConnections;

    const syncProgress = health.blockchain?.headers
      ? ((health.blockchain.blocks / health.blockchain.headers) * 100).toFixed(1)
      : null;

    let estimatedTimeToReady = null;
    if (!isSynced && health.blockchain?.headers && health.blockchain?.blocks) {
      const remainingBlocks = health.blockchain.headers - health.blockchain.blocks;
      // Assuming average block time for testnet is 2.5 minutes (150 seconds)
      // This is a rough estimate and can vary greatly
      const estimatedSeconds = remainingBlocks * 150;
      const minutes = Math.ceil(estimatedSeconds / 60);
      if (minutes > 60) {
        estimatedTimeToReady = `${Math.ceil(minutes / 60)} hours`;
      } else {
        estimatedTimeToReady = `${minutes} minutes`;
      }
    }

    return res.json({
      status: isHealthy ? 'healthy' : 'syncing',
      message: isHealthy
        ? 'Bitcoin Core node is fully synced and ready'
        : 'Bitcoin Core node is syncing (still usable for recent transactions)',
      rpcConfigured: true,
      connected: true,
      ready: readiness.ready,
      loading: false,
      fallbackEnabled: false,
      blockchain: {
        ...health.blockchain,
        syncProgress: syncProgress ? `${syncProgress}%` : null,
      },
      network: health.network,
      mempool: health.mempool,
      diagnostics: {
        note: readiness.ready
          ? 'Node is ready for package broadcasting'
          : 'Node is syncing but can still process recent transactions. Package broadcasting may work but may have limitations.',
        estimatedTimeToReady: estimatedTimeToReady,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Error checking Bitcoin Core health',
      error: error.toString ? error.toString() : String(error),
    });
  }
});

export default router;
