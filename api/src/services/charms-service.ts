/**
 * Charms Service - Prover API Integration
 * 
 * This service handles interaction with the Charms Prover API (https://v8.charms.dev/spells/prove).
 * 
 * IMPORTANT: The Charms Prover API broadcasts transactions internally as part of the /spells/prove call.
 * 
 * When you call the Prover API:
 * 1. It validates the spell
 * 2. Builds the commit transaction
 * 3. Builds the spell transaction
 * 4. Broadcasts the transaction package using Charms' full nodes
 * 
 * A successful response means:
 * - Commit TX was accepted and broadcast
 * - Spell TX was accepted and broadcast
 * - Parent-child topology was valid
 * - Transactions are now in mempool (or mined)
 * 
 * Response Format:
 * The API returns an array of exactly 2 hex-encoded transactions:
 * ["hex_encoded_commit_tx", "hex_encoded_spell_tx"]
 * 
 * These transactions are already broadcast and ready to be signed.
 * No separate broadcast step is required or expected from the client.
 * 
 * Reference: https://docs.charms.dev/guides/wallet-integration/transactions/prover-api/
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import axios from 'axios';
import * as dotenv from 'dotenv';

// Ensure .env is loaded (in case this module is imported before server.ts)
// Use absolute path resolution to ensure we find the .env file correctly
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const execAsync = promisify(exec);

export interface SpellYaml {
  version: number;
  apps: Record<string, string>;
  public_inputs?: Record<string, any>; // Optional public inputs for app contract execution
  private_inputs?: Record<string, string>; // Optional private inputs (e.g., funding UTXO for minting)
  ins: Array<{
    utxo_id: string;
    charms: Record<string, any>;
  }>;
  outs: Array<{
    address: string;
    charms: Record<string, any>;
  }>;
}

/**
 * Compute TXID from transaction hex
 * Uses bitcoinjs-lib to parse transaction and extract TXID
 * 
 * @param txHex Transaction hex string
 * @returns Transaction ID (TXID)
 */
async function computeTxid(txHex: string): Promise<string> {
  try {
    const bitcoin = await import('bitcoinjs-lib');
    const tx = bitcoin.Transaction.fromHex(txHex.trim());
    return tx.getId();
  } catch (error: any) {
    throw new Error(`Failed to compute TXID from transaction hex: ${error.message}`);
  }
}

/**
 * Validate that proof transactions have correct package topology
 * The spell transaction must spend at least one output from the commit transaction
 * 
 * @param commitTxHex Commit transaction hex
 * @param spellTxHex Spell transaction hex
 * @param network Bitcoin network (testnet4, testnet, or mainnet)
 * @returns Validation result with diagnostics
 */
async function validateProofTransactions(
  commitTxHex: string,
  spellTxHex: string,
  network: string = 'testnet4'
): Promise<{
  valid: boolean;
  reason?: string;
  diagnostics?: {
    commitTxid?: string;
    commitInputs?: number;
    commitOutputs?: number;
    spellInputs?: number;
    spellOutputs?: number;
    matchingInputs?: number;
    commitOutputHashes?: string[];
    spellInputHashes?: string[];
    commitInputHashes?: string[];
  };
}> {
  try {
    const bitcoin = await import('bitcoinjs-lib');
    const bitcoinNetwork = network === 'testnet4' || network === 'testnet'
      ? { messagePrefix: '\x18Bitcoin Signed Message:\n', bech32: 'tb', bip32: { public: 0x043587cf, private: 0x04358394 }, pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef }
      : bitcoin.networks.bitcoin;

    // Parse commit transaction
    const commitTx = bitcoin.Transaction.fromHex(commitTxHex.trim());
    const commitTxid = commitTx.getId();
    
    // Parse spell transaction
    const spellTx = bitcoin.Transaction.fromHex(spellTxHex.trim());
    const spellTxid = spellTx.getId();
    
    // Extract commit transaction outputs (these are what spell should spend)
    const commitOutputHashes: string[] = [];
    for (let i = 0; i < commitTx.outs.length; i++) {
      commitOutputHashes.push(`${commitTxid}:${i}`);
    }
    
    // Extract commit transaction inputs (for diagnostics)
    const commitInputHashes: string[] = [];
    for (let i = 0; i < commitTx.ins.length; i++) {
      const input = commitTx.ins[i];
      const hashBuffer = Buffer.from(input.hash);
      const txid = hashBuffer.reverse().toString('hex');
      const vout = input.index;
      commitInputHashes.push(`${txid}:${vout}`);
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
      commitInputs: commitTx.ins.length,
      commitOutputs: commitTx.outs.length,
      spellInputs: spellTx.ins.length,
      spellOutputs: spellTx.outs.length,
      matchingInputs,
      commitOutputHashes,
      spellInputHashes,
      commitInputHashes,
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
      reason: `Spell transaction does not spend any output from commit transaction. Commit TX ${commitTxid} creates ${commitTx.outs.length} output(s) [${commitOutputHashes.join(', ')}], but spell TX ${spellTxid} has ${spellTx.ins.length} input(s) [${spellInputHashes.join(', ')}] and none match.`,
      diagnostics,
    };
  } catch (error: any) {
    return {
      valid: false,
      reason: `Failed to validate proof transactions: ${error.message}`,
    };
  }
}

export class CharmsService {
  private appPath: string;
  private appVk: string;
  private proverUrl: string;

  constructor() {
    // Ensure .env is loaded (in case constructor is called before server.ts loads it)
    // Reload to ensure we have the latest values
    const envPath = path.resolve(__dirname, '../.env');
    const result = dotenv.config({ path: envPath });
    
    // If .env file exists but wasn't loaded, log a warning
    if (result.error && (result.error as any).code !== 'ENOENT') {
      console.warn(`⚠️ Error loading .env file: ${result.error.message}`);
    }
    
    this.appPath = process.env.CHARMS_APP_PATH || '../gift-cards';
    this.appVk = process.env.CHARMS_APP_VK || '';
    
    // Determine Prover API URL based on network
    // Check if testnet-specific endpoint should be used
    const network = process.env.BITCOIN_NETWORK || 'testnet4';
    const isTestnet = network === 'testnet4' || network === 'testnet';
    
    // Use testnet-specific endpoint if available, otherwise use default
    // Note: Currently both testnet and mainnet use v8.charms.dev, but this allows for future testnet-specific endpoints
    // Prover API endpoint: https://v8.charms.dev/spells/prove
    // Supports both mainnet and testnet4
    // The Prover API broadcasts transactions internally - no separate broadcast step required
    this.proverUrl = process.env.PROVER_API_URL || 'https://v8.charms.dev/spells/prove';
    
    if (isTestnet) {
      console.log(`🌐 Using Prover API for ${network}: ${this.proverUrl}`);
    }
    
    // Log environment variable status for debugging
    if (this.appVk) {
      console.log(`✅ CharmsService initialized with app VK: ${this.appVk.substring(0, 16)}...`);
    } else {
      // Check if file exists
      const fs = require('fs');
      const envExists = fs.existsSync(envPath);
      console.warn(`⚠️ CharmsService initialized WITHOUT app VK. Set CHARMS_APP_VK in api/.env`);
      console.warn(`   Current CHARMS_APP_VK env var: ${process.env.CHARMS_APP_VK ? 'SET (' + process.env.CHARMS_APP_VK.substring(0, 16) + '...)' : 'NOT SET'}`);
      console.warn(`   .env file exists: ${envExists ? 'YES' : 'NO'} at ${envPath}`);
      console.warn(`   Check api/.env file exists and contains: CHARMS_APP_VK=...`);
    }
  }

  /**
   * Build the Charms app binary
   */
  async buildApp(): Promise<string> {
    const buildStartTime = Date.now();
    try {
      console.log('⏱️  Starting WASM build (release mode with optimizations)...');
      
      const { stdout, stderr } = await execAsync(
        `cd ${this.appPath} && unset CARGO_TARGET_DIR && charms app build`
      );
      
      const buildDuration = Date.now() - buildStartTime;
      console.log(`⏱️  WASM build completed in ${buildDuration}ms (${(buildDuration / 1000).toFixed(1)}s)`);
      
      if (stderr && stderr.trim().length > 0) {
        // Log build warnings but don't fail
        console.log(`   Build stderr: ${stderr.substring(0, 200)}...`);
      }
      
      const appBin = stdout.trim();
      
      // Log both relative and absolute paths for debugging
      // Note: __dirname in compiled code is api/dist/services, so we need to go up 2 levels to reach api/
      const apiDir = path.resolve(__dirname, '../..');
      const resolvedAppPath = path.resolve(apiDir, this.appPath);
      const absoluteAppBin = path.resolve(resolvedAppPath, appBin);
      console.log(`   Binary path (relative): ${appBin}`);
      console.log(`   Binary path (absolute): ${absoluteAppBin}`);
      
      // Verify it's a release build (should be in target/wasm32-wasip1/release/)
      if (appBin.includes('/release/')) {
        console.log('✅ Verified: Using release build (optimized)');
      } else if (appBin.includes('/debug/')) {
        console.warn('⚠️  Warning: Using debug build (not optimized). Performance will be slower.');
        console.warn('   Consider building in release mode for better performance.');
      }
      
      return appBin;
    } catch (error: any) {
      const buildDuration = Date.now() - buildStartTime;
      console.error(`❌ Build failed after ${buildDuration}ms (${(buildDuration / 1000).toFixed(1)}s)`);
      throw new Error(`Failed to build app: ${error.message}`);
    }
  }

  /**
   * Get the app verification key
   */
  async getAppVk(): Promise<string> {
    // Reload env vars in case they weren't loaded yet (refresh from .env file)
    const envVk = process.env.CHARMS_APP_VK;
    if (envVk && envVk !== this.appVk) {
      this.appVk = envVk;
      console.log('✅ Reloaded app VK from environment variable');
    }
    
    // First, check if VK is provided via environment variable
    if (this.appVk) {
      console.log('✅ Using app VK from environment variable');
      return this.appVk;
    }
    
    // If not provided, try to build and get VK
    // This requires the gift-cards app to be built first
    console.warn('⚠️ CHARMS_APP_VK not set in environment. Attempting to build app and get VK...');
    console.warn('💡 To avoid this, set CHARMS_APP_VK in your api/.env file');
    console.warn(`   Current env check: CHARMS_APP_VK=${envVk ? 'SET (' + envVk.substring(0, 16) + '...)' : 'NOT SET'}`);
    console.warn(`   Current instance value: ${this.appVk ? 'SET' : 'NOT SET'}`);
    
    try {
      const appBin = await this.buildApp();
      
      // Verify the WASM file exists
      try {
        await fs.access(appBin);
      } catch (accessError) {
        throw new Error(
          `WASM file not found at: ${appBin}\n` +
          `Please either:\n` +
          `1. Build the gift-cards app: cd ${this.appPath} && charms app build\n` +
          `2. Or set CHARMS_APP_VK in your api/.env file to skip building\n` +
          `   Make sure the API server is restarted after setting the env var.`
        );
      }
      
      const { stdout } = await execAsync(`charms app vk "${appBin}"`);
      const vk = stdout.trim();
      console.log('✅ Successfully generated app VK from WASM file');
      return vk;
    } catch (error: any) {
      throw new Error(
        `Failed to get app VK: ${error.message}\n` +
        `Please set CHARMS_APP_VK in your api/.env file to avoid building the app.\n` +
        `Example: CHARMS_APP_VK=1d7adfd77c17fec0df6ce3262d26a83318234c7d4e8a60659d331b395f67d6f0\n` +
        `⚠️ Make sure to restart the API server after updating .env file.`
      );
    }
  }

