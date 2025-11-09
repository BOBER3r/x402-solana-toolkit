/**
 * X402Provider - Main provider component for x402 React integration
 * Wraps your app with x402 payment functionality
 */

import React, { ReactNode, useMemo, useState, useCallback, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { PaymentRequirements } from '@x402-solana/core';
import { X402ContextProvider } from '../context/X402Context';
import {
  X402ProviderConfig,
  X402ContextValue,
  PaymentHistoryEntry,
} from '../types';
import {
  createPaymentWithWallet,
  getUSDCBalance,
  getUSDCMint,
  encodePaymentProof,
  validatePaymentRequirements,
  isWalletSupported,
} from '../utils/wallet-adapter';

/**
 * Props for X402Provider
 */
export interface X402ProviderProps {
  /** Provider configuration */
  config: X402ProviderConfig;

  /** Child components */
  children: ReactNode;
}

/**
 * X402Provider Component
 *
 * Provides x402 payment functionality to all child components.
 * Must be nested inside WalletProvider and ConnectionProvider from @solana/wallet-adapter-react.
 *
 * @example
 * ```tsx
 * import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
 * import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
 * import { X402Provider } from '@x402-solana/react';
 *
 * function App() {
 *   return (
 *     <ConnectionProvider endpoint="https://api.devnet.solana.com">
 *       <WalletProvider wallets={[]} autoConnect>
 *         <WalletModalProvider>
 *           <X402Provider config={{ solanaRpcUrl: 'https://api.devnet.solana.com' }}>
 *             <YourApp />
 *           </X402Provider>
 *         </WalletModalProvider>
 *       </WalletProvider>
 *     </ConnectionProvider>
 *   );
 * }
 * ```
 */
export const X402Provider: React.FC<X402ProviderProps> = ({
  config,
  children,
}) => {
  // Get wallet from @solana/wallet-adapter-react
  const wallet = useWallet();
  const { connection: walletConnection } = useConnection();

  // Use wallet connection if available, otherwise create new one
  const connection = useMemo(
    () => walletConnection || new Connection(config.solanaRpcUrl, config.commitment || 'confirmed'),
    [walletConnection, config.solanaRpcUrl, config.commitment]
  );

  // State
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Merge config with defaults
  const fullConfig = useMemo<Required<X402ProviderConfig>>(() => ({
    solanaRpcUrl: config.solanaRpcUrl,
    network: config.network || 'mainnet-beta',
    autoRetry: config.autoRetry ?? true,
    maxRetries: config.maxRetries || 3,
    commitment: config.commitment || 'confirmed',
    debug: config.debug || false,
    enableHistory: config.enableHistory ?? true,
    maxHistorySize: config.maxHistorySize || 100,
  }), [config]);

  // Load payment history from localStorage on mount
  useEffect(() => {
    if (fullConfig.enableHistory) {
      try {
        const stored = localStorage.getItem('x402-payment-history');
        if (stored) {
          const parsed = JSON.parse(stored);
          setPaymentHistory(parsed);
        }
      } catch (err) {
        console.error('Failed to load payment history:', err);
      }
    }
  }, [fullConfig.enableHistory]);

  // Save payment history to localStorage when it changes
  useEffect(() => {
    if (fullConfig.enableHistory && paymentHistory.length > 0) {
      try {
        localStorage.setItem('x402-payment-history', JSON.stringify(paymentHistory));
      } catch (err) {
        console.error('Failed to save payment history:', err);
      }
    }
  }, [paymentHistory, fullConfig.enableHistory]);

  // Add payment to history
  const addToHistory = useCallback((entry: PaymentHistoryEntry) => {
    setPaymentHistory(prev => {
      const updated = [entry, ...prev];
      // Limit history size
      return updated.slice(0, fullConfig.maxHistorySize);
    });
  }, [fullConfig.maxHistorySize]);

  // Clear payment history
  const clearHistory = useCallback(() => {
    setPaymentHistory([]);
    localStorage.removeItem('x402-payment-history');
  }, []);

  // Get USDC balance
  const getBalance = useCallback(async (): Promise<number> => {
    if (!wallet.publicKey || !wallet.connected) {
      return 0;
    }

    try {
      const usdcMint = getUSDCMint(fullConfig.network);
      return await getUSDCBalance(wallet, connection, usdcMint);
    } catch (err) {
      console.error('Failed to get balance:', err);
      return 0;
    }
  }, [wallet, connection, fullConfig.network]);

  // Fetch with automatic 402 handling
  const fetchWithPayment = useCallback(async (
    url: string,
    options?: RequestInit
  ): Promise<Response> => {
    if (!wallet.publicKey || !wallet.connected) {
      throw new Error('Wallet not connected. Please connect your wallet first.');
    }

    if (!isWalletSupported(wallet)) {
      throw new Error('Connected wallet does not support transaction signing.');
    }

    let retries = 0;
    const maxRetries = fullConfig.autoRetry ? fullConfig.maxRetries : 1;

    while (retries < maxRetries) {
      try {
        setIsLoading(true);
        setError(null);

        // Try request without payment
        let response = await fetch(url, options);

        // If 402, handle payment
        if (response.status === 402 && fullConfig.autoRetry) {
          if (fullConfig.debug) {
            console.log(`[X402] Received 402 from ${url}`);
          }

          // Parse payment requirements
          let paymentReq: PaymentRequirements;
          try {
            paymentReq = await response.json();
          } catch (err) {
            throw new Error('Failed to parse payment requirements');
          }

          // Validate requirements
          validatePaymentRequirements(paymentReq, fullConfig.network);

          const requirement = paymentReq.accepts[0];
          const amountMicroUSDC = parseInt(requirement.maxAmountRequired);
          const amountUSDC = amountMicroUSDC / 1_000_000;

          if (fullConfig.debug) {
            console.log(`[X402] Payment required: ${amountUSDC} USDC`);
            console.log(`[X402] Description: ${requirement.description}`);
          }

          // Create payment entry
          const paymentId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const paymentEntry: PaymentHistoryEntry = {
            id: paymentId,
            signature: '',
            url,
            amount: amountUSDC,
            amountMicroUSDC,
            timestamp: Date.now(),
            requirements: paymentReq,
            status: 'pending',
          };

          if (fullConfig.enableHistory) {
            addToHistory(paymentEntry);
          }

          try {
            // Create payment transaction
            const signature = await createPaymentWithWallet(
              wallet,
              connection,
              paymentReq
            );

            if (fullConfig.debug) {
              console.log(`[X402] Payment sent: ${signature}`);
            }

            // Update payment entry
            const confirmedEntry: PaymentHistoryEntry = {
              ...paymentEntry,
              signature,
              status: 'confirmed',
            };

            if (fullConfig.enableHistory) {
              setPaymentHistory(prev =>
                prev.map(p => p.id === paymentId ? confirmedEntry : p)
              );
            }

            // Retry with payment proof
            response = await fetch(url, {
              ...options,
              headers: {
                ...options?.headers,
                'X-PAYMENT': encodePaymentProof(signature, paymentReq),
              },
            });

            if (fullConfig.debug) {
              console.log(`[X402] Request retried with payment, status: ${response.status}`);
            }
          } catch (paymentError: any) {
            // Update payment entry with error
            if (fullConfig.enableHistory) {
              setPaymentHistory(prev =>
                prev.map(p =>
                  p.id === paymentId
                    ? { ...p, status: 'failed' as const, error: paymentError.message }
                    : p
                )
              );
            }
            throw paymentError;
          }
        }

        setIsLoading(false);
        return response;
      } catch (err: any) {
        retries++;
        setError(err);

        if (retries >= maxRetries) {
          setIsLoading(false);
          throw err;
        }

        if (fullConfig.debug) {
          console.log(`[X402] Retry ${retries}/${maxRetries} after error: ${err.message}`);
        }

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }

    setIsLoading(false);
    throw new Error('Max retries exceeded');
  }, [
    wallet,
    connection,
    fullConfig,
    addToHistory,
  ]);

  // Context value
  const contextValue = useMemo<X402ContextValue>(() => {
    // Don't access wallet properties during render - let consumers access them
    // This avoids React 19 strict mode errors with wallet adapter
    return {
      config: fullConfig,
      connection,
      wallet: wallet as any,
      get publicKey() {
        try {
          return wallet?.publicKey || null;
        } catch {
          return null;
        }
      },
      get connected() {
        try {
          return wallet?.connected || false;
        } catch {
          return false;
        }
      },
      fetch: fetchWithPayment,
      getBalance,
      paymentHistory,
      clearHistory,
      isLoading,
      error,
    };
  }, [
    fullConfig,
    connection,
    wallet,
    fetchWithPayment,
    getBalance,
    paymentHistory,
    clearHistory,
    isLoading,
    error,
  ]);

  return (
    <X402ContextProvider value={contextValue}>
      {children}
    </X402ContextProvider>
  );
};
