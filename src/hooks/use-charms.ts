/**
 * React Hook for Charms Operations
 */

import { useState, useCallback } from 'react';
import { createMintSpell, parseSpell, validateSpell } from '@/lib/charms/spells';
import { generateProof } from '@/lib/charms/prover';
import type { GiftCardMintParams, Spell } from '@/lib/charms/types';

export interface UseCharmsReturn {
  mintGiftCard: (params: GiftCardMintParams) => Promise<{ spell: string; proof: any }>;
  isLoading: boolean;
  error: string | null;
}

export function useCharms(): UseCharmsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mintGiftCard = useCallback(async (params: GiftCardMintParams) => {
    setIsLoading(true);
    setError(null);

    try {
      // Create mint spell
      const spellYaml = await createMintSpell(params);

      // Validate spell
      const spell = parseSpell(spellYaml);
      if (!validateSpell(spell)) {
        throw new Error('Invalid spell structure');
      }

      // Generate proof (will be called via API which handles app_bins and prev_txs)
      const mockMode = process.env.NEXT_PUBLIC_MOCK_MODE === 'true';
      const proof = await generateProof(spellYaml, { mockMode });

      setIsLoading(false);
      return { spell: spellYaml, proof };
    } catch (err: any) {
      setError(err.message || 'Failed to mint gift card');
      setIsLoading(false);
      throw err;
    }
  }, []);

  return {
    mintGiftCard,
    isLoading,
    error,
  };
}

