/**
 * React Query hooks for wallet data with caching and optimistic updates
 * Optimizes performance by reducing unnecessary API calls
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWalletBalance, getWalletUtxos, getWalletCharms } from '@/lib/charms/wallet';
import type { WalletCharms } from '@/lib/charms/types';

const NETWORK = process.env.NEXT_PUBLIC_BITCOIN_NETWORK || 'testnet4';

const CACHE_TIME = 30000; // 30 seconds
const STALE_TIME = 10000; // 10 seconds
const REFETCH_INTERVAL = 30000; // 30 seconds (reduced from 10s)

/**
 * Hook to fetch wallet balance with caching
 */
export function useWalletBalance(address: string | undefined, isConnected: boolean) {
  return useQuery({
    queryKey: ['walletBalance', address],
    queryFn: async () => {
      if (!address) return null;
      return await getWalletBalance(address, null);
    },
    enabled: !!address && isConnected,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    refetchInterval: REFETCH_INTERVAL,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

/**
 * Hook to fetch wallet UTXOs with caching
 */
export function useWalletUtxos(address: string | undefined, isConnected: boolean) {
  return useQuery({
    queryKey: ['walletUtxos', address],
    queryFn: async () => {
      if (!address) return [];
      return await getWalletUtxos(address, null);
    },
    enabled: !!address && isConnected,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    refetchInterval: REFETCH_INTERVAL,
    refetchOnWindowFocus: false, // UTXOs don't change as frequently
  });
}

/**
 * Hook to fetch wallet Charms (NFTs and tokens) with caching
 */
export function useWalletCharms(address: string | undefined, isConnected: boolean) {
  return useQuery({
    queryKey: ['walletCharms', address],
    queryFn: async () => {
      if (!address) return { address: '', nfts: [], tokens: [] } as WalletCharms;
      return await getWalletCharms(address);
    },
    enabled: !!address && isConnected,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    refetchInterval: REFETCH_INTERVAL,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

/**
 * Hook to invalidate and refetch wallet data after transactions
 */
export function useRefreshWalletData() {
  const queryClient = useQueryClient();

  return {
    refreshBalance: (address: string | undefined) => {
      if (address) {
        queryClient.invalidateQueries({ queryKey: ['walletBalance', address] });
      }
    },
    refreshUtxos: (address: string | undefined) => {
      if (address) {
        queryClient.invalidateQueries({ queryKey: ['walletUtxos', address] });
      }
    },
    refreshCharms: (address: string | undefined) => {
      if (address) {
        queryClient.invalidateQueries({ queryKey: ['walletCharms', address] });
      }
    },
    refreshAll: (address: string | undefined) => {
      if (address) {
        queryClient.invalidateQueries({ queryKey: ['walletBalance', address] });
        queryClient.invalidateQueries({ queryKey: ['walletUtxos', address] });
        queryClient.invalidateQueries({ queryKey: ['walletCharms', address] });
      }
    },
  };
}

/**
 * Hook to poll for transaction confirmation and refresh data
 */
export function useTransactionPolling(
  commitTxid: string | undefined,
  spellTxid: string | undefined,
  onConfirmed?: () => void
) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['transactionStatus', commitTxid, spellTxid],
    queryFn: async () => {
      if (!commitTxid || !spellTxid) return null;

      const NETWORK = process.env.NEXT_PUBLIC_BITCOIN_NETWORK || 'testnet4';
      const explorerUrl = NETWORK === 'testnet4'
        ? `https://mempool.space/testnet4/api/tx/${commitTxid}`
        : `https://mempool.space/api/tx/${commitTxid}`;

      try {
        const response = await fetch(explorerUrl, { cache: 'no-store' });
        if (response.ok) {
          const tx = await response.json();
          const confirmed = tx.status?.confirmed || false;
          
          if (confirmed && onConfirmed) {
            // Invalidate all wallet queries to refresh data
            queryClient.invalidateQueries({ queryKey: ['walletBalance'] });
            queryClient.invalidateQueries({ queryKey: ['walletUtxos'] });
            queryClient.invalidateQueries({ queryKey: ['walletCharms'] });
            onConfirmed();
          }
          
          return { confirmed, tx };
        }
      } catch (error) {
        console.warn('Failed to check transaction status:', error);
      }
      
      return { confirmed: false, tx: null };
    },
    enabled: !!commitTxid && !!spellTxid,
    refetchInterval: (query) => {
      const data = query.state.data as { confirmed: boolean } | null;
      // Stop polling once confirmed
      return data?.confirmed ? false : 5000; // Poll every 5 seconds until confirmed
    },
    staleTime: 0, // Always check fresh status
  });
}

