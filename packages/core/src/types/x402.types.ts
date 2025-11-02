/**
 * Core x402 protocol types
 * Based on x402 specification for payment-required responses
 */

/**
 * Payment requirements returned in 402 responses
 * Tells clients how to pay for access to a resource
 */
export interface PaymentRequirements {
  /** x402 protocol version (currently 1) */
  x402Version: number;

  /** List of acceptable payment methods */
  accepts: PaymentAccept[];

  /** Human-readable error message */
  error: string;
}

/**
 * A single acceptable payment method
 */
export interface PaymentAccept {
  /** Payment scheme (e.g., 'exact', 'streaming') */
  scheme: string;

  /** Network identifier (e.g., 'solana-devnet', 'solana-mainnet') */
  network: string;

  /** Maximum amount required in smallest unit (micro-USDC for Solana) */
  maxAmountRequired: string;

  /** Resource being paid for (optional) */
  resource?: string;

  /** Description of what payment is for */
  description: string;

  /** Payment destination details */
  payTo: PaymentDestination;

  /** Timeout in seconds for payment to be valid */
  timeout: number;
}

/**
 * Payment destination information
 */
export interface PaymentDestination {
  /** Recipient address (MUST be token account for Solana, not wallet) */
  address: string;

  /** Asset identifier (e.g., USDC mint address) */
  asset: string;
}

/**
 * Payment proof sent by client in X-PAYMENT header
 */
export interface X402Payment {
  /** x402 protocol version */
  x402Version: number;

  /** Payment scheme used */
  scheme: string;

  /** Network where payment was made */
  network: string;

  /** Payment-specific payload */
  payload: PaymentPayload;
}

/**
 * Payment payload (scheme-specific)
 * For Solana: contains transaction signature
 */
export interface PaymentPayload {
  /** Solana transaction signature */
  signature: string;

  /** Optional: additional metadata */
  [key: string]: any;
}

/**
 * Payment receipt returned in X-PAYMENT-RESPONSE header
 */
export interface PaymentReceipt {
  /** Transaction signature */
  signature: string;

  /** Network where payment was verified */
  network: string;

  /** Amount paid in smallest unit (micro-USDC) */
  amount: number;

  /** Timestamp when payment was verified */
  timestamp: number;

  /** Verification status */
  status: 'verified' | 'pending' | 'failed';

  /** Optional: block information */
  blockTime?: number;
  slot?: number;
}

/**
 * Simplified payment details for 402 responses
 * Used in the simplified Solana-specific protocol
 */
export interface SimplifiedPaymentDetails {
  /** Recipient wallet address */
  recipient: string;

  /** Amount in USD (e.g., 0.01 = $0.01) */
  amount: number;

  /** Currency (always 'USDC' for Solana) */
  currency: 'USDC';

  /** Network identifier (always 'solana') */
  network: 'solana';

  /** USDC mint address */
  mint: string;

  /** Optional: description of what payment is for */
  description?: string;

  /** Optional: resource being paid for */
  resource?: string;
}

/**
 * Simplified 402 response format
 * Simpler than full x402 protocol for Solana-specific use cases
 */
export interface Simplified402Response {
  /** Error message */
  error: string;

  /** Payment details */
  paymentDetails: SimplifiedPaymentDetails;
}

/**
 * Error response for failed payment verification
 */
export interface X402Error {
  /** Error code for programmatic handling */
  code: X402ErrorCode;

  /** Human-readable error message */
  message: string;

  /** Additional debug information */
  debug?: any;
}

/**
 * Standard error codes for x402 on Solana
 */
export enum X402ErrorCode {
  /** Payment signature already used */
  REPLAY_ATTACK = 'REPLAY_ATTACK',

  /** Transaction not found on blockchain */
  TX_NOT_FOUND = 'TX_NOT_FOUND',

  /** Transaction failed on blockchain */
  TX_FAILED = 'TX_FAILED',

  /** No USDC transfer found in transaction */
  NO_USDC_TRANSFER = 'NO_USDC_TRANSFER',

  /** Transfer doesn't match expected recipient or amount */
  TRANSFER_MISMATCH = 'TRANSFER_MISMATCH',

  /** Transaction is too old */
  TX_EXPIRED = 'TX_EXPIRED',

  /** Invalid payment header format */
  INVALID_HEADER = 'INVALID_HEADER',

  /** Insufficient amount paid */
  INSUFFICIENT_AMOUNT = 'INSUFFICIENT_AMOUNT',

  /** Wrong token (not USDC) */
  WRONG_TOKEN = 'WRONG_TOKEN',

  /** Internal verification error */
  VERIFICATION_ERROR = 'VERIFICATION_ERROR',
}
