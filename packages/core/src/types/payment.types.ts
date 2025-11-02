/**
 * Payment flow types for generators and handlers
 */

/**
 * Options for generating payment requirements
 */
export interface GeneratePaymentOptions {
  /** Resource being paid for (optional) */
  resource?: string;

  /** Description of what payment is for */
  description?: string;

  /** Custom error message */
  errorMessage?: string;

  /** Payment timeout in seconds (default: 300) */
  timeoutSeconds?: number;

  /** Additional metadata to include */
  metadata?: Record<string, any>;
}

/**
 * Options for generating payment receipts
 */
export interface GenerateReceiptOptions {
  /** Whether to include full transaction details */
  includeDetails?: boolean;

  /** Additional metadata to include */
  metadata?: Record<string, any>;
}

/**
 * Payment receipt details
 */
export interface PaymentReceiptDetails {
  /** Transaction signature */
  signature: string;

  /** Network identifier */
  network: string;

  /** Amount paid in micro-USDC */
  amount: number;

  /** Payer address (authority) */
  payer: string;

  /** Recipient address (token account) */
  recipient: string;

  /** Timestamp of verification */
  timestamp: number;

  /** Block time */
  blockTime?: number;

  /** Slot */
  slot?: number;
}

/**
 * Configuration for payment requirements generator
 */
export interface GeneratorConfig {
  /** Recipient wallet address (base58 public key) */
  recipientWallet: string;

  /** Solana network */
  network: 'devnet' | 'mainnet-beta';
}

/**
 * Payment status
 */
export enum PaymentStatus {
  /** Payment not yet made */
  PENDING = 'pending',

  /** Payment verification in progress */
  VERIFYING = 'verifying',

  /** Payment verified successfully */
  VERIFIED = 'verified',

  /** Payment failed verification */
  FAILED = 'failed',

  /** Payment expired */
  EXPIRED = 'expired',
}

/**
 * Payment transaction details
 */
export interface PaymentTransaction {
  /** Transaction signature */
  signature: string;

  /** Payment status */
  status: PaymentStatus;

  /** Amount in micro-USDC */
  amount: number;

  /** Recipient token account */
  recipient: string;

  /** Payer wallet */
  payer: string;

  /** Network */
  network: string;

  /** Created at timestamp */
  createdAt: number;

  /** Verified at timestamp (if verified) */
  verifiedAt?: number;

  /** Error message (if failed) */
  error?: string;
}

/**
 * Batch payment request
 */
export interface BatchPaymentRequest {
  /** List of recipients (wallet addresses) */
  recipients: string[];

  /** Amount to send to each recipient (USD) */
  amountUSD: number;

  /** Optional: different amounts per recipient */
  amounts?: number[];
}

/**
 * Batch payment result
 */
export interface BatchPaymentResult {
  /** Number of successful payments */
  successful: number;

  /** Number of failed payments */
  failed: number;

  /** List of transaction signatures (successful) */
  signatures: string[];

  /** List of errors (failed) */
  errors: Array<{
    recipient: string;
    error: string;
  }>;
}
