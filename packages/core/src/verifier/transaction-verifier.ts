/**
 * Main transaction verifier
 * Handles complete payment verification flow
 */

import {
  Connection,
  Transaction,
  VersionedTransaction,
  VersionedTransactionResponse,
} from '@solana/web3.js';
import bs58 from 'bs58';
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
import { parseAndValidateSolanaPayment } from '../utils/x402-parser';
import { X402Payment, PaymentAccept, ChannelPayload } from '../types/x402.types';
import { ChannelPaymentVerifier, ChannelVerificationOptions } from './channel-verifier';

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
   * Verify payment from X-PAYMENT header (x402 protocol compliant)
   *
   * This method handles the official x402 protocol format where payment
   * data is sent in the X-PAYMENT header as base64-encoded JSON.
   *
   * Supports two schemes:
   * 1. scheme: 'exact' - On-chain transaction verification
   *    - serializedTransaction (official x402 format)
   *    - signature (backwards compatibility)
   * 2. scheme: 'channel' - Off-chain payment channel verification
   *    - channelId, amount, nonce, signature
   *
   * @param paymentHeader - X-PAYMENT header value (base64-encoded JSON)
   * @param paymentRequirements - Payment requirements that were requested
   * @param options - Verification options (or ChannelVerificationOptions for channel scheme)
   * @param channelProgramId - Required for 'channel' scheme: your channel program ID
   * @returns Verification result
   *
   * @example
   * ```typescript
   * // Express middleware - exact scheme
   * const header = req.headers['x-payment'];
   * const requirements = {
   *   scheme: 'exact',
   *   payTo: 'TokenAccount...',
   *   maxAmountRequired: '10000',
   *   asset: 'USDCMint...',
   *   // ... other fields
   * };
   *
   * const result = await verifier.verifyX402Payment(header, requirements);
   *
   * // Express middleware - channel scheme
   * const channelRequirements = {
   *   scheme: 'channel',
   *   payTo: 'ServerPubkey...',
   *   maxAmountRequired: '10000',
   *   // ... other fields
   * };
   *
   * const result = await verifier.verifyX402Payment(
   *   header,
   *   channelRequirements,
   *   {},
   *   'YourChannelProgram111111111111111111111111'
   * );
   * ```
   */
  async verifyX402Payment(
    paymentHeader: string | undefined,
    paymentRequirements: PaymentAccept,
    options: VerificationOptions | ChannelVerificationOptions = {},
    channelProgramId?: string
  ): Promise<VerificationResult> {
    try {
      // Parse and validate X-PAYMENT header
      const expectedNetwork =
        paymentRequirements.network === 'solana-mainnet'
          ? 'solana-mainnet'
          : 'solana-devnet';

      const parseResult = parseAndValidateSolanaPayment(
        paymentHeader,
        expectedNetwork
      );

      if (!parseResult.success) {
        return createInvalidHeaderError(parseResult.error || 'Invalid payment header');
      }

      const payment = parseResult.payment!;

      // Route based on payment scheme
      if (payment.scheme === 'channel') {
        return this.verifyChannelPayment(
          payment,
          paymentRequirements,
          options as ChannelVerificationOptions,
          channelProgramId
        );
      } else if (payment.scheme === 'exact') {
        return this.verifyExactPayment(payment, paymentRequirements, options as VerificationOptions);
      } else {
        return createInvalidHeaderError(
          `Unsupported payment scheme: ${payment.scheme}`
        );
      }
    } catch (error: any) {
      return createVerificationError(error.message, error);
    }
  }

  /**
   * Verify 'exact' scheme payment (on-chain transaction)
   * @private
   */
  private async verifyExactPayment(
    payment: X402Payment,
    paymentRequirements: PaymentAccept,
    options: VerificationOptions
  ): Promise<VerificationResult> {
    // Extract transaction signature
    let signature: string | null = null;

    // Try to get signature directly from payload (backwards compatibility)
    if (payment.payload.signature) {
      signature = payment.payload.signature;
    }
    // Try to deserialize transaction to get signature (official x402 format)
    else if (payment.payload.serializedTransaction) {
      signature = await this.extractSignatureFromSerializedTransaction(
        payment.payload.serializedTransaction
      );

      if (!signature) {
        return createInvalidHeaderError(
          'Could not extract signature from serialized transaction'
        );
      }
    } else {
      return createInvalidHeaderError(
        'Payment payload must contain either signature or serializedTransaction'
      );
    }

    // Verify the payment using extracted signature
    return this.verifyPayment(
      signature,
      paymentRequirements.payTo,
      parseFloat(paymentRequirements.maxAmountRequired) / 1_000_000, // Convert micro-USDC to USD
      options
    );
  }

  /**
   * Verify 'channel' scheme payment (off-chain payment channel)
   * @private
   */
  private async verifyChannelPayment(
    payment: X402Payment,
    paymentRequirements: PaymentAccept,
    options: ChannelVerificationOptions,
    channelProgramId?: string
  ): Promise<VerificationResult> {
    // Validate channel program ID is provided
    if (!channelProgramId) {
      return createInvalidHeaderError(
        'channelProgramId is required for channel scheme verification'
      );
    }

    // Extract channel payload
    const channelPayload: ChannelPayload = {
      channelId: payment.payload.channelId!,
      amount: payment.payload.amount!,
      nonce: payment.payload.nonce!,
      signature: payment.payload.channelSignature!,
      expiry: payment.payload.expiry,
    };

    // Create channel verifier
    const channelVerifier = new ChannelPaymentVerifier({
      connection: this.connection,
      programId: channelProgramId,
    });

    // Verify channel payment
    return channelVerifier.verifyChannelPayment(
      channelPayload,
      paymentRequirements.payTo, // Expected server public key
      {
        expectedServer: options.expectedServer,
        minClaimIncrement: options.minClaimIncrement,
        skipExpiryCheck: options.skipExpiryCheck,
      }
    );
  }

  /**
   * Extract transaction signature from serialized transaction
   * Handles both legacy and versioned transactions
   *
   * @param serializedTransaction - Base64-encoded serialized transaction
   * @returns Transaction signature or null if extraction fails
   */
  private async extractSignatureFromSerializedTransaction(
    serializedTransaction: string
  ): Promise<string | null> {
    try {
      // Decode from base64
      const txBuffer = Buffer.from(serializedTransaction, 'base64');

      // Try to deserialize as versioned transaction first
      try {
        const versionedTx = VersionedTransaction.deserialize(txBuffer);
        // Get first signature (payer signature) and encode as base58
        const signatureBuffer = versionedTx.signatures[0];
        return bs58.encode(signatureBuffer);
      } catch {
        // Fallback to legacy transaction
        try {
          const legacyTx = Transaction.from(txBuffer);
          // Get first signature and encode as base58
          const signatureBuffer = legacyTx.signatures[0]?.signature;
          return signatureBuffer ? bs58.encode(signatureBuffer) : null;
        } catch {
          return null;
        }
      }
    } catch (error) {
      console.error('Error extracting signature from serialized transaction:', error);
      return null;
    }
  }

  /**
   * Verify payment from X402Payment object
   * Alternative to verifyX402Payment that accepts parsed payment object
   *
   * @param payment - Parsed X402Payment object
   * @param paymentRequirements - Payment requirements
   * @param options - Verification options
   * @returns Verification result
   */
  async verifyX402PaymentObject(
    payment: X402Payment,
    paymentRequirements: PaymentAccept,
    options: VerificationOptions = {}
  ): Promise<VerificationResult> {
    try {
      // Extract signature from payment
      let signature: string | null = payment.payload.signature || null;

      if (!signature && payment.payload.serializedTransaction) {
        signature = await this.extractSignatureFromSerializedTransaction(
          payment.payload.serializedTransaction
        );
      }

      if (!signature) {
        return createInvalidHeaderError('Could not extract transaction signature');
      }

      // Verify the payment
      return this.verifyPayment(
        signature,
        paymentRequirements.payTo,
        parseFloat(paymentRequirements.maxAmountRequired) / 1_000_000,
        options
      );
    } catch (error: any) {
      return createVerificationError(error.message, error);
    }
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
