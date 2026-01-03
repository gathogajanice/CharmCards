/**
 * React Hook for Charms Operations
 */

import { useState, useCallback } from 'react';
import { parseSpell, validateSpell } from '@/lib/charms/spells';
import type { GiftCardMintParams, Spell } from '@/lib/charms/types';

// Use relative path for Vercel, fallback to localhost for local dev
const API_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? '/api' : 'http://localhost:3001');

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
      // Check if API server is available before making request
      try {
        const healthCheck = await fetch(`${API_URL}/health`, { 
          method: 'GET',
          signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        if (!healthCheck.ok) {
          throw new Error(`API server returned ${healthCheck.status}`);
        }
      } catch (healthError: any) {
        if (healthError.name === 'AbortError' || healthError.name === 'TimeoutError') {
          throw new Error('API server is not responding. Please ensure the API server is running on port 3001.');
        }
        if (healthError.message?.includes('Failed to fetch') || healthError.message?.includes('NetworkError')) {
          throw new Error('Cannot connect to API server. Please ensure the API server is running on port 3001. Start it with: cd api && npm run dev');
        }
        throw new Error(`API server check failed: ${healthError.message}`);
      }

      // Call backend API which creates spell AND generates proof
      // The backend handles app_bins, app VK, and all the complex setup
      let response: Response;
      try {
        response = await fetch(`${API_URL}/api/gift-cards/mint`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...params,
            expirationDate: params.expirationDate || Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
          }),
          signal: AbortSignal.timeout(180000), // 180 second (3 minute) timeout for minting - allows time for proof generation
        });
      } catch (fetchError: any) {
        // Catch network errors explicitly
        const errorMsg = fetchError?.message || fetchError?.toString() || 'Unknown error';
        const errorName = fetchError?.name || 'Error';
        
        console.error('Fetch error details:', {
          name: errorName,
          message: errorMsg,
          error: fetchError,
          apiUrl: API_URL
        });
        
        if (errorName === 'AbortError' || errorName === 'TimeoutError') {
          throw new Error('Request timed out after 3 minutes. Proof generation may be taking longer than expected. Please try again or check if the Prover API is experiencing high load.');
        }
        if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError') || errorMsg.includes('fetch') || errorMsg.includes('Network request failed')) {
          throw new Error(`Cannot connect to API server at ${API_URL}. Please ensure the API server is running on port 3001. Start it with: cd api && npm run dev`);
        }
        // Re-throw with more context
        throw new Error(`Network error: ${errorMsg}. Please check your connection and ensure the API server is running.`);
      }

      if (!response.ok) {
        let errorMessage = 'Failed to create mint spell';
        try {
          const errorText = await response.text();
          try {
            const error = JSON.parse(errorText);
            errorMessage = error.error || error.message || errorMessage;
          } catch {
            // If not JSON, use the text response
            errorMessage = errorText || `API returned ${response.status}: ${response.statusText}`;
          }
        } catch (parseError: any) {
          // If response parsing fails, use status text
          errorMessage = `API returned ${response.status}: ${response.statusText || 'Unknown error'}`;
        }
        throw new Error(errorMessage);
      }

      let data: any;
      try {
        const responseText = await response.text();
        if (!responseText) {
          throw new Error('Empty response from API server');
        }
        data = JSON.parse(responseText);
      } catch (parseError: any) {
        console.error('Failed to parse API response:', parseError);
        throw new Error(`Failed to parse API response: ${parseError.message || 'Invalid JSON'}`);
      }
      
      // Validate spell structure
      const spell = parseSpell(data.spell);
      if (!validateSpell(spell)) {
        throw new Error('Invalid spell structure returned from API');
      }

      // Verify proof structure
      if (!data.proof || !data.proof.commit_tx || !data.proof.spell_tx) {
        throw new Error('Proof generation failed - missing transactions in response');
      }

      setIsLoading(false);
      return { spell: data.spell, proof: data.proof };
    } catch (err: any) {
      // Extract error message from various possible formats
      const errorMsg = err?.message || err?.error?.message || err?.toString() || 'Failed to mint gift card';
      const errorName = err?.name || 'Error';
      
      // Provide user-friendly error messages
      let errorMessage = errorMsg;
      
      // Handle specific error types
      if (errorName === 'AbortError' || errorName === 'TimeoutError') {
        errorMessage = 'Request timed out after 3 minutes. Proof generation may be taking longer than expected. Please try again or check if the Prover API is experiencing high load.';
      } else if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError') || errorMsg.includes('fetch') || errorMsg.includes('Network request failed')) {
        errorMessage = `Cannot connect to API server at ${API_URL}. Please ensure the API server is running on port 3001. Start it with: cd api && npm run dev`;
      } else if (errorMsg.includes('API server')) {
        errorMessage = errorMsg; // Use the specific API error message
      } else if (errorMsg === 'Error' || errorMsg === 'Failed to mint gift card') {
        // If we only have a generic error, try to extract more details
        errorMessage = `Failed to generate proof: ${errorMsg}. Check the console for more details.`;
      }
      
      // Log the full error for debugging
      console.error('Mint gift card error:', {
        message: errorMsg,
        name: errorName,
        stack: err?.stack,
        apiUrl: API_URL,
        fullError: err,
        errorString: err?.toString()
      });
      
      setError(errorMessage);
      setIsLoading(false);
      throw new Error(errorMessage);
    }
  }, []);

  return {
    mintGiftCard,
    isLoading,
    error,
  };
}

