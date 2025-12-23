/**
 * Charms Prover API Integration
 * Handles proof generation for spells
 */

import * as yaml from 'js-yaml';

const PROVER_API_URL = process.env.NEXT_PUBLIC_PROVER_API_URL || 'https://v8.charms.dev/spells/prove';

export interface ProofRequest {
  spell: any; // Spell object (parsed YAML)
  app_bins?: string; // App binary path
  prev_txs?: string; // Previous transactions hex
  mock?: boolean; // Mock mode flag
}

export interface ProofResponse {
  proof: string;
  public_inputs: any;
  commit_tx?: string; // Commit transaction hex
  spell_tx?: string; // Spell transaction hex
}

/**
 * Generate proof for a spell
 * Payload format based on: https://github.com/CharmsDev/charms/blob/main/src/spell.rs#L694
 */
export async function generateProof(
  spellYaml: string,
  options?: {
    appBin?: string;
    prevTxs?: string;
    mockMode?: boolean;
  }
): Promise<ProofResponse> {
  const { appBin, prevTxs, mockMode = false } = options || {};
  
  // Parse YAML to object
  const spellObj = yaml.load(spellYaml);
  
  // Build payload according to ProveRequest format
  const payload: ProofRequest = {
    spell: spellObj,
  };
  
  if (appBin) {
    payload.app_bins = appBin;
  }
  
  if (prevTxs) {
    payload.prev_txs = prevTxs;
  }
  
  if (mockMode) {
    payload.mock = true;
  }
  
  const response = await fetch(PROVER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate proof');
  }

  return await response.json();
}

