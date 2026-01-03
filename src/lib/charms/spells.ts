/**
 * Charms Spell Utilities
 * Handles spell creation and manipulation
 */

import * as yaml from 'js-yaml';
import type {
  Spell,
  GiftCardMintParams,
  GiftCardTransferParams,
  GiftCardRedeemParams,
  GiftCardNftMetadata,
} from './types';

// Use relative path for Vercel, fallback to localhost for local dev
const API_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? '/api' : 'http://localhost:3001');

/**
 * Create a mint spell for a new gift card
 */
export async function createMintSpell(params: GiftCardMintParams): Promise<string> {
  const response = await fetch(`${API_URL}/api/gift-cards/mint`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...params,
      expirationDate: params.expirationDate || Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create mint spell');
  }

  const data = await response.json();
  return data.spell;
}

/**
 * Parse spell YAML string to Spell object
 */
export function parseSpell(spellYaml: string): Spell {
  return yaml.load(spellYaml) as Spell;
}

/**
 * Convert Spell object to YAML string
 */
export function spellToYaml(spell: Spell): string {
  return yaml.dump(spell);
}

/**
 * Validate spell structure
 */
export function validateSpell(spell: Spell): boolean {
  if (!spell.version || !spell.apps || !spell.ins || !spell.outs) {
    return false;
  }

  if (spell.ins.length === 0 && spell.outs.length === 0) {
    return false;
  }

  return true;
}

