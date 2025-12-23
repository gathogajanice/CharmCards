import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import axios from 'axios';

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
    this.appPath = process.env.CHARMS_APP_PATH || '../gift-cards';
    this.appVk = process.env.CHARMS_APP_VK || '';
    this.proverUrl = process.env.PROVER_API_URL || 'https://v8.charms.dev/spells/prove';
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
    if (this.appVk) {
      return this.appVk;
    }
    
    try {
      const appBin = await this.buildApp();
      const { stdout } = await execAsync(`charms app vk "${appBin}"`);
      return stdout.trim();
    } catch (error: any) {
      throw new Error(`Failed to get app VK: ${error.message}`);
    }
  }

  /**
   * Check if a spell is valid
   */
  async checkSpell(spellYaml: string, prevTxs?: string): Promise<boolean> {
    try {
      const appBin = await this.buildApp();
      const prevTxsArg = prevTxs ? `--prev-txs=${prevTxs}` : '';
      const { stdout, stderr } = await execAsync(
        `cd ${this.appPath} && echo '${spellYaml}' | charms spell check --app-bins=${appBin} ${prevTxsArg}`
      );
      
      // If command succeeds, spell is valid
      return true;
    } catch (error: any) {
      console.error('Spell check failed:', error.message);
      return false;
    }
  }

  /**
   * Generate proof for a spell using Prover API
   * Payload format based on: https://github.com/CharmsDev/charms/blob/main/src/spell.rs#L694
   */
  async generateProof(spellYaml: string, appBin?: string, prevTxs?: string, mockMode: boolean = false): Promise<any> {
    try {
      const spellObj = yaml.load(spellYaml);
      
      // Build payload according to ProveRequest format
      const payload: any = {
        spell: spellObj,
      };
      
      // Add app_bins if provided
      if (appBin) {
        payload.app_bins = appBin;
      }
      
      // Add prev_txs if provided
      if (prevTxs) {
        payload.prev_txs = prevTxs;
      }
      
      // Add mock flag if in mock mode
      if (mockMode) {
        payload.mock = true;
      }
      
      const response = await axios.post(this.proverUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error: any) {
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

