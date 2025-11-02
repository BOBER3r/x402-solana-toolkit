/**
 * Type definitions for x402 protocol
 */

/**
 * Payment requirements returned in 402 response
 */
export interface PaymentRequirements {
  /** x402 protocol version */
  x402Version: number;

  /** List of accepted payment methods */
  accepts: PaymentAccept[];

  /** Error message describing why payment is required */
  error: string;
}

/**
 * A specific payment method accepted by the server
 */
export interface PaymentAccept {
  /** Payment scheme (e.g., "solana-usdc") */
  scheme: string;

  /** Network identifier (e.g., "devnet", "mainnet-beta") */
  network: string;

  /** Maximum amount in micro-units (e.g., micro-USDC) */
  maxAmountRequired: string;

  /** Resource identifier this payment grants access to */
  resource: string;

  /** Human-readable description of the payment */
  description: string;

  /** Payment destination details */
  payTo: {
    /** Recipient's token account address */
    address: string;

    /** Token mint address (e.g., USDC mint) */
    asset: string;
  };

  /** Payment timeout in seconds */
  timeout: number;
}

/**
 * Information about a completed payment
 */
export interface PaymentInfo {
  /** Transaction signature on Solana */
  signature: string;

  /** Amount paid in micro-units */
  amount: number;

  /** Timestamp when payment was made */
  timestamp: number;

  /** Public key of the payer */
  payer: string;
}

/**
 * Payment proof sent in X-PAYMENT header
 */
export interface PaymentProof {
  /** x402 protocol version */
  x402Version: number;

  /** Payment scheme used */
  scheme: string;

  /** Network where payment was made */
  network: string;

  /** Payment-specific data */
  payload: {
    /** Transaction signature */
    signature: string;
  };
}

/**
 * Error thrown when payment fails
 */
export class PaymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

/**
 * Error codes for payment failures
 */
export enum PaymentErrorCode {
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  CONFIRMATION_TIMEOUT = 'CONFIRMATION_TIMEOUT',
  INVALID_PAYMENT_REQUIREMENTS = 'INVALID_PAYMENT_REQUIREMENTS',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNSUPPORTED_PAYMENT_METHOD = 'UNSUPPORTED_PAYMENT_METHOD',
}
