/**
 * Main transaction verifier
 * Handles complete payment verification flow
 */

import { Connection, VersionedTransactionResponse } from '@solana/web3.js';
import {
  VerificationResult,
  VerificationOptions,
  VerifierConfig,
} from '../types/solana.types';
import { IPaymentCache, createPaymentCache } from './payment-cache';
import { verifyUSDCTransfer } from './usdc-verifier';
import { parseTransaction } from '../utils/transaction-parser';
import { withRetry, TRANSACTION_FETCH_RETRY_CONFIG } from '../utils/retry-handler';
import { isValidSignature } from '../utils/address-validator';
import {
  createSuccessResult,
  createReplayAttackError,
  createTransactionNotFoundError,
  createTransactionFailedError,
  createNoUSDCTransferError,
  createTransferMismatchError,
  createTransactionExpiredError,
  createInvalidHeaderError,
  createVerificationError,
} from './verification-result';

/**
 * Default verification options
 */
const DEFAULT_VERIFICATION_OPTIONS: Required<VerificationOptions> = {
  maxAgeMs: 300_000, // 5 minutes
  skipCacheCheck: false,
  commitment: 'confirmed',
};

/**
 * Transaction verifier for x402 payments
 * Main class for verifying Solana USDC payments
 *
 * @example
 * ```typescript
 * const verifier = new TransactionVerifier({
 *   rpcUrl: 'https://api.devnet.solana.com',
 *   commitment: 'confirmed',
 *   cacheConfig: {
 *     redisUrl: process.env.REDIS_URL,
 *     ttlSeconds: 600,
 *   },
 * });
 *
 * const result = await verifier.verifyPayment(
 *   signature,
 *   recipientUSDCAccount,
 *   0.001, // $0.001
 *   { maxAgeMs: 300000 }
 * );
 *
 * if (result.valid) {
 *   console.log('Payment verified!');
 * } else {
 *   console.error('Payment invalid:', result.error);
 * }
 * ```
 */
export class TransactionVerifier {
  private connection: Connection;
  private paymentCache: IPaymentCache;
  private maxRetries: number;
  private retryDelayMs: number;

  /**
   * Create a transaction verifier
   *
   * @param config - Verifier configuration
   */
  constructor(config: VerifierConfig) {
    this.connection = new Connection(
      config.rpcUrl,
      config.commitment || 'confirmed'
    );

    this.paymentCache = createPaymentCache({
      redisUrl: config.cacheConfig?.redisUrl,
      ttlSeconds: config.cacheConfig?.ttlSeconds || 600,
      useInMemory: config.cacheConfig?.useInMemory,
    });

    this.maxRetries = config.maxRetries || 3;
    this.retryDelayMs = config.retryDelayMs || 100;
  }

  /**
   * Verify a payment transaction
   *
   * @param signature - Transaction signature
   * @param expectedRecipient - Expected recipient USDC token account address
   * @param expectedAmountUSD - Expected amount in USD
   * @param options - Verification options
   * @returns Verification result
   *
   * @example
   * ```typescript
   * const result = await verifier.verifyPayment(
   *   '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7',
   *   'TokenAccount1111111111111111111111111111111',
   *   0.001
   * );
   * ```
   */
  async verifyPayment(
    signature: string,
    expectedRecipient: string,
    expectedAmountUSD: number,
    options: VerificationOptions = {}
  ): Promise<VerificationResult> {
    try {
      // Merge with default options
      const opts = { ...DEFAULT_VERIFICATION_OPTIONS, ...options };

      // 1. Validate signature format
      if (!isValidSignature(signature)) {
        return createInvalidHeaderError(`Invalid signature format: ${signature}`);
      }

      // 2. Check replay attack cache
      if (!opts.skipCacheCheck) {
        const isUsed = await this.paymentCache.isUsed(signature);
        if (isUsed) {
          return createReplayAttackError(signature);
        }
      }

      // 3. Fetch transaction with retries
      const tx = await this.fetchTransactionWithRetry(signature, opts.commitment);

      if (!tx) {
        return createTransactionNotFoundError(signature);
      }

      // 4. Verify transaction succeeded
      if (tx.meta?.err) {
        return createTransactionFailedError(signature, tx.meta.err);
      }

      // 5. Verify transaction timing
      const timingResult = this.verifyTransactionTiming(tx, opts.maxAgeMs);
      if (!timingResult.valid) {
        return timingResult;
      }

      // 6. Parse transaction to extract USDC transfers
      const parsed = parseTransaction(tx);

      if (parsed.transfers.length === 0) {
        return createNoUSDCTransferError(signature);
      }

      // 7. Verify USDC transfer matches requirements
      const usdcVerification = verifyUSDCTransfer(
        parsed.transfers,
        expectedRecipient,
        expectedAmountUSD,
        {
          strictMintCheck: true,
        }
      );

      if (!usdcVerification.valid) {
        return createTransferMismatchError(
          expectedRecipient,
          usdcVerification.debug?.expectedAmount || 0,
          usdcVerification.debug?.foundTransfers || []
        );
      }

      // 8. Mark payment as used
      if (!opts.skipCacheCheck) {
        await this.paymentCache.markUsed(signature, {
          recipient: expectedRecipient,
          amount: usdcVerification.transfer!.amount,
          timestamp: Date.now(),
          payer: usdcVerification.transfer!.authority,
        });
      }

      // 9. Return success
      return createSuccessResult(
        signature,
        usdcVerification.transfer!,
        tx.blockTime || undefined,
        tx.slot
      );
    } catch (error: any) {
      // Handle unexpected errors
      return createVerificationError(error.message, error);
    }
  }

