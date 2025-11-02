/**
 * Shared types for @x402-solana/server
 */

import { X402Payment } from '@x402-solana/core';

/**
 * Configuration for x402 middleware/guards
 */
export interface X402Config {
  /** Solana RPC URL */
  solanaRpcUrl: string;

  /** Recipient wallet address (base58 public key) */
  recipientWallet: string;

  /** Solana network */
  network: 'devnet' | 'mainnet-beta';

  /** Optional: Redis configuration for payment caching */
  redis?: {
    /** Redis connection URL */
    url: string;
  };

  /** Optional: Maximum payment age in milliseconds (default: 300000 = 5 minutes) */
  maxPaymentAgeMs?: number;

  /** Optional: Maximum retries for RPC calls (default: 3) */
  maxRetries?: number;

  /** Optional: Retry delay in milliseconds (default: 100) */
  retryDelayMs?: number;

  /** Optional: RPC commitment level (default: 'confirmed') */
  commitment?: 'processed' | 'confirmed' | 'finalized';
}

/**
 * Options for payment requirement middleware
 */
export interface MiddlewareOptions {
  /** Resource being paid for (optional) */
  resource?: string;

  /** Description of what payment is for */
  description?: string;

  /** Payment timeout in seconds (default: 300) */
  timeoutSeconds?: number;

  /** Skip cache check (for testing) */
  skipCacheCheck?: boolean;

  /** Custom error message */
  errorMessage?: string;
}

/**
 * Payment information attached to request
 */
export interface PaymentInfo {
  /** Transaction signature */
  signature: string;

  /** Amount paid in USD */
  amountUSD: number;

  /** Payer wallet address */
  payer: string;

  /** Block time (Unix timestamp) */
  blockTime?: number;

  /** Slot number */
  slot?: number;
}

/**
 * Error response for failed payment verification
 */
export interface X402ErrorResponse {
  /** Error message */
  error: string;

  /** Error code */
  code?: string;

  /** Debug information */
  debug?: any;
}

/**
 * Extended Express Request type with payment information
 */
export interface RequestWithPayment {
  payment?: PaymentInfo;
}

/**
 * Decoded payment from X-PAYMENT header
 */
export interface DecodedPayment extends X402Payment {
  /** Raw header value */
  rawHeader: string;
}
