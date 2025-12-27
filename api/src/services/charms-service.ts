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
  private_inputs?: Record<string, string>;
  ins: Array<{
    utxo_id: string;
    charms: Record<string, any>;
  }>;
  outs: Array<{
    address: string;
    charms: Record<string, any>;
  }>;
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
    try {
      const { stdout } = await execAsync(
        `cd ${this.appPath} && unset CARGO_TARGET_DIR && charms app build`
      );
      const appBin = stdout.trim();
      return appBin;
    } catch (error: any) {
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
   * Generate proof for a spell using charms CLI (charms spell prove)
   * This uses the official CLI which handles all formatting correctly
   * Alternative to calling Prover API directly - ensures correct format
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
    let spellObj: any;
    try {
      spellObj = yaml.load(spellYaml);
      
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
      for (const [key, value] of Object.entries(spellObj.apps)) {
        if (!key.startsWith('$') || !/^\$[0-9a-fA-F]+$/.test(key)) {
          throw new Error(`Invalid spell: Invalid app key format "${key}" - must be "$00", "$01", etc.`);
        }
        if (typeof value !== 'string') {
          throw new Error(`Invalid spell: App value for ${key} must be a string, got ${typeof value}`);
        }
        // Validate format: "n/app_id/app_vk" or "t/app_id/app_vk"
        if (!/^[nt]\/[0-9a-fA-F]{64}\/[0-9a-fA-F]{64}$/.test(value)) {
          throw new Error(`Invalid spell: App value for ${key} has invalid format "${value}" - expected "n/app_id/app_vk" or "t/app_id/app_vk"`);
        }
      }
      
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
      // Use empty object {} when no binary is available (matches official docs example)
      const binaries: Record<string, string> = {};
      
      if (mockMode) {
        console.log('ℹ️ Mock mode enabled - using empty binaries object {} (per official docs)');
      } else if (appBin && this.appVk) {
        // TODO: When binary is available, add it: { [app_vk]: base64_encoded_binary }
        console.warn('⚠️ App binary available but encoding not implemented - using empty binaries object');
      } else {
        console.log('ℹ️ No app binary available - using empty binaries object {} (per official docs)');
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
      console.log(`   Binaries: ${Object.keys(payload.binaries || {}).length > 0 ? 'has entries' : 'empty object {}'}`);
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
      
      // Log binaries structure
      console.log(`   Binaries: ${Object.keys(payload.binaries || {}).length} entry/entries`);
      if (payload.binaries && Object.keys(payload.binaries).length > 0) {
        Object.entries(payload.binaries).forEach(([appVk, binary]: [string, any]) => {
          const binaryValue = typeof binary === 'string' ? (binary.length > 0 ? `${binary.substring(0, 20)}... (${binary.length} chars)` : 'empty string') : JSON.stringify(binary);
          console.log(`     - ${appVk.substring(0, 16)}...: ${binaryValue}`);
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
          console.log('🔧 Attempting to use charms spell prove CLI command...');
          
          // Prepare spell YAML file temporarily
          const tempSpellPath = path.join(this.appPath, '.temp-spell.yaml');
          await fs.writeFile(tempSpellPath, spellYaml, 'utf-8');
          
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
          
          const { stdout, stderr } = await execAsync(command, {
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          });
          
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
          return {
            commit_tx: commitTx,
            spell_tx: spellTx,
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
      console.log('📡 Using direct Prover API call (charms CLI not available or failed)');
      
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
      
      const response = await axios.post(this.proverUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      // API returns array: ["hex_encoded_commit_tx", "hex_encoded_spell_tx"]
      const txArray = response.data;
      
      if (!Array.isArray(txArray) || txArray.length !== 2) {
        throw new Error('Invalid response format from Prover API. Expected array of 2 transaction hex strings.');
      }

      console.log('✅ Proof generated successfully via Prover API');
      // Map array response to object format for backward compatibility
      return {
        commit_tx: txArray[0],
        spell_tx: txArray[1],
      };
    } catch (error: any) {
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
            `- All required fields are present`;
          
          throw new Error(detailedError);
        }
        
        throw new Error(`Prover API error (${status}): ${JSON.stringify(errorData)}`);
      }
      
      throw new Error(`Failed to generate proof: ${error.message}`);
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