  /**
   * Fetch transaction with exponential backoff retry
   *
   * @param signature - Transaction signature
   * @param commitment - Commitment level
   * @returns Transaction response or null
   */
  private async fetchTransactionWithRetry(
    signature: string,
    commitment: 'processed' | 'confirmed' | 'finalized'
  ): Promise<VersionedTransactionResponse | null> {
    return withRetry(
      async () => {
        const tx = await this.connection.getTransaction(signature, {
          commitment: commitment as any,
          maxSupportedTransactionVersion: 0,
        });
        return tx;
      },
      {
        ...TRANSACTION_FETCH_RETRY_CONFIG,
        maxRetries: this.maxRetries,
        baseDelayMs: this.retryDelayMs,
        onRetry: (attempt, error, delayMs) => {
          console.warn(
            `Retrying transaction fetch (attempt ${attempt}/${this.maxRetries}): ${error.message}. Waiting ${delayMs}ms...`
          );
        },
      }
    );
  }

  /**
   * Verify transaction timing constraints
   *
   * @param tx - Transaction response
   * @param maxAgeMs - Maximum age in milliseconds
   * @returns Verification result
   */
  private verifyTransactionTiming(
    tx: VersionedTransactionResponse,
    maxAgeMs: number
  ): VerificationResult {
    if (!tx.blockTime) {
      // Transaction doesn't have block time (shouldn't happen with confirmed commitment)
      return createVerificationError('Transaction missing block time');
    }

    const txAge = Date.now() - tx.blockTime * 1000;

    if (txAge > maxAgeMs) {
      return createTransactionExpiredError(
        tx.transaction.signatures[0],
        txAge,
        maxAgeMs
      );
    }

    // Return a dummy success result (we only care about valid flag here)
    return { valid: true };
  }

  /**
   * Batch verify multiple payments
   * Useful for processing multiple payments in a single call
   *
   * @param payments - Array of payment verification requests
   * @returns Array of verification results
   *
   * @example
   * ```typescript
   * const results = await verifier.batchVerify([
   *   { signature: 'sig1', recipient: 'recipient1', amountUSD: 0.001 },
   *   { signature: 'sig2', recipient: 'recipient2', amountUSD: 0.002 },
   * ]);
   * ```
   */
  async batchVerify(
    payments: Array<{
      signature: string;
      recipient: string;
      amountUSD: number;
      options?: VerificationOptions;
    }>
  ): Promise<VerificationResult[]> {
    return Promise.all(
      payments.map(p =>
        this.verifyPayment(p.signature, p.recipient, p.amountUSD, p.options)
      )
    );
  }

  /**
   * Get payment metadata from cache
   *
   * @param signature - Transaction signature
   * @returns Payment metadata or null
   */
  async getPaymentMetadata(signature: string) {
    return this.paymentCache.getMetadata(signature);
  }

  /**
   * Clear payment cache (for testing)
   */
  async clearCache(): Promise<void> {
    await this.paymentCache.clear();
  }

  /**
   * Close verifier and cleanup resources
   */
  async close(): Promise<void> {
    await this.paymentCache.close();
  }
}