  /**
   * Check if a spell is valid
   */
  async checkSpell(spellYaml: string, prevTxs?: string): Promise<boolean> {
    try {
      // Try to build app - if it fails, we'll skip validation in mock mode
      let appBin: string;
      try {
        appBin = await this.buildApp();
      } catch (buildError: any) {
        // If building fails and we're in mock mode, skip validation
        const mockMode = process.env.MOCK_MODE === 'true';
        if (mockMode) {
          console.warn('⚠️ App build failed but MOCK_MODE is enabled, skipping spell validation');
          return true; // Allow spell to proceed in mock mode
        }
        throw new Error(`Failed to build app for spell validation: ${buildError.message}`);
      }
      
      const prevTxsArg = prevTxs ? `--prev-txs=${prevTxs}` : '';
      // Escape single quotes in YAML for shell command
      const escapedYaml = spellYaml.replace(/'/g, "'\\''");
      const command = `cd ${this.appPath} && echo '${escapedYaml}' | charms spell check --app-bins=${appBin} ${prevTxsArg}`;
      
      console.log('🔍 Validating spell with charms CLI...');
      console.log(`   App binary: ${appBin}`);
      console.log(`   App path: ${this.appPath}`);
      
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
      });
      
      // If command succeeds, spell is valid
      console.log('✅ Spell validation passed');
      if (stdout) console.log('Spell check output:', stdout);
      if (stderr && stderr.trim()) console.warn('Spell check warnings:', stderr);
      return true;
    } catch (error: any) {
      console.error('❌ Spell check failed:', error.message);
      if (error.stderr) {
        console.error('Spell check stderr:', error.stderr);
      }
      if (error.stdout) {
        console.error('Spell check stdout:', error.stdout);
      }
      
      // In mock mode, allow invalid spells to proceed (for testing)
      const mockMode = process.env.MOCK_MODE === 'true';
      if (mockMode) {
        console.warn('⚠️ Spell validation failed but MOCK_MODE is enabled, allowing spell to proceed');
        return true;
      }
      
      return false;
    }
  }

  /**
   * Generate proof for a spell using Charms Prover API
   * 
   * IMPORTANT: The Charms Prover API (https://v8.charms.dev/spells/prove) broadcasts transactions internally.
   * A successful response means both commit and spell transactions have already been broadcast to the Bitcoin network.
   * No separate broadcast step is required or expected from the client.
   * 
   * The Prover API:
   * 1. Validates the spell
   * 2. Builds the commit transaction
   * 3. Builds the spell transaction
   * 4. Broadcasts the transaction package using Charms' full nodes
   * 
   * Response Format:
   * Returns an array of exactly 2 hex-encoded transactions: [commit_tx, spell_tx]
   * These transactions are already broadcast and ready to be signed.
   * 
   * Reference: https://docs.charms.dev/guides/wallet-integration/transactions/prover-api/
   * 
   * @param spellYaml - The spell in YAML format
   * @param appBin - Optional app binary (base64-encoded RISC-V ELF)
   * @param prevTxs - Previous transactions that created the UTXOs being spent (raw hex format)
   * @param mockMode - Whether to use mock mode (empty binaries)
   * @param fundingUtxo - The UTXO to use for funding (txid:vout format)
   * @param fundingUtxoValue - The value of the funding UTXO in satoshis
   * @param changeAddress - Address to send remaining satoshis
   * @param feeRate - Fee rate in satoshis per byte (default: 2.0)
   * @returns Object with commit_tx, spell_tx, commit_txid, spell_txid, and broadcasted: true
   */
  async generateProof(
    spellYaml: string, 
    appBin?: string, 
    prevTxs?: string, 
    mockMode: boolean = false,
    fundingUtxo?: string,
    fundingUtxoValue?: number,
    changeAddress?: string,
    feeRate: number = 2.0
  ): Promise<any> {
    // Parse spell early so it's available in error handler
    // IMPORTANT: This spell YAML should already have corrected app_vk (for redeem/transfer)
    // or correct app_vk from the start (for mint)
    let spellObj: any;
    try {
      spellObj = yaml.load(spellYaml);
      console.log(`📋 Parsed spell YAML - apps: ${JSON.stringify(spellObj.apps || {})}`);
      
      // Comprehensive spell structure validation before sending to Prover API
      // Based on: https://docs.charms.dev/references/spell-json/
      if (!spellObj || typeof spellObj !== 'object') {
        throw new Error('Invalid spell YAML: Could not parse spell object');
      }
      
      // Validate version (must be 8)
      if (!spellObj.version) {
        throw new Error('Invalid spell: Missing version field');
      }
      if (spellObj.version !== 8) {
        throw new Error(`Invalid spell: Version must be 8, got ${spellObj.version}`);
      }
      
      // Validate apps field (required)
      if (!spellObj.apps || typeof spellObj.apps !== 'object') {
        throw new Error('Invalid spell: Missing or invalid apps field');
      }
      if (Object.keys(spellObj.apps).length === 0) {
        throw new Error('Invalid spell: apps field is empty');
      }
      // Validate apps format: should be "$00": "n/app_id/app_vk" or "t/app_id/app_vk"
      // App ID format: "n/<64-char-hex>/<64-char-hex>" or "t/<64-char-hex>/<64-char-hex>"
      const appIdPattern = /^[nt]\/[0-9a-fA-F]{64}\/[0-9a-fA-F]{64}$/;
      for (const [key, value] of Object.entries(spellObj.apps)) {
        if (!key.startsWith('$') || !/^\$[0-9a-fA-F]+$/.test(key)) {
          throw new Error(`Invalid spell: Invalid app key format "${key}" - must be "$00", "$01", etc.`);
        }
        if (typeof value !== 'string') {
          throw new Error(`Invalid spell: App value for ${key} must be a string, got ${typeof value}`);
        }
        // Validate format: "n/app_id/app_vk" or "t/app_id/app_vk"
        // Both app_id and app_vk must be exactly 64 hex characters
        if (!appIdPattern.test(value)) {
          const actualLength = value.split('/').map((part, i) => i === 0 ? part : `${part.length} chars`).join('/');
          throw new Error(
            `Invalid spell: App value for ${key} has invalid format "${value}". ` +
            `Expected format: "n/<64-char-hex>/<64-char-hex>" or "t/<64-char-hex>/<64-char-hex>". ` +
            `Actual format: "${actualLength}". ` +
            `Each app_id and app_vk must be exactly 64 hexadecimal characters.`
          );
        }
      }
      
      // Log app IDs for debugging (especially important for redeem/transfer)
      console.log('📋 Spell app IDs validation:');
      Object.entries(spellObj.apps).forEach(([key, appId]: [string, any]) => {
        const appIdStr = String(appId);
        const parts = appIdStr.split('/');
        const appType = parts[0]; // 'n' or 't'
        const appIdHash = parts[1]?.substring(0, 16) + '...' || 'MISSING';
        const appVkHash = parts[2]?.substring(0, 16) + '...' || 'MISSING';
        console.log(`   ${key}: ${appType}/${appIdHash}/${appVkHash} (format: ✅ valid)`);
      });
      
      // Validate ins field (required, must be array)
      if (!Array.isArray(spellObj.ins)) {
        throw new Error('Invalid spell: Missing or invalid ins (inputs) field - must be an array');
      }
      // Validate each input
      spellObj.ins.forEach((input: any, index: number) => {
        if (!input || typeof input !== 'object') {
          throw new Error(`Invalid spell: Input ${index} is not an object`);
        }
        if (!input.utxo_id || typeof input.utxo_id !== 'string') {
          throw new Error(`Invalid spell: Input ${index} missing or invalid utxo_id field`);
        }
        // Validate UTXO format: "txid:vout"
        if (!/^[0-9a-fA-F]{64}:\d+$/.test(input.utxo_id)) {
          throw new Error(`Invalid spell: Input ${index} has invalid utxo_id format "${input.utxo_id}" - expected "txid:vout"`);
        }
        if (!input.charms || typeof input.charms !== 'object') {
          throw new Error(`Invalid spell: Input ${index} missing or invalid charms field`);
        }
      });
      
      // Validate outs field (required, must be array)
      if (!Array.isArray(spellObj.outs)) {
        throw new Error('Invalid spell: Missing or invalid outs (outputs) field - must be an array');
      }
      if (spellObj.outs.length === 0) {
        throw new Error('Invalid spell: outs array is empty - must have at least one output');
      }
      // Validate each output
      spellObj.outs.forEach((output: any, index: number) => {
        if (!output || typeof output !== 'object') {
          throw new Error(`Invalid spell: Output ${index} is not an object`);
        }
        if (!output.address || typeof output.address !== 'string') {
          throw new Error(`Invalid spell: Output ${index} missing or invalid address field`);
        }
        // Validate address is Taproot (starts with tb1p for testnet, bc1p for mainnet)
        if (!/^(tb1p|bc1p)[a-z0-9]{58}$/.test(output.address)) {
          throw new Error(`Invalid spell: Output ${index} has invalid address format "${output.address}" - must be Taproot address`);
        }
        // sats is optional but recommended (defaults to 1000)
        if (output.sats !== undefined && (typeof output.sats !== 'number' || output.sats < 330)) {
          throw new Error(`Invalid spell: Output ${index} has invalid sats value ${output.sats} - must be at least 330`);
        }
        if (!output.charms || typeof output.charms !== 'object') {
          throw new Error(`Invalid spell: Output ${index} missing or invalid charms field`);
        }
        if (Object.keys(output.charms).length === 0) {
          throw new Error(`Invalid spell: Output ${index} has empty charms field`);
        }
      });
      
      // Validate private_inputs if present (optional but should be valid if included)
      if (spellObj.private_inputs) {
        if (typeof spellObj.private_inputs !== 'object') {
          throw new Error('Invalid spell: private_inputs must be an object');
        }
        for (const [key, value] of Object.entries(spellObj.private_inputs)) {
          if (!key.startsWith('$') || !/^\$[0-9a-fA-F]+$/.test(key)) {
            throw new Error(`Invalid spell: Invalid private_inputs key format "${key}" - must be "$00", "$01", etc.`);
          }
          if (typeof value !== 'string') {
            throw new Error(`Invalid spell: private_inputs value for ${key} must be a string, got ${typeof value}`);
          }
        }
      }
      
      console.log('✅ Spell structure validation passed - all required fields present and correctly formatted');
      
      // Build payload according to Prover API format
      // Based on: https://docs.charms.dev/guides/wallet-integration/transactions/prover-api/
      // prev_txs format: API error confirms it requires enum variant format
      // Error: "prev_txs[0]: unknown variant ... expected `bitcoin` or `cardano`"
      // Format: [{ "bitcoin": "hex_string" }, ...] - NOT raw hex strings
      // The official docs example is simplified - actual API requires enum variant
      let prevTxsArray: Array<{ bitcoin: string }> = [];
      if (prevTxs) {
        if (Array.isArray(prevTxs)) {
          // Convert to enum variant format
          prevTxsArray = prevTxs.map((tx: any) => {
            if (typeof tx === 'string') {
              return { bitcoin: tx }; // Convert string to { bitcoin: "hex" }
            } else if (tx && typeof tx === 'object' && 'bitcoin' in tx) {
              return tx; // Already in correct format
            } else {
              throw new Error(`Invalid prev_txs format: expected string or object with 'bitcoin' field`);
            }
          });
        } else if (typeof prevTxs === 'string' && prevTxs.length > 0) {
          // Single transaction hex string - convert to enum variant format
          prevTxsArray = [{ bitcoin: prevTxs }];
        }
      }
      
      // Validate that we have prev_txs for each input in the spell
      const numInputs = spellObj.ins?.length || 0;
      if (numInputs > 0 && prevTxsArray.length === 0) {
        throw new Error(`prev_txs MUST contain transactions creating input UTXOs. Spell has ${numInputs} input(s) but prev_txs is empty.`);
      }
      
      if (numInputs > 0 && prevTxsArray.length !== numInputs) {
        console.warn(`⚠️ Warning: Spell has ${numInputs} input(s) but prev_txs has ${prevTxsArray.length} transaction(s). This may cause Prover API to reject the request.`);
      }
      
      // Build binaries object
      // Per official documentation: https://docs.charms.dev/guides/wallet-integration/transactions/prover-api/
      // The Prover API requires binaries in flat structure: { VK: base64Wasm }
      // Per documentation: "binaries: { app VK (hex-encoded 32 bytes) to app binary }"
      // Key: VK (app_vk) - 64-character hex string (32 bytes hex-encoded)
      // Value: base64 encoded WASM string
      const binaries: Record<string, string> = {};
      
      // Ensure we have the actual WASM VK before building binaries
      // This is critical to ensure the binary key matches the actual WASM VK
      if (appBin && !this.appVk) {
        try {
          this.appVk = await this.getAppVk();
          console.log(`✅ Retrieved WASM VK for binary mapping: ${this.appVk.substring(0, 16)}...`);
        } catch (vkError: any) {
          console.warn(`⚠️ Could not get WASM VK: ${vkError.message}`);
          console.warn(`   Will use VK from spell, but this may cause mismatches`);
        }
      }
      
      if (appBin) {
        try {
          // Resolve the appBin path relative to appPath if it's a relative path
          // buildApp() returns paths like "./target/..." relative to gift-cards/
          let resolvedAppBin: string;
          if (path.isAbsolute(appBin)) {
            resolvedAppBin = appBin;
          } else {
            // Resolve appPath to absolute path first
            // appPath is relative to api/ directory (e.g., '../gift-cards')
            // Note: __dirname in compiled code is api/dist/services, so we need to go up 2 levels to reach api/
            const apiDir = path.resolve(__dirname, '../..');
            const resolvedAppPath = path.resolve(apiDir, this.appPath);
            
            // Now resolve appBin relative to the absolute appPath
            // appBin is relative to gift-cards/ (e.g., './target/wasm32-wasip1/release/gift-cards.wasm')
            resolvedAppBin = path.resolve(resolvedAppPath, appBin);
            
            // Log for debugging
            console.log(`   Resolved appPath: ${resolvedAppPath}`);
            console.log(`   Resolved appBin: ${resolvedAppBin}`);
          }
          
          console.log(`📦 Reading WASM binary from: ${resolvedAppBin}`);
          
          // Verify the resolved path exists
          try {
            await fs.access(resolvedAppBin);
            console.log(`✅ Verified WASM binary exists at: ${resolvedAppBin}`);
          } catch (accessError: any) {
            // Note: __dirname in compiled code is api/dist/services, so we need to go up 2 levels to reach api/
            const apiDir = path.resolve(__dirname, '../..');
            const resolvedAppPath = path.resolve(apiDir, this.appPath);
            const expectedPath = path.resolve(resolvedAppPath, 'target/wasm32-wasip1/release/gift-cards.wasm');
            throw new Error(
              `WASM binary not found at: ${resolvedAppBin}\n` +
              `Expected location: ${expectedPath}\n` +
              `Please build the app first: cd ${resolvedAppPath} && cargo build --release --target wasm32-wasip1`
            );
          }
          
          // Read the WASM file and base64 encode it
          const wasmBuffer = await fs.readFile(resolvedAppBin);
          const base64Wasm = wasmBuffer.toString('base64');
          
          // Validate binary is not empty
          if (!base64Wasm || base64Wasm.length === 0) {
            throw new Error(`WASM binary is empty after reading from ${resolvedAppBin}`);
          }
          
          // Validate binary has reasonable size (at least 1KB base64 = ~750 bytes WASM)
          if (base64Wasm.length < 1000) {
            throw new Error(`WASM binary seems too small (${base64Wasm.length} chars base64). Expected at least 1KB.`);
          }
          
          console.log(`✅ Loaded WASM binary: ${base64Wasm.length} chars base64 (${Math.round(wasmBuffer.length / 1024)}KB raw)`);
          console.log(`📁 WASM file path: ${resolvedAppBin}`);
          console.log(`📁 WASM file size: ${wasmBuffer.length} bytes`);
          console.log(`📁 WASM file modified: ${(await fs.stat(resolvedAppBin)).mtime.toISOString()}`);
          
          // The Prover API expects binaries keyed by the VK (app_vk) - 64-character hex string
          // Spell format: "n/<app_id>/<app_vk>" -> Prover API expects binary key: "<app_vk>" (64-char hex)
          // NOTE: spellObj is parsed from spellYaml, which should have corrected app_vk for redeem/transfer
          console.log(`📦 Building binaries object with VK (app_vk) as keys per documentation...`);
          console.log(`   Spell apps from parsed YAML: ${JSON.stringify(spellObj.apps || {})}`);
          console.log(`   Actual WASM VK: ${this.appVk ? this.appVk.substring(0, 16) + '...' : 'NOT SET'}`);
          console.log(`   Full WASM VK: ${this.appVk || 'NOT SET'}`);
          
          if (spellObj.apps && typeof spellObj.apps === 'object') {
            for (const appId of Object.values(spellObj.apps)) {
              const appIdStr = String(appId);
              const parts = appIdStr.split('/');
              
              // Extract VK (app_vk) from the full format "n/<app_id>/<app_vk>"
              // Prover API expects flat structure: { VK: base64Wasm } per documentation
              // Format: { "<app_vk>": "<base64 wasm>" } - just VK as key, no nesting, no prefix
              if (parts.length >= 3) {
                const appVk = parts[2]; // VK (app_vk) - 64-char hex (32 bytes hex-encoded)
                
                // CRITICAL: Verify this VK matches the actual WASM VK
                // If they don't match, use the actual WASM VK to ensure correctness
                const actualWasmVk = this.appVk;
                if (actualWasmVk && appVk !== actualWasmVk) {
                  console.warn(`⚠️ VK mismatch detected: spell VK=${appVk.substring(0, 16)}..., WASM VK=${actualWasmVk.substring(0, 16)}...`);
                  console.warn(`   Using actual WASM VK for binary key to ensure match`);
                  // Use actual WASM VK instead of spell VK
                  binaries[actualWasmVk] = base64Wasm;
                  console.log(`✅ Added binary for WASM VK: ${actualWasmVk} (corrected from spell VK: ${appVk.substring(0, 16)}...)`);
                } else {
                  binaries[appVk] = base64Wasm;
                  if (actualWasmVk) {
                    console.log(`✅ Added binary for app VK: ${appVk} (matches WASM VK)`);
                  } else {
                    console.log(`✅ Added binary for app VK: ${appVk} (extracted from: ${appIdStr.substring(0, 50)}...)`);
                  }
                }
              } else if (parts.length === 2) {
                // Format: "n/<app_id>" (missing app_vk) - use instance VK if available
                const appId = parts[1];
                const appVk = this.appVk || '';
                if (appVk) {
                  binaries[appVk] = base64Wasm;
                  console.log(`✅ Added binary for app VK: ${appVk} (using instance VK for app_id: ${appId})`);
                } else {
                  console.warn(`⚠️ No VK available for app_id ${appId}, cannot create binary mapping without VK`);
                  console.warn(`   Expected format: n/<app_id>/<app_vk> with VK in spell`);
                }
              } else {
                // Fallback: use full string if format is unexpected
                console.warn(`⚠️ Unexpected app ID format: ${appIdStr}, using as-is`);
                binaries[appIdStr] = base64Wasm;
              }
            }
          } else {
            // Fallback: if we can't find app IDs, use instance VK
            if (this.appVk) {
              binaries[this.appVk] = base64Wasm;
              console.log(`✅ Added binary using instance VK: ${this.appVk.substring(0, 16)}...`);
            } else {
              console.warn(`⚠️ No app IDs found in spell.apps and no instance VK available`);
            }
          }
          
          const totalVks = Object.values(binaries).reduce((sum, vkMap) => sum + (typeof vkMap === 'object' && vkMap !== null ? Object.keys(vkMap).length : 0), 0);
          console.log(`✅ Binaries object populated with ${Object.keys(binaries).length} app_id(s), ${totalVks} VK mapping(s) (WASM size: ${base64Wasm.length} chars base64)`);
          
          // Validate that all app IDs from spell have corresponding binaries
          if (spellObj.apps && typeof spellObj.apps === 'object') {
            const spellAppIds = Object.values(spellObj.apps);
            const binaryKeys = Object.keys(binaries);

            // Check for missing binaries
            // Extract VK (app_vk) from full format for comparison (matches binary key generation)
            const missingBinaries = spellAppIds.filter((appId: any) => {
              const appIdStr = String(appId);
              const parts = appIdStr.split('/');
              // Extract VK (app_vk) from full format "n/<app_id>/<app_vk>" - this is the binary key
              const binaryKey = parts.length >= 3 ? parts[2] : (parts.length === 2 ? (this.appVk || '') : appIdStr);
              if (!binaryKey) {
                return true; // Missing VK
              }
              return !binaries[binaryKey];
            });
            
            if (missingBinaries.length > 0 && !mockMode) {
              console.error('❌ Binary mapping validation failed:');
              console.error(`   Spell requires ${spellAppIds.length} app ID(s), but ${missingBinaries.length} are missing binaries`);
              console.error(`   Missing app IDs: ${missingBinaries.map((id: any) => String(id)).join(', ')}`);
              console.error(`   Binary keys provided: ${binaryKeys.length > 0 ? binaryKeys.join(', ') : 'NONE'}`);
              throw new Error(
                `Missing binaries for app IDs: ${missingBinaries.map((id: any) => String(id)).join(', ')}. ` +
                `Spell requires these app IDs but binaries were not provided. ` +
                `This usually means the app binary build failed or app IDs don't match. ` +
                `Verify that tokenId in the spell matches the app_id from the original mint.`
              );
            }
            
            // Log detailed binary mapping for debugging
            console.log(`📋 Binary mapping verification:`);
            Object.entries(spellObj.apps).forEach(([key, appId]: [string, any]) => {
              const appIdStr = String(appId);
              const parts = appIdStr.split('/');
              // Extract VK (app_vk) from full format "n/<app_id>/<app_vk>" - this is the binary key
              const binaryKey = parts.length >= 3 ? parts[2] : (parts.length === 2 ? (this.appVk || '') : appIdStr);
              const hasBinary = binaryKey ? !!binaries[binaryKey] : false;
              const binaryLength = binaryKey && binaries[binaryKey] ? String(binaries[binaryKey]).length : 0;
              const keyInfo = binaryKey ? `VK: ${binaryKey}` : 'VK: MISSING';
              console.log(`   ${key}: ${appIdStr.substring(0, 80)}... -> binary key (${keyInfo}) -> ${hasBinary ? `✅ included (${binaryLength} chars)` : '❌ MISSING'}`);
            });
            
            if (missingBinaries.length === 0 && !mockMode) {
              console.log(`✅ All spell app IDs have corresponding binaries (${spellAppIds.length} app ID(s) validated)`);
              
              // For redeem, we need binaries for both NFT ($00) and Token ($01) apps
              const hasNftApp = Object.values(spellObj.apps).some((app: any) => String(app).startsWith('n/'));
              const hasTokenApp = Object.values(spellObj.apps).some((app: any) => String(app).startsWith('t/'));
              
              if (hasNftApp && hasTokenApp && !mockMode) {
                console.log(`📋 Redeem operation detected: NFT + Token apps both require binaries`);
                console.log(`   Both apps share the same VK (same app instance) - binary keyed by VK`);
                // Both should use the same VK (same app instance)
                // Validation already checks all apps have binaries above
              }
            }
          }
        } catch (binError: any) {
          console.error(`❌ Failed to read/encode app binary: ${binError.message}`);
          if (!mockMode) {
            throw new Error(`Failed to include app binary: ${binError.message}. Redeem operations require the binary to execute app logic.`);
          }
          console.warn('⚠️ Continuing without binary (mock mode may still fail)');
        }
      } else {
        console.warn('⚠️ No app binary provided - Prover API will likely reject the request');
        if (!mockMode) {
          throw new Error(
            'App binary is required but not provided. Redeem operations require the binary to execute app logic. ' +
            'Build the app first: cd gift-cards && cargo build --release --target wasm32-wasip1'
          );
        }
      }
      
      // Validate that binaries are included for redeem operations
      // Redeem requires binary execution, so we must have binaries in the payload
      if (!mockMode && Object.keys(binaries).length === 0) {
        throw new Error(
          'Binaries object is empty but required for redeem operation. ' +
          'Redeem must execute app logic to validate and update state. ' +
          'Please ensure the app binary is built and included.'
        );
      }
      
      if (mockMode) {
        const totalVks = Object.values(binaries).reduce((sum, vkMap) => sum + (typeof vkMap === 'object' && vkMap !== null ? Object.keys(vkMap).length : 0), 0);
        console.log(`ℹ️ Mock mode enabled - binaries: ${Object.keys(binaries).length > 0 ? `${Object.keys(binaries).length} app_id(s), ${totalVks} VK mapping(s)` : 'empty (will cause errors)'}`);
      }
      
      // Ensure version is 8 in the spell object (not at top level per reference implementation)
      if (!spellObj.version) {
        spellObj.version = 8;
      } else if (spellObj.version !== 8) {
        spellObj.version = 8; // Force version to 8
        console.warn('⚠️ Spell version was not 8, setting to 8');
      }
      
      // Create a clean spell object for the Prover API
      // Include all fields from the spell - private_inputs is needed for minting operations
      // Based on example spells: mint-nft.yaml uses private_inputs for minting
      const cleanSpell: any = {
        version: spellObj.version,
        apps: spellObj.apps,
        ins: spellObj.ins,
        outs: spellObj.outs,
      };
      
      // Include public_inputs if present (needed for redeem operations)
      // Even though contract checks x == empty, Prover API/WASM runtime may require this field
      if (spellObj.public_inputs) {
        cleanSpell.public_inputs = spellObj.public_inputs;
        console.log('✅ Including public_inputs in spell (required for state transition operations)');
      }
      
      // Always include private_inputs if present in spell
      // It's optional per docs but needed for minting operations (see mint-nft.yaml example)
      if (spellObj.private_inputs) {
        cleanSpell.private_inputs = spellObj.private_inputs;
        console.log('✅ Including private_inputs in spell (required for minting operations)');
      }
      
      // Build payload matching Prover API requirements
      // Reference: https://docs.charms.dev/guides/wallet-integration/transactions/prover-api/
      // Note: API error confirms prev_txs must be enum variant format: [{ "bitcoin": "hex" }, ...]
      // The official docs example shows raw strings, but actual API requires enum variant
      // We only use Bitcoin - "cardano" in error messages is just API indicating it supports both chains
      const payload: any = {
        spell: cleanSpell, // Use cleaned spell object
        binaries: binaries, // Empty object {} when no binary available (per official docs)
        prev_txs: prevTxsArray, // Array of enum variant objects: [{ "bitcoin": "hex_string" }, ...]
        chain: 'bitcoin', // Bitcoin only - we don't use Cardano
        funding_utxo: undefined, // Will be set below
        funding_utxo_value: undefined, // Will be set below
        change_address: undefined, // Will be set below
        fee_rate: undefined, // Will be set below
      };
      
      // Note: Official docs do not show a mock flag in the payload
      // The empty binaries object {} is sufficient when no binary is available
      
      // Add required funding fields (all required per Prover API docs)
      if (!fundingUtxo) {
        throw new Error('funding_utxo is required by Prover API but was not provided');
      }
      payload.funding_utxo = fundingUtxo;
      
      if (fundingUtxoValue === undefined || fundingUtxoValue === null) {
        throw new Error('funding_utxo_value is required by Prover API but was not provided');
      }
      payload.funding_utxo_value = fundingUtxoValue;
      
      if (!changeAddress) {
        throw new Error('change_address is required by Prover API but was not provided');
      }
      payload.change_address = changeAddress;
      
      // Fee rate in sats per byte (default 2.0 as per docs)
      if (feeRate === undefined || feeRate === null) {
        feeRate = 2.0; // Default from docs
      }
      payload.fee_rate = feeRate;
      
      // Validate spell outputs have sats field (required for Bitcoin)
      if (spellObj.outs && Array.isArray(spellObj.outs)) {
        for (let i = 0; i < spellObj.outs.length; i++) {
          const output = spellObj.outs[i];
          if (!output.sats && output.sats !== 0) {
            console.warn(`⚠️ Output ${i} missing 'sats' field - adding default 1000 sats`);
            output.sats = 1000; // Default dust amount
          }
        }
      }
      
      // Log payload for debugging (without sensitive data)
      console.log('📤 Sending proof request to Prover API...');
      console.log(`   URL: ${this.proverUrl}`);
      console.log(`   Spell version: ${payload.spell?.version || 'NOT SET'}`);
      console.log(`   Chain: ${payload.chain || 'NOT SET'}`);
      console.log(`   Mock mode: ${mockMode} (using empty binaries object {} per official docs)`);
      console.log(`   📤 Sending to Prover API: ${this.proverUrl}`);
      
      // Detailed binary logging
      const binaryKeys = Object.keys(payload.binaries || {});
      const spellAppIds = spellObj.apps ? Object.values(spellObj.apps).map((id: any) => String(id)) : [];
      // Binary keys use flat structure: { VK: base64Wasm } per documentation
      // Extract VK (app_vk) from spell app identifiers for comparison
      const binaryKeysFromSpell = spellAppIds.map((id: string) => {
        const parts = id.split('/');
        // Extract only the VK (app_vk) (parts[2]) from "n/<app_id>/<app_vk>"
        return parts.length >= 3 ? parts[2] : (parts.length === 2 ? (this.appVk || '') : id);
      }).filter(vk => vk); // Filter out empty VKs
      
      console.log(`   📦 Binary Key Format: Using VK (app_vk) as key per documentation`);
      console.log(`   Binaries: ${binaryKeys.length > 0 ? `${binaryKeys.length} entry/entries` : 'empty object {}'}`);
      
      // Log flat structure
      if (payload.binaries && Object.keys(payload.binaries).length > 0) {
        binaryKeys.forEach((key, idx) => {
          const binaryValue = payload.binaries[key];
          const binarySize = typeof binaryValue === 'string' ? binaryValue.length : 0;
          console.log(`   Binary key ${idx + 1} (VK): ${key} (${binarySize} chars base64)`);
        });
      }
      
      if (spellAppIds.length > 0) {
        console.log(`   Spell app IDs (full format): ${spellAppIds.map(id => id.substring(0, 60) + '...').join(', ')}`);
        // Log full spell app IDs and extracted VKs for comparison
        spellAppIds.forEach((id, idx) => {
          const parts = id.split('/');
          const extractedVk = parts.length >= 3 ? parts[2] : (parts.length === 2 ? (this.appVk || 'MISSING') : id);
          const extractedAppId = parts.length >= 3 ? parts[1] : (parts.length === 2 ? parts[1] : 'N/A');
          console.log(`   Spell app ID ${idx + 1}: ${id.substring(0, 60)}... -> app_id: ${extractedAppId}, VK: ${extractedVk.substring(0, 20)}...`);
        });
        console.log(`   Binary keys required (VK extracted): ${binaryKeysFromSpell.map(k => k.substring(0, 20) + '...').join(', ')}`);
        // Check if all binary keys have binaries (using VK comparison)
        const missing = binaryKeysFromSpell.filter(key => key && !binaryKeys.includes(key));
        if (missing.length > 0 && !mockMode) {
          console.error(`   ❌ MISSING binaries for VKs: ${missing.map(k => k.substring(0, 20) + '...').join(', ')}`);
          console.error(`   Expected format: 64-character hex string (VK/app_vk per documentation)`);
          missing.forEach((key, idx) => {
            console.error(`   Missing VK ${idx + 1}: ${key}`);
          });
        } else if (missing.length === 0 && !mockMode && binaryKeysFromSpell.length > 0) {
          console.log(`   ✅ All required binary keys have binaries (using VK format per documentation)`);
          console.log(`   ✅ Binary key format matches Prover API requirements - ready to send`);
        }
      }
      
      console.log(`   Funding UTXO: ${payload.funding_utxo || 'NOT SET'}`);
      console.log(`   Funding UTXO value: ${payload.funding_utxo_value || 'NOT SET'} sats`);
      console.log(`   Change address: ${payload.change_address ? payload.change_address.substring(0, 20) + '...' : 'NOT SET'}`);
      console.log(`   Fee rate: ${payload.fee_rate} sats/vB`);
      console.log(`   Prev TXs: ${payload.prev_txs?.length || 0} (enum variant format: [{ bitcoin: "hex" }, ...])`);
      if (payload.prev_txs && payload.prev_txs.length > 0) {
        payload.prev_txs.forEach((tx: { bitcoin: string } | string, i: number) => {
          const hex = typeof tx === 'string' ? tx : (tx as { bitcoin: string }).bitcoin;
          const hexLength = hex ? hex.length : 0;
          const hexStart = hex ? hex.substring(0, 16) : 'N/A';
          console.log(`     Prev TX ${i}: ${hexLength} chars, starts with ${hexStart}...`);
        });
      } else {
        console.warn(`   ⚠️ WARNING: prev_txs is empty but spell has ${spellObj.ins?.length || 0} input(s)`);
      }
      console.log(`   Spell version: ${payload.spell?.version}`);
      console.log(`   Spell apps: ${Object.keys(payload.spell?.apps || {}).length} apps`);
      console.log(`   Spell inputs: ${payload.spell?.ins?.length || 0}`);
      if (spellObj.ins && Array.isArray(spellObj.ins)) {
        spellObj.ins.forEach((input: any, i: number) => {
          console.log(`     Input ${i}: utxo_id=${input.utxo_id || 'MISSING'}`);
        });
      }
      console.log(`   Spell outputs: ${payload.spell?.outs?.length || 0}`);
      
      // Log output details for debugging
      if (spellObj.outs && Array.isArray(spellObj.outs)) {
        spellObj.outs.forEach((out: any, i: number) => {
          console.log(`   Output ${i}: address=${out.address?.substring(0, 20)}..., sats=${out.sats || 'MISSING'}, charms=${Object.keys(out.charms || {}).length}`);
        });
      }
      
      // Investigate spell structure for package topology
      console.log('🔍 Investigating spell structure for package topology...');
      console.log(`   Spell inputs (${spellObj.ins?.length || 0}):`);
      if (spellObj.ins && Array.isArray(spellObj.ins)) {
        spellObj.ins.forEach((input: any, i: number) => {
          console.log(`     Input ${i}: utxo_id=${input.utxo_id || 'MISSING'}, charms=${Object.keys(input.charms || {}).length}`);
        });
      }
      console.log(`   Note: In Charms protocol, the spell should reference the commit transaction's output.`);
      console.log(`   However, the commit transaction doesn't exist yet when creating the spell.`);
      console.log(`   The Prover API should generate: (1) commit TX spending original UTXO, (2) spell TX spending commit output.`);
      console.log(`   Current spell references original UTXO: ${spellObj.ins?.[0]?.utxo_id || 'unknown'}`);
      console.log(`   This is correct - the Prover API will handle creating the commit TX and making spell spend it.`);
      
      // Final safety check: Ensure prev_txs is in enum variant format (API requirement)
      // API error confirms: "expected `bitcoin` or `cardano`" - this is Rust enum deserialization
      if (payload.prev_txs && Array.isArray(payload.prev_txs)) {
        payload.prev_txs = payload.prev_txs.map((tx: any, index: number) => {
          if (typeof tx === 'string') {
            // Validate and convert string to enum variant format
            if (!/^[0-9a-fA-F]+$/.test(tx)) {
              throw new Error(`Invalid prev_txs[${index}]: not a valid hex string`);
            }
            return { bitcoin: tx }; // Convert to enum variant format
          } else if (tx && typeof tx === 'object' && 'bitcoin' in tx) {
            // Validate bitcoin field
            if (typeof tx.bitcoin !== 'string') {
              throw new Error(`Invalid prev_txs[${index}].bitcoin: expected string, got ${typeof tx.bitcoin}`);
            }
            if (!/^[0-9a-fA-F]+$/.test(tx.bitcoin)) {
              throw new Error(`Invalid prev_txs[${index}].bitcoin: not a valid hex string`);
            }
            return tx; // Already in correct enum variant format
          } else {
            throw new Error(`Invalid prev_txs[${index}] format: expected string or object with 'bitcoin' field, got ${typeof tx}`);
          }
        });
        console.log('✅ prev_txs format verified - all elements are { bitcoin: "hex" } enum variant objects');
      }
      
      // Comprehensive logging of payload structure before sending
      console.log('📤 Payload being sent to Prover API:');
      console.log(`   URL: ${this.proverUrl}`);
      console.log(`   Spell version: ${payload.spell?.version || 'MISSING'}`);
      console.log(`   Chain: ${payload.chain || 'MISSING'}`);
      console.log(`   prev_txs array length: ${payload.prev_txs?.length || 0}`);
      
      // Log spell structure for redeem debugging
      if (payload.spell?.ins && payload.spell.ins.length > 0) {
        const firstInput = payload.spell.ins[0];
        console.log('🔍 SPELL INPUT DEBUG:');
        console.log(`   UTXO ID: ${firstInput.utxo_id}`);
        if (firstInput.charms?.['$00']) {
          const nft = firstInput.charms['$00'];
          console.log(`   NFT remaining_balance: ${nft.remaining_balance}`);
          console.log(`   NFT initial_amount: ${nft.initial_amount}`);
        }
        if (firstInput.charms?.['$01']) {
          console.log(`   Token amount ($01): ${firstInput.charms['$01']}`);
        }
      }
      if (payload.spell?.outs && payload.spell.outs.length > 0) {
        console.log('🔍 SPELL OUTPUT DEBUG:');
        payload.spell.outs.forEach((out: any, idx: number) => {
          console.log(`   Output ${idx + 1}:`);
          console.log(`     Address: ${out.address?.substring(0, 20)}...`);
          console.log(`     Has NFT ($00): ${out.charms?.['$00'] ? 'YES' : 'NO'}`);
          if (out.charms?.['$01']) {
            console.log(`     Token amount ($01): ${out.charms['$01']}`);
          }
        });
      }
      console.log(`   prev_txs type: ${Array.isArray(payload.prev_txs) ? 'array of enum variant objects [{ bitcoin: "hex" }]' : typeof payload.prev_txs}`);
      
      if (payload.prev_txs && payload.prev_txs.length > 0) {
        payload.prev_txs.forEach((tx: { bitcoin: string } | string, index: number) => {
          console.log(`   prev_txs[${index}]:`);
          console.log(`     - Type: ${typeof tx}`);
          console.log(`     - Is object: ${typeof tx === 'object' && tx !== null}`);
          console.log(`     - Has 'bitcoin' field: ${tx && typeof tx === 'object' && 'bitcoin' in tx}`);
          if (tx && typeof tx === 'object' && 'bitcoin' in tx) {
            const hexLength = typeof tx.bitcoin === 'string' ? tx.bitcoin.length : 0;
            const hexStart = typeof tx.bitcoin === 'string' ? tx.bitcoin.substring(0, 32) : 'N/A';
            console.log(`     - bitcoin field type: ${typeof tx.bitcoin}`);
            console.log(`     - bitcoin hex length: ${hexLength} chars`);
            console.log(`     - bitcoin hex start: ${hexStart}...`);
            console.log(`     - Valid hex: ${typeof tx.bitcoin === 'string' ? /^[0-9a-fA-F]+$/.test(tx.bitcoin) : false}`);
          }
        });
      }
      
      // Log a sample of the actual JSON that will be sent (truncated for readability)
      const payloadSample = {
        chain: payload.chain,
        spell: { ...payload.spell, version: payload.spell?.version },
        binaries: payload.binaries,
        ...payload,
        prev_txs: payload.prev_txs?.map((tx: { bitcoin: string } | string) => {
          // prev_txs are enum variant objects: { bitcoin: "hex" }
          if (tx && typeof tx === 'object' && 'bitcoin' in tx) {
            return { bitcoin: typeof tx.bitcoin === 'string' ? `${tx.bitcoin.substring(0, 32)}... (${tx.bitcoin.length} chars)` : 'INVALID' };
          }
          return 'INVALID';
        }),
      };
      console.log('   Payload sample (prev_txs truncated):', JSON.stringify(payloadSample, null, 2).substring(0, 800) + '...');
      console.log('   ✅ Required fields check:');
      console.log(`      - spell.version: ${payload.spell?.version ? `✅ present (${payload.spell.version})` : '❌ MISSING'}`);
      console.log(`      - chain: ${payload.chain ? '✅ present' : '❌ MISSING'}`);
      console.log(`      - spell: ${payload.spell ? '✅ present' : '❌ MISSING'}`);
      console.log(`      - binaries: ${payload.binaries ? `✅ present (${Object.keys(payload.binaries).length} entries)` : '❌ MISSING'}`);
      console.log(`      - prev_txs: ${payload.prev_txs ? '✅ present' : '❌ MISSING'}`);
      
      // Log spell apps to see if they reference binaries
      if (payload.spell && payload.spell.apps) {
        console.log(`   Spell apps: ${Object.keys(payload.spell.apps).length} app(s) referenced`);
        Object.entries(payload.spell.apps).forEach(([key, value]: [string, any]) => {
          console.log(`     - ${key}: ${typeof value === 'string' ? value.substring(0, 50) + '...' : JSON.stringify(value)}`);
        });
      }
      
      // Log binaries structure (flat format: { APP_ID: base64Wasm })
      console.log(`   Binaries: ${Object.keys(payload.binaries || {}).length} entry/entries`);
      if (payload.binaries && Object.keys(payload.binaries).length > 0) {
        Object.entries(payload.binaries).forEach(([appId, binary]: [string, any]) => {
          const binaryValue = typeof binary === 'string' ? (binary.length > 0 ? `${binary.substring(0, 20)}... (${binary.length} chars)` : 'empty string') : JSON.stringify(binary);
          console.log(`     - App ID: ${appId.substring(0, 16)}...: ${binaryValue}`);
        });
      } else {
        console.log(`     - Binaries object is empty`);
      }
      
      // Final validation: Ensure entire payload structure matches Prover API requirements
      // Based on reference implementation: https://github.com/RidwanOseni/charmbills/blob/main/charmbills-backend/src/charms/proverClient.ts
      
      // Validate spell version (should be in spell object, not top level)
      if (!payload.spell.version || payload.spell.version !== 8) {
        throw new Error('Payload validation failed: spell.version must be 8');
      }
      if (!payload.chain || payload.chain !== 'bitcoin') {
        throw new Error('Payload validation failed: chain must be "bitcoin" at top level');
      }
      if (!payload.spell || typeof payload.spell !== 'object') {
        throw new Error('Payload validation failed: spell must be an object');
      }
      if (!payload.binaries || typeof payload.binaries !== 'object') {
        throw new Error('Payload validation failed: binaries must be an object');
      }
      
      // Log final payload state before sending
      if (mockMode) {
        console.log('🔍 Final payload check - Mock mode enabled:');
        console.log(`   payload.binaries = ${JSON.stringify(payload.binaries)} (should be empty object {})`);
      }
      
      // Validate prev_txs format: enum variant format required by API
      // API error confirms: "expected `bitcoin` or `cardano`" - Rust enum deserialization
      if (payload.prev_txs && Array.isArray(payload.prev_txs)) {
        const isValid = payload.prev_txs.every((tx: any) => {
          return tx && 
                 typeof tx === 'object' && 
                 'bitcoin' in tx && 
                 typeof tx.bitcoin === 'string' &&
                 tx.bitcoin.length > 0 &&
                 /^[0-9a-fA-F]+$/.test(tx.bitcoin); // Valid hex string
        });
        
        if (!isValid) {
          console.error('❌ CRITICAL: prev_txs format validation failed!');
          console.error('   Expected: [{ "bitcoin": "hex_string" }, ...] (enum variant format)');
          console.error('   Actual:', JSON.stringify(payload.prev_txs).substring(0, 200));
          throw new Error('prev_txs format is invalid. Each element must be an object with a "bitcoin" field containing a valid hex string.');
        }
        
        console.log('✅ prev_txs format validation passed - all elements are { bitcoin: "hex" } enum variant objects');
      }
      
      // Validate funding fields
      if (!payload.funding_utxo || typeof payload.funding_utxo !== 'string') {
        throw new Error('Payload validation failed: funding_utxo is required');
      }
      if (payload.funding_utxo_value === undefined || payload.funding_utxo_value === null) {
        throw new Error('Payload validation failed: funding_utxo_value is required');
      }
      if (!payload.change_address || typeof payload.change_address !== 'string') {
        throw new Error('Payload validation failed: change_address is required');
      }
      if (payload.fee_rate === undefined || payload.fee_rate === null) {
        throw new Error('Payload validation failed: fee_rate is required');
      }
      
      console.log('✅ Payload structure validation passed - all required fields present and correctly formatted');
      
      // Try using charms CLI spell prove command first (handles formatting correctly)
      // If that fails, fall back to direct API call
      const useCli = process.env.USE_CHARMS_CLI !== 'false'; // Default to true
      
      if (useCli) {
        try {
          const cliStartTime = Date.now();
          console.log('🔧 Attempting to use charms spell prove CLI command...');
          
          // Prepare spell YAML file temporarily
          const tempSpellPath = path.join(this.appPath, '.temp-spell.yaml');
          const fileWriteStart = Date.now();
          await fs.writeFile(tempSpellPath, spellYaml, 'utf-8');
          console.log(`   ⏱️  File write: ${Date.now() - fileWriteStart}ms`);
          
          // Build command arguments for charms spell prove
          // Note: CLI expects comma-separated hex strings for prev_txs (raw hex, not enum variant)
          // Extract hex strings from enum variant format
          const prevTxsHexStrings = prevTxsArray.map((tx: { bitcoin: string }) => tx.bitcoin);
          const prevTxsForCli = prevTxsHexStrings.join(',');
          
          const cliArgs: string[] = [
            'spell', 'prove',
            '--spell', tempSpellPath,
            '--funding-utxo', fundingUtxo!,
            '--funding-utxo-value', fundingUtxoValue!.toString(),
            '--change-address', changeAddress!,
            '--fee-rate', feeRate.toString(),
            '--chain', 'bitcoin',
          ];
          
          if (prevTxsForCli) {
            cliArgs.push('--prev-txs', prevTxsForCli);
          }
          
          if (appBin) {
            cliArgs.push('--app-bins', appBin);
          }
          
          if (mockMode) {
            cliArgs.push('--mock');
          }
          
          const command = `cd ${this.appPath} && charms ${cliArgs.join(' ')}`;
          console.log(`   Running: charms ${cliArgs.join(' ')}`);
          console.log(`   ⏱️  Starting proof generation (this may take 30-120 seconds)...`);
          
          // Add timeout wrapper for CLI command (180 seconds)
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('CLI command timed out after 180 seconds')), 180000);
          });
          
          const execPromise = execAsync(command, {
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          });
          
          const execStartTime = Date.now();
          const { stdout, stderr } = await Promise.race([execPromise, timeoutPromise]) as { stdout: string; stderr: string };
          const execDuration = Date.now() - execStartTime;
          const totalCliDuration = Date.now() - cliStartTime;
          console.log(`   ⏱️  CLI execution: ${execDuration}ms (${(execDuration / 1000).toFixed(1)}s)`);
          console.log(`   ⏱️  Total CLI time: ${totalCliDuration}ms (${(totalCliDuration / 1000).toFixed(1)}s)`);
          
          // Clean up temp file
          try {
            await fs.unlink(tempSpellPath);
          } catch (e) {
            // Ignore cleanup errors
          }
          
          // Parse CLI output - should be JSON array: ["commit_tx", "spell_tx"]
          // Or might be in a different format, let's check
          let txArray: string[];
          try {
            // Try parsing as JSON first
            const jsonMatch = stdout.match(/\[.*\]/s);
            if (jsonMatch) {
              txArray = JSON.parse(jsonMatch[0]);
            } else {
              // Might be newline-separated or in a different format
              const lines = stdout.trim().split('\n').filter(l => l.trim().length > 0);
              if (lines.length >= 2) {
                txArray = [lines[lines.length - 2], lines[lines.length - 1]];
              } else {
                throw new Error('Could not parse CLI output');
              }
            }
          } catch (parseError: any) {
            console.warn('⚠️ Failed to parse CLI output, falling back to API call');
            throw new Error(`CLI output parse error: ${parseError.message}`);
          }
          
          if (!Array.isArray(txArray) || txArray.length !== 2) {
            throw new Error(`CLI returned invalid format: expected array of 2 transactions, got ${JSON.stringify(txArray)}`);
          }
          
          // Handle enum variant format if CLI returns it
          const commitTx = typeof txArray[0] === 'string' ? txArray[0] : (txArray[0] as any)?.bitcoin || txArray[0];
          const spellTx = typeof txArray[1] === 'string' ? txArray[1] : (txArray[1] as any)?.bitcoin || txArray[1];
          
          console.log('✅ Proof generated successfully using charms CLI');
          
          // Validate proof transactions have correct package topology
          const network = process.env.BITCOIN_NETWORK || 'testnet4';
          console.log('🔍 Validating proof transaction topology...');
          const validation = await validateProofTransactions(commitTx, spellTx, network);
          
          if (!validation.valid) {
            console.error('❌ Proof validation failed:', validation.reason);
            if (validation.diagnostics) {
              console.error('📋 Validation diagnostics:', JSON.stringify(validation.diagnostics, null, 2));
              console.error(`   Commit TX: ${validation.diagnostics.commitTxid}`);
              console.error(`     Inputs: ${validation.diagnostics.commitInputs}, Outputs: ${validation.diagnostics.commitOutputs}`);
              console.error(`     Input UTXOs: ${validation.diagnostics.commitInputHashes?.join(', ')}`);
              console.error(`     Output hashes: ${validation.diagnostics.commitOutputHashes?.join(', ')}`);
              console.error(`   Spell TX: parsed`);
              console.error(`     Inputs: ${validation.diagnostics.spellInputs}, Outputs: ${validation.diagnostics.spellOutputs}`);
              console.error(`     Input hashes: ${validation.diagnostics.spellInputHashes?.join(', ')}`);
              console.error(`   Matching inputs: ${validation.diagnostics.matchingInputs}`);
              
              // Check if transactions might be swapped
              console.error('🔍 Checking if transactions are in correct order...');
              const swappedValidation = await validateProofTransactions(spellTx, commitTx, network);
              if (swappedValidation.valid) {
                console.error('⚠️ WARNING: Transactions appear to be swapped! Spell TX spends Commit TX when order is reversed.');
                console.error('   This suggests the CLI returned transactions in wrong order.');
                throw new Error(`Proof generation failed validation: Transactions appear to be in wrong order. When swapped, the topology is correct. The CLI may have returned [spell_tx, commit_tx] instead of [commit_tx, spell_tx].`);
              }
            }
            throw new Error(`Proof generation failed validation: ${validation.reason}. The spell transaction does not spend the commit transaction's output. This indicates an issue with the proof generation - the Prover API/CLI may have generated incorrect transactions.`);
          }
          
          console.log(`✅ Proof validation passed: spell transaction spends commit output (${validation.diagnostics?.matchingInputs} matching input(s))`);
          
          // IMPORTANT: Charms CLI/Prover API broadcasts transactions internally
          // A successful response means both commit and spell transactions have already been broadcast
          console.log('✅ Proof generated successfully - transactions already broadcast by Charms');
          console.log('   Package submission performed internally by Charms Prover API using full nodes. No separate broadcast step required.');
          
          // Extract TXIDs from transaction hex
          const commitTxid = await computeTxid(commitTx);
          const spellTxid = await computeTxid(spellTx);
          
          console.log(`   Commit TXID: ${commitTxid}`);
          console.log(`   Spell TXID: ${spellTxid}`);
          
          return {
            commit_tx: commitTx,
            spell_tx: spellTx,
            commit_txid: commitTxid,
            spell_txid: spellTxid,
            broadcasted: true, // Indicates already broadcast
          };
        } catch (cliError: any) {
          console.warn('⚠️ charms CLI spell prove failed, falling back to direct API call');
          console.warn(`   CLI error: ${cliError.message}`);
          if (cliError.stderr) {
            console.warn(`   CLI stderr: ${cliError.stderr.substring(0, 500)}`);
          }
          // Fall through to API call
        }
      }
      
      // Fall back to direct Prover API call
      const apiStartTime = Date.now();
      console.log('📡 Using direct Prover API call (charms CLI not available or failed)');
      console.log(`   ⏱️  Starting API proof generation (this may take 30-120 seconds)...`);
      
      // Log the exact payload being sent (for debugging - compare with official docs example)
      console.log('📋 EXACT PAYLOAD BEING SENT (for comparison with official docs):');
      const debugPayload = {
        spell: {
          version: payload.spell.version,
          apps: payload.spell.apps,
          private_inputs: payload.spell.private_inputs ? 'present' : 'missing',
          ins: payload.spell.ins?.map((inp: any) => ({
            utxo_id: inp.utxo_id,
            charms: Object.keys(inp.charms || {}).length + ' charm(s)'
          })),
          outs: payload.spell.outs?.map((out: any) => ({
            address: out.address?.substring(0, 20) + '...',
            sats: out.sats,
            charms: Object.keys(out.charms || {}).length + ' charm(s)'
          }))
        },
        binaries: payload.binaries,
        prev_txs: payload.prev_txs?.map((tx: { bitcoin: string }) => `${tx.bitcoin.substring(0, 32)}... (${tx.bitcoin.length} chars)`),
        chain: payload.chain,
        funding_utxo: payload.funding_utxo,
        funding_utxo_value: payload.funding_utxo_value,
        change_address: payload.change_address?.substring(0, 20) + '...',
        fee_rate: payload.fee_rate
      };
      console.log(JSON.stringify(debugPayload, null, 2));
      
      // Log full spell structure to see if private_inputs is causing issues
      console.log('📋 FULL SPELL STRUCTURE:');
      console.log(JSON.stringify({
        version: payload.spell.version,
        apps: payload.spell.apps,
        private_inputs: payload.spell.private_inputs,
        ins: payload.spell.ins,
        outs: payload.spell.outs
      }, null, 2));
      
      const apiRequestStart = Date.now();
      
      // Retry logic with exponential backoff for network/timeout errors
      const maxRetries = 3;
      const retryDelays = [30000, 60000, 90000]; // 30s, 60s, 90s
      let lastError: any = null;
      let response: any = null;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            console.log(`   🔄 Retry attempt ${attempt + 1}/${maxRetries} after ${retryDelays[attempt - 1] / 1000}s delay...`);
            await new Promise(resolve => setTimeout(resolve, retryDelays[attempt - 1]));
          }
          
          response = await axios.post(this.proverUrl, payload, {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 180000, // 180 seconds (3 minutes) timeout for proof generation
          });
          
          // Success - break out of retry loop
          if (attempt > 0) {
            console.log(`   ✅ Request succeeded on attempt ${attempt + 1}`);
          }
          break;
        } catch (retryError: any) {
          lastError = retryError;
          const isRetryableError = 
            retryError.code === 'ETIMEDOUT' ||
            retryError.code === 'ECONNABORTED' ||
            retryError.code === 'ECONNREFUSED' ||
            retryError.code === 'ENOTFOUND' ||
            retryError.code === 'ECONNRESET' ||
            (retryError.message && retryError.message.includes('timeout')) ||
            (!retryError.response && retryError.request); // Network error without response
          
          if (isRetryableError && attempt < maxRetries - 1) {
            console.warn(`   ⚠️  Request failed (attempt ${attempt + 1}/${maxRetries}): ${retryError.code || retryError.message}`);
            console.warn(`   Will retry in ${retryDelays[attempt] / 1000}s...`);
            continue;
          } else {
            // Not retryable or last attempt - throw the error
            throw retryError;
          }
        }
      }
      
      if (!response) {
        throw lastError || new Error('Failed to get response from Prover API after retries');
      }
      
      const apiRequestDuration = Date.now() - apiRequestStart;
      const totalApiDuration = Date.now() - apiStartTime;
      console.log(`   ⏱️  API request: ${apiRequestDuration}ms (${(apiRequestDuration / 1000).toFixed(1)}s)`);
      console.log(`   ⏱️  Total API time: ${totalApiDuration}ms (${(totalApiDuration / 1000).toFixed(1)}s)`);
      
      // API returns array: ["hex_encoded_commit_tx", "hex_encoded_spell_tx"]
      // Per documentation: The response is an array of exactly 2 hex-encoded transactions
      // These transactions are already broadcast by the Prover API using Charms' full nodes
      const txArray = response.data;
      
      if (!Array.isArray(txArray)) {
        throw new Error('Invalid response format from Prover API. Expected array, got: ' + typeof txArray);
      }
      
      if (txArray.length !== 2) {
        throw new Error(`Invalid response format from Prover API. Expected array of 2 transaction hex strings, got ${txArray.length} items.`);
      }

      console.log('✅ Proof generated successfully via Prover API');
      console.log('   Response format: Array of 2 hex-encoded transactions (commit_tx, spell_tx)');
      console.log('   Transactions are already broadcast by Charms Prover API infrastructure');
      
      // Extract transaction hex strings (handle enum variant format if present)
      const commitTx = typeof txArray[0] === 'string' ? txArray[0] : (txArray[0] as any)?.bitcoin || txArray[0];
      const spellTx = typeof txArray[1] === 'string' ? txArray[1] : (txArray[1] as any)?.bitcoin || txArray[1];
      
      // Validate proof transactions have correct package topology
      const network = process.env.BITCOIN_NETWORK || 'testnet4';
      console.log('🔍 Validating proof transaction topology...');
      const validation = await validateProofTransactions(commitTx, spellTx, network);
      
      if (!validation.valid) {
        console.error('❌ Proof validation failed:', validation.reason);
        if (validation.diagnostics) {
          console.error('📋 Validation diagnostics:', JSON.stringify(validation.diagnostics, null, 2));
          console.error(`   Commit TX: ${validation.diagnostics.commitTxid}`);
          console.error(`     Inputs: ${validation.diagnostics.commitInputs}, Outputs: ${validation.diagnostics.commitOutputs}`);
          console.error(`     Input UTXOs: ${validation.diagnostics.commitInputHashes?.join(', ')}`);
          console.error(`     Output hashes: ${validation.diagnostics.commitOutputHashes?.join(', ')}`);
          console.error(`   Spell TX: ${validation.diagnostics.spellInputs ? 'parsed' : 'unknown'}`);
          console.error(`     Inputs: ${validation.diagnostics.spellInputs}, Outputs: ${validation.diagnostics.spellOutputs}`);
          console.error(`     Input hashes: ${validation.diagnostics.spellInputHashes?.join(', ')}`);
          console.error(`   Matching inputs: ${validation.diagnostics.matchingInputs}`);
          
          // Check if transactions might be swapped
          console.error('🔍 Checking if transactions are in correct order...');
          const swappedValidation = await validateProofTransactions(spellTx, commitTx, network);
          if (swappedValidation.valid) {
            console.error('⚠️ WARNING: Transactions appear to be swapped! Spell TX spends Commit TX when order is reversed.');
            console.error('   This suggests the Prover API/CLI returned transactions in wrong order.');
            throw new Error(`Proof generation failed validation: Transactions appear to be in wrong order. When swapped, the topology is correct. The Prover API/CLI may have returned [spell_tx, commit_tx] instead of [commit_tx, spell_tx].`);
          }
        }
        throw new Error(`Proof generation failed validation: ${validation.reason}. The spell transaction does not spend the commit transaction's output. This indicates an issue with the proof generation - the Prover API/CLI may have generated incorrect transactions.`);
      }
      
      console.log(`✅ Proof validation passed: spell transaction spends commit output (${validation.diagnostics?.matchingInputs} matching input(s))`);
      
      // IMPORTANT: Charms Prover API broadcasts transactions internally as part of /spells/prove
      // A successful response means both commit and spell transactions have already been broadcast
      // We should NOT attempt to rebroadcast locally - this would cause double-submission errors
      console.log('✅ Prover API successfully generated and broadcasted transactions');
      console.log('   Package submission performed internally by Charms Prover API using full nodes. No separate broadcast step required.');
      
      // Extract TXIDs from transaction hex (for verification/display)
      const commitTxid = await computeTxid(commitTx);
      const spellTxid = await computeTxid(spellTx);
      
      console.log(`   Commit TXID: ${commitTxid}`);
      console.log(`   Spell TXID: ${spellTxid}`);
      
      // Map array response to object format with TXIDs
      // broadcasted: true indicates Prover API already broadcast these transactions
      return {
        commit_tx: commitTx,
        spell_tx: spellTx,
        commit_txid: commitTxid,
        spell_txid: spellTxid,
        broadcasted: true, // Indicates Prover API already broadcast
      };
    } catch (error: any) {
      // Log ALL errors immediately for debugging
      console.error('🔴 CAUGHT ERROR IN generateProof:');
      console.error('   Error type:', typeof error);
      console.error('   Error name:', error?.name);
      console.error('   Error message:', error?.message);
      console.error('   Error code:', error?.code);
      console.error('   Has response:', !!error?.response);
      if (error?.response) {
        console.error('   Response status:', error.response.status);
        console.error('   Response data:', JSON.stringify(error.response.data).substring(0, 500));
      }
      console.error('   Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)).substring(0, 1000));
      
      // Handle timeout and network errors with enhanced messaging
      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        const isConnectionTimeout = error.code === 'ETIMEDOUT' && !error.response;
        const isRequestTimeout = error.code === 'ECONNABORTED' || (error.code === 'ETIMEDOUT' && error.response);
        
        if (isConnectionTimeout) {
          console.error('❌ Prover API connection timed out');
          console.error('   The connection to the Prover API could not be established within the timeout period.');
          console.error('   This may indicate:');
          console.error('   - Network connectivity issues');
          console.error('   - Prover API server is down or unreachable');
          console.error('   - Firewall or DNS resolution problems');
          console.error('   - The Prover API endpoint may be incorrect');
          throw new Error(
            'Connection to Prover API timed out. This could be due to network issues or the Prover API being unavailable. ' +
            'Please check your internet connection and try again. If the problem persists, the Prover API may be experiencing issues.'
          );
        } else if (isRequestTimeout) {
          console.error('❌ Prover API request timed out after 180 seconds');
          console.error('   The request was sent but the Prover API did not respond in time.');
          console.error('   This may be due to:');
          console.error('   - High server load on the Prover API');
          console.error('   - Complex proof generation taking longer than expected');
          console.error('   - Network latency issues');
          throw new Error(
            'Prover API request timed out after 3 minutes. The proof generation may be taking longer than expected, ' +
            'or the Prover API may be experiencing high load. Please try again in a few moments.'
          );
        } else {
          console.error('❌ Prover API timeout error');
          console.error('   Error code:', error.code);
          throw new Error('Prover API request timed out. Please try again.');
        }
      }
      
      // Handle other network errors
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ECONNRESET') {
        console.error(`❌ Prover API network error (${error.code})`);
        console.error('   Unable to connect to the Prover API.');
        console.error('   This may indicate:');
        console.error('   - The Prover API server is down');
        console.error('   - Network connectivity issues');
        console.error('   - DNS resolution problems');
        throw new Error(
          `Unable to connect to Prover API (${error.code}). Please check your network connection and verify the Prover API is accessible.`
        );
      }
      
      // Enhanced error handling for 422 errors
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;
        
        console.error(`❌ Prover API error (${status}):`, errorData);
        
        // Log the exact payload that was sent (for debugging)
        // Note: payload is in outer scope, but we'll log what we can from the error context
        if (spellObj) {
          console.error('📋 SPELL STRUCTURE THAT WAS SENT (for debugging):');
          console.error(JSON.stringify({
            version: spellObj.version,
            apps: spellObj.apps,
            ins_count: spellObj.ins?.length,
            outs_count: spellObj.outs?.length
          }, null, 2));
        }
        
        if (status === 422) {
          // 422 means the spell format is invalid
          // Common causes: Invalid Spell JSON format, missing required parameters
          const errorMessage = typeof errorData === 'string' 
            ? errorData 
            : (errorData?.error || errorData?.message || JSON.stringify(errorData));
          
          // Log the full spell for debugging
          console.error('❌ Prover API 422 Error - Invalid spell format');
          console.error('Error details:', errorData);
          console.error('Full error response:', JSON.stringify(errorData, null, 2));
          if (spellObj) {
            console.error('Spell structure:', JSON.stringify(spellObj, null, 2));
          }
          
          // Check for common issues
          const issues: string[] = [];
          if (spellObj) {
            if (!spellObj.outs || spellObj.outs.length === 0) {
              issues.push('No outputs defined');
            }
            spellObj.outs?.forEach((out: any, i: number) => {
              if (!out.sats && out.sats !== 0) {
                issues.push(`Output ${i} missing 'sats' field`);
              }
              if (!out.address) {
                issues.push(`Output ${i} missing 'address' field`);
              }
              if (!out.charms || Object.keys(out.charms).length === 0) {
                issues.push(`Output ${i} missing 'charms' field`);
              }
            });
          }
          
          let detailedError = `Invalid spell format (422): ${errorMessage}`;
          if (issues.length > 0) {
            detailedError += `\n\nDetected issues:\n${issues.map(i => `- ${i}`).join('\n')}`;
          }
          detailedError += `\n\nCheck that:\n` +
            `- Spell structure is correct (version, apps, ins, outs)\n` +
            `- All outputs have 'sats' field (minimum 330 sats)\n` +
            `- App IDs and VKs are valid\n` +
            `- UTXO format is correct (txid:vout)\n` +
            `- All required fields are present\n` +
            `\nReference: https://docs.charms.dev/guides/wallet-integration/transactions/prover-api/`;
          
          throw new Error(detailedError);
        }
        
        // Handle other error status codes
        // Common causes: Insufficient funding UTXO value, Invalid UTXO references, Server errors
        if (status === 400) {
          const errorMessage = typeof errorData === 'string' 
            ? errorData 
            : (errorData?.error || errorData?.message || JSON.stringify(errorData));
          
          throw new Error(`Prover API bad request (400): ${errorMessage}. Check funding_utxo_value and all required parameters.`);
        }
        
        if (status === 500 || status >= 502) {
          const errorMessage = typeof errorData === 'string' 
            ? errorData 
            : (errorData?.error || errorData?.message || JSON.stringify(errorData));
          throw new Error(`Prover API server error (${status}): ${errorMessage}. The Prover API may be experiencing issues. Please try again.`);
        }
        
        throw new Error(`Prover API error (${status}): ${JSON.stringify(errorData)}`);
      }
      
      // Non-HTTP errors (network errors, etc.)
      const errorMsg = error?.message || error?.response?.data?.error || error?.response?.data?.message || String(error);
      throw new Error(`Failed to generate proof: ${errorMsg}`);
    }
  }

  /**
   * Load spell template and substitute variables
   */
  async loadSpellTemplate(templateName: string, variables: Record<string, string>): Promise<string> {
    const templatePath = path.join(this.appPath, 'spells', `${templateName}.yaml`);
    const template = await fs.readFile(templatePath, 'utf-8');
    
    // Simple variable substitution
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
    }
    
    return result;
  }

  /**
   * Create mint gift card spell
   */
  async createMintSpell(params: {
    inUtxo: string;
    recipientAddress: string;
    brand: string;
    image: string;
    initialAmount: number;
    expirationDate: number;
  }): Promise<string> {
    const appId = await this.generateAppId(params.inUtxo);
    const appVk = await this.getAppVk();
    const createdAt = Math.floor(Date.now() / 1000);

    return await this.loadSpellTemplate('mint-gift-card', {
      app_id: appId,
      app_vk: appVk,
      in_utxo_0: params.inUtxo,
      recipient_address: params.recipientAddress,
      brand: params.brand,
      image: params.image,
      initial_amount: params.initialAmount.toString(),
      expiration_date: params.expirationDate.toString(),
      created_at: createdAt.toString(),
    });
  }

  /**
   * Generate app_id from UTXO (SHA256 hash)
   */
  private async generateAppId(utxo: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(utxo).digest('hex');
  }
}


