/**
 * @x402-solana/core
 *
 * Core payment verification and x402 protocol implementation for Solana
 *
 * This package provides the foundational components for implementing x402 payment protocol
 * on Solana, including transaction verification, USDC payment validation, payment requirements
 * generation, and comprehensive error handling.
 *
 * @example Basic Usage
 * ```typescript
 * import {
 *   TransactionVerifier,
 *   PaymentRequirementsGenerator,
 * } from '@x402-solana/core';
 *
 * // Server-side: Verify payments
 * const verifier = new TransactionVerifier({
 *   rpcUrl: 'https://api.devnet.solana.com',
 *   commitment: 'confirmed',
 * });
 *
 * const result = await verifier.verifyPayment(
 *   signature,
 *   recipientUSDCAccount,
 *   0.001 // $0.001
 * );
 *
 * if (result.valid) {
 *   console.log('Payment verified!');
 * }
 *
 * // Server-side: Generate payment requirements
 * const generator = new PaymentRequirementsGenerator({
 *   recipientWallet: 'YourWallet...',
 *   network: 'devnet',
 * });
 *
 * const requirements = generator.generate(0.001, {
 *   description: 'API access',
 *   resource: '/api/data',
 * });
 *
 * // Return in 402 response
 * res.status(402).json(requirements);
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// Type Definitions
// ============================================================================

export * from './types';

// ============================================================================
// Verifier Components
// ============================================================================

export {
  TransactionVerifier,
  ChannelPaymentVerifier,
  verifyUSDCTransfer,
  IPaymentCache,
  RedisPaymentCache,
  InMemoryPaymentCache,
  createPaymentCache,
  createSuccessResult,
  createErrorResult,
  createReplayAttackError,
  createTransactionNotFoundError,
  createTransactionFailedError,
  createNoUSDCTransferError,
  createTransferMismatchError,
  createTransactionExpiredError,
  createInvalidHeaderError,
  createVerificationError,
  isVerificationSuccessful,
  getErrorMessage,
  getErrorCode,
  formatVerificationResult,
} from './verifier';

export type {
  ChannelState,
  ChannelVerifierConfig,
  ChannelVerificationOptions,
} from './verifier/channel-verifier';

// ============================================================================
// Generator Components
// ============================================================================

export {
  PaymentRequirementsGenerator,
  generatePaymentReceipt,
  generateDetailedReceipt,
  encodePaymentReceipt,
  decodePaymentReceipt,
  formatPaymentReceipt,
  isValidPaymentReceipt,
  createFailedReceipt,
  createPendingReceipt,
  createErrorResponse,
  createUserFriendlyError,
  formatErrorForAPI,
  isRetryableError,
  requiresNewPayment,
  getSuggestedAction,
} from './generator';

// ============================================================================
// Facilitator Components (x402 Protocol)
// ============================================================================

export { X402Facilitator, createFacilitator } from './facilitator';
export type { FacilitatorConfig } from './facilitator';

// ============================================================================
// Utility Functions
// ============================================================================

export {
  // Currency conversion
  usdToMicroUSDC,
  microUSDCToUSD,
  formatMicroUSDC,
  parseUSDString,
  isPaymentSufficient,
  calculatePaymentDifference,
  USDC_DECIMALS,
  USD_TO_MICRO_USDC,

  // Address validation
  isValidSolanaAddress,
  isValidSignature,
  isUSDCMint,
  getUSDCMint,
  normalizeNetwork,
  extractNetworkFromX402,
  formatNetworkForX402,
  areAddressesEqual,

  // Transaction parsing
  parseTransaction,
  extractUSDCTransfers,
  findTransferByDestination,
  findMatchingTransfers,
  sumTransferAmounts,

  // Retry handling
  withRetry,
  sleep,
  isNetworkError,
  isRPCError,
  isRetryableError as isRetryableRPCError,
  createRetryHandler,
  batchRetry,
  sequentialRetry,
  withRetryAndTimeout,
  TRANSACTION_FETCH_RETRY_CONFIG,
  TRANSACTION_CONFIRM_RETRY_CONFIG,
} from './utils';

// ============================================================================
// x402 Protocol Utilities
// ============================================================================

export {
  parseX402Payment,
  encodeX402Payment,
  parseAndValidateSolanaPayment,
  isValidSolanaNetwork,
  validateSolanaPayload,
  extractSignature,
  createSolanaPaymentHeader,
  createSolanaPaymentHeaderWithTransaction,
  createChannelPaymentHeader,
  X402ParseError,
} from './utils/x402-parser';

export type { ParseResult } from './utils/x402-parser';

// ============================================================================
// Version
// ============================================================================

export const VERSION = '0.1.0';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configuration values
 */
export const DEFAULTS = {
  /** Default commitment level for RPC calls */
  COMMITMENT: 'confirmed' as const,

  /** Default maximum payment age (5 minutes) */
  MAX_PAYMENT_AGE_MS: 300_000,

  /** Default cache TTL (10 minutes) */
  CACHE_TTL_SECONDS: 600,

  /** Default payment timeout (5 minutes) */
  PAYMENT_TIMEOUT_SECONDS: 300,

  /** Default RPC retry count */
  MAX_RPC_RETRIES: 3,

  /** Default retry delay (100ms) */
  RETRY_DELAY_MS: 100,
} as const;

/**
 * Solana network identifiers
 */
export const NETWORKS = {
  DEVNET: 'devnet',
  MAINNET: 'mainnet-beta',
  TESTNET: 'testnet',
  LOCALNET: 'localnet',
} as const;

/**
 * x402 protocol version
 */
export const X402_VERSION = 1;
