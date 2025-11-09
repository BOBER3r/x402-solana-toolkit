/**
 * useWalletBalance hook
 * React hook for fetching and monitoring wallet balances
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import {
  UseWalletBalanceOptions,
  UseWalletBalanceReturn,
} from '../types';
import {
  getUSDCBalance,
  getSOLBalance,
  getUSDCMint,
} from '../utils/wallet-adapter';

/**
 * Helper function to safely check wallet state
 * Prevents React 19 strict mode errors with wallet adapter proxy
 */
function getSafeWalletState(wallet: any): { isConnected: boolean; hasPublicKey: boolean } {
  try {
    return {
      isConnected: wallet?.connected || false,
      hasPublicKey: !!wallet?.publicKey,
    };
  } catch (err) {
    return {
      isConnected: false,
      hasPublicKey: false,
    };
  }
}

/**
 * Hook for monitoring wallet balances
 *
 * Fetches USDC and SOL balances for the connected wallet,
 * with optional auto-refresh functionality.
 *
 * @param options - Hook options
 * @returns Wallet balance state and refresh function
 *
 * @example
 * ```tsx
 * function WalletInfo() {
 *   const { usdcBalance, solBalance, isLoading, refresh } = useWalletBalance({
 *     refreshInterval: 10000, // Refresh every 10 seconds
 *     onBalanceChange: (balance) => {
 *       console.log(`USDC balance: ${balance}`);
 *     }
 *   });
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       <p>USDC: {usdcBalance}</p>
 *       <p>SOL: {solBalance}</p>
 *       <button onClick={refresh}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useWalletBalance(
  options: UseWalletBalanceOptions = {}
): UseWalletBalanceReturn {
  const {
    refreshInterval = 0,
    onBalanceChange,
  } = options;

  const wallet = useWallet();
  const { connection } = useConnection();

  // State
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Detect network from connection endpoint
  const network = useMemo(() => {
    const endpoint = connection.rpcEndpoint;
    return endpoint.includes('devnet') ? 'devnet' : 'mainnet-beta';
  }, [connection]);

  const usdcMint = useMemo(() => getUSDCMint(network), [network]);

  // Fetch balances
  const fetchBalances = useCallback(async () => {
    const { isConnected, hasPublicKey } = getSafeWalletState(wallet);

    if (!hasPublicKey || !isConnected) {
      setUsdcBalance(0);
      setSolBalance(0);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch both balances in parallel
      const [usdc, sol] = await Promise.all([
        getUSDCBalance(wallet, connection, usdcMint),
        getSOLBalance(wallet, connection),
      ]);

      // Check if USDC balance changed
      if (usdc !== usdcBalance && onBalanceChange) {
        onBalanceChange(usdc);
      }

      setUsdcBalance(usdc);
      setSolBalance(sol);
    } catch (err: any) {
      console.error('Error fetching balances:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [
    wallet,
    connection,
    usdcMint,
    usdcBalance,
    onBalanceChange,
  ]);

  // Refresh function (exposed to user)
  const refresh = useCallback(async () => {
    await fetchBalances();
  }, [fetchBalances]);

  // Initial fetch when wallet connects
  useEffect(() => {
    const { isConnected, hasPublicKey } = getSafeWalletState(wallet);

    if (isConnected && hasPublicKey) {
      fetchBalances();
    } else {
      // Reset balances when wallet disconnects
      setUsdcBalance(0);
      setSolBalance(0);
    }
  }, [wallet, fetchBalances]);

  // Auto-refresh interval
  useEffect(() => {
    const { isConnected, hasPublicKey } = getSafeWalletState(wallet);

    if (refreshInterval > 0 && isConnected && hasPublicKey) {
      const intervalId = setInterval(() => {
        fetchBalances();
      }, refreshInterval);

      return () => clearInterval(intervalId);
    }
  }, [refreshInterval, wallet, fetchBalances]);

  return {
    usdcBalance,
    solBalance,
    isLoading,
    error,
    refresh,
  };
}