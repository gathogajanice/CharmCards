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
    this.proverUrl = process.env.PROVER_API_URL || 'https://v8.charms.dev/spells/prove';
    
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
   * Generate proof for a spell using Prover API
   * Payload format based on: https://docs.charms.dev/guides/wallet-integration/transactions/prover-api/
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
      
      // Validate spell structure before sending to Prover API
      if (!spellObj || typeof spellObj !== 'object') {
        throw new Error('Invalid spell YAML: Could not parse spell object');
      }
      
      if (!spellObj.version) {
        throw new Error('Invalid spell: Missing version field');
      }
      
      if (!spellObj.apps || typeof spellObj.apps !== 'object') {
        throw new Error('Invalid spell: Missing or invalid apps field');
      }
      
      if (!Array.isArray(spellObj.ins)) {
        throw new Error('Invalid spell: Missing or invalid ins (inputs) field');
      }
      
      if (!Array.isArray(spellObj.outs)) {
        throw new Error('Invalid spell: Missing or invalid outs (outputs) field');
      }
      
      // Build payload according to Prover API format
      // Based on: https://docs.charms.dev/guides/wallet-integration/transactions/prover-api/
      // prev_txs must be an array of objects with {chain, hex}, one for each input UTXO in the spell
      let prevTxsArray: string[] = [];
      if (prevTxs) {
        if (Array.isArray(prevTxs)) {
          prevTxsArray = prevTxs;
        } else if (typeof prevTxs === 'string' && prevTxs.length > 0) {
          // Single transaction hex string - convert to array
          prevTxsArray = [prevTxs];
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
      
      const payload: any = {
        spell: spellObj,
        binaries: {},
        prev_txs: prevTxsArray, // Array of hex strings per official docs
      };
      
      // For basic transfers (minting), binaries is always empty object per official docs
      // Format: { "app_vk_hex": "base64_encoded_binary" } when binary is available
      if (mockMode) {
        console.log('ℹ️ Mock mode enabled - using empty binaries (basic transfer)');
      } else if (appBin && this.appVk) {
        // TODO: When binary is available, add it: { [this.appVk]: base64_encoded_binary }
        console.warn('⚠️ App binary available but encoding not implemented - using empty binaries');
      }
      
      // Add required funding fields
      if (fundingUtxo) {
        payload.funding_utxo = fundingUtxo;
      }
      
      if (fundingUtxoValue !== undefined) {
        payload.funding_utxo_value = fundingUtxoValue;
      }
      
      if (changeAddress) {
        payload.change_address = changeAddress;
      }
      
      // Fee rate in sats per byte (default 2.0 as per docs)
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
      console.log(`   Mock mode: ${mockMode}`);
      console.log(`   Binaries: ${Object.keys(payload.binaries || {}).length > 0 ? 'has entries' : 'empty object'}`);
      console.log(`   Funding UTXO: ${payload.funding_utxo || 'NOT SET'}`);
      console.log(`   Funding UTXO value: ${payload.funding_utxo_value || 'NOT SET'} sats`);
      console.log(`   Change address: ${payload.change_address ? payload.change_address.substring(0, 20) + '...' : 'NOT SET'}`);
      console.log(`   Fee rate: ${payload.fee_rate} sats/vB`);
      console.log(`   Prev TXs: ${payload.prev_txs?.length || 0}`);
      if (payload.prev_txs && payload.prev_txs.length > 0) {
        payload.prev_txs.forEach((hex: string, i: number) => {
          console.log(`     Prev TX ${i}: ${hex.length} chars, starts with ${hex.substring(0, 16)}...`);
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

      console.log('✅ Proof generated successfully');
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
        
        if (status === 422) {
          // 422 means the spell format is invalid
          const errorMessage = typeof errorData === 'string' 
            ? errorData 
            : (errorData?.error || errorData?.message || JSON.stringify(errorData));
          
          // Log the full spell for debugging
          console.error('❌ Prover API 422 Error - Invalid spell format');
          console.error('Error details:', errorData);
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


