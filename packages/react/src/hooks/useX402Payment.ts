/**
 * useX402Payment hook
 * React hook for automatic x402 payment handling
 */

import { useState, useCallback, useMemo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PaymentRequirements } from '@x402-solana/core';
import {
  UseX402PaymentOptions,
  UseX402PaymentReturn,
  PaymentHistoryEntry,
} from '../types';
import {
  createPaymentWithWallet,
  encodePaymentProof,
  validatePaymentRequirements,
  getUSDCMint,
  isWalletSupported,
} from '../utils/wallet-adapter';

/**
 * Hook for automatic x402 payment handling
 *
 * Provides a fetch function that automatically handles 402 Payment Required responses
 * by creating a Solana USDC payment and retrying the request.
 *
 * @param options - Hook options
 * @returns Payment hook state and functions
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { fetch, isLoading, error } = useX402Payment({
 *     onPaymentSent: (sig, amount) => {
 *       console.log(`Paid ${amount} USDC, tx: ${sig}`);
 *     }
 *   });
 *
 *   const loadData = async () => {
 *     const response = await fetch('/api/premium');
 *     const data = await response.json();
 *   };
 *
 *   return (
 *     <button onClick={loadData} disabled={isLoading}>
 *       {isLoading ? 'Loading...' : 'Load Data'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useX402Payment(
  options: UseX402PaymentOptions = {}
): UseX402PaymentReturn {
  const {
    autoRetry = true,
    maxRetries = 3,
    onPaymentRequired,
    onPaymentSent,
    onPaymentConfirmed,
    onError,
  } = options;

  const wallet = useWallet();
  const { connection } = useConnection();

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastPaymentSignature, setLastPaymentSignature] = useState<string | null>(null);
  const [lastPaymentAmount, setLastPaymentAmount] = useState<number | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryEntry[]>([]);

  // Detect network from connection endpoint
  const network = useMemo(() => {
    if (!connection?.rpcEndpoint) return 'mainnet-beta';
    const endpoint = connection.rpcEndpoint;
    return endpoint.includes('devnet') ? 'devnet' : 'mainnet-beta';
  }, [connection]);

  // Add payment to history
  const addToHistory = useCallback((entry: PaymentHistoryEntry) => {
    setPaymentHistory(prev => [entry, ...prev].slice(0, 100));
  }, []);

  // Fetch with automatic 402 handling
  const fetchWithPayment = useCallback(
    async (url: string, fetchOptions?: RequestInit): Promise<Response> => {
      // Check wallet connection
      if (!wallet.publicKey || !wallet.connected) {
        const err = new Error('Wallet not connected. Please connect your wallet first.');
        setError(err);
        if (onError) onError(err);
        throw err;
      }

      // Check wallet capabilities
      if (!isWalletSupported(wallet)) {
        const err = new Error('Connected wallet does not support transaction signing.');
        setError(err);
        if (onError) onError(err);
        throw err;
      }

      let retries = 0;
      const maxAttempts = autoRetry ? maxRetries : 1;

      while (retries < maxAttempts) {
        try {
          setIsLoading(true);
          setError(null);

          // Make initial request
          let response = await fetch(url, fetchOptions);

          // Handle 402 Payment Required
          if (response.status === 402 && autoRetry) {
            // Parse payment requirements
            let paymentReq: PaymentRequirements;
            try {
              paymentReq = await response.json();
            } catch (err) {
              throw new Error('Failed to parse payment requirements');
            }

            // Validate requirements
            validatePaymentRequirements(paymentReq, network);

            // Notify callback
            if (onPaymentRequired) {
              onPaymentRequired(paymentReq);
            }

            const requirement = paymentReq.accepts[0];
            const amountMicroUSDC = parseInt(requirement.maxAmountRequired);
            const amountUSDC = amountMicroUSDC / 1_000_000;

            // Create payment history entry
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

            addToHistory(paymentEntry);

            try {
              // Create and send payment
              const signature = await createPaymentWithWallet(
                wallet,
                connection,
                paymentReq
              );

              setLastPaymentSignature(signature);
              setLastPaymentAmount(amountUSDC);

              // Notify callbacks
              if (onPaymentSent) {
                onPaymentSent(signature, amountUSDC);
              }
              if (onPaymentConfirmed) {
                onPaymentConfirmed(signature);
              }

              // Update payment entry
              setPaymentHistory(prev =>
                prev.map(p =>
                  p.id === paymentId
                    ? { ...p, signature, status: 'confirmed' as const }
                    : p
                )
              );

              // Retry request with payment proof
              response = await fetch(url, {
                ...fetchOptions,
                headers: {
                  ...fetchOptions?.headers,
                  'X-PAYMENT': encodePaymentProof(signature, paymentReq),
                },
              });
            } catch (paymentError: any) {
              // Update payment entry with error
              setPaymentHistory(prev =>
                prev.map(p =>
                  p.id === paymentId
                    ? {
                        ...p,
                        status: 'failed' as const,
                        error: paymentError.message,
                      }
                    : p
                )
              );
              throw paymentError;
            }
          }

          setIsLoading(false);
          return response;
        } catch (err: any) {
          retries++;
          setError(err);

          if (onError) {
            onError(err);
          }

          if (retries >= maxAttempts) {
            setIsLoading(false);
            throw err;
          }

          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }

      setIsLoading(false);
      throw new Error('Max retries exceeded');
    },
    [
      wallet,
      connection,
      network,
      autoRetry,
      maxRetries,
      onPaymentRequired,
      onPaymentSent,
      onPaymentConfirmed,
      onError,
      addToHistory,
    ]
  );

  return {
    fetch: fetchWithPayment,
    isLoading,
    error,
    lastPaymentSignature,
    lastPaymentAmount,
    paymentHistory,
  };
}