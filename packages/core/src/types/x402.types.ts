/**
 * Core x402 protocol types
 * Based on official x402 specification from Coinbase
 * Reference: https://github.com/coinbase/x402
 */

/**
 * Payment requirements returned in 402 responses
 * Tells clients how to pay for access to a resource
 *
 * Official x402 protocol format - DO NOT modify without updating spec compliance
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
 * Compliant with official x402 specification
 */
export interface PaymentAccept {
  /** Payment scheme - use 'exact' for fixed-amount payments */
  scheme: string;

  /** Network identifier (e.g., 'solana-devnet', 'solana-mainnet') */
  network: string;

  /** Maximum amount required in smallest unit (micro-USDC for Solana) */
  maxAmountRequired: string;

  /** Resource being paid for */
  resource: string;

  /** Description of what payment is for */
  description: string;

  /** MIME type of the resource (e.g., 'application/json') */
  mimeType: string;

  /** Optional JSON schema for response output */
  outputSchema?: object | null;

  /** Payment destination address (token account for Solana) */
  payTo: string;

  /** Timeout in seconds for payment to be valid */
  maxTimeoutSeconds: number;

  /** Asset identifier (e.g., USDC mint address) */
  asset: string;

  /** Optional additional data (scheme-specific) */
  extra?: object | null;
}

/**
 * Payment proof sent by client in X-PAYMENT header
 * Sent as base64-encoded JSON
 *
 * Official x402 format
 */
export interface X402Payment {
  /** x402 protocol version */
  x402Version: number;

  /** Payment scheme used (e.g., 'exact') */
  scheme: string;

  /** Network where payment was made (e.g., 'solana-devnet') */
  network: string;

  /** Payment-specific payload (scheme and network dependent) */
  payload: PaymentPayload;
}

/**
 * Payment payload (scheme and network specific)
 *
 * For Solana 'exact' scheme:
 * - Contains base64-encoded serialized transaction
 * - Transaction must include SPL token transfer instruction
 *
 * For Solana 'channel' scheme:
 * - Contains payment channel claim data
 * - Verified off-chain against channel state
 *
 * For EVM chains:
 * - Would contain different data structure
 */
export interface PaymentPayload {
  /** For Solana 'exact': base64-encoded serialized transaction */
  serializedTransaction?: string;

  /** For Solana 'exact': transaction signature (backwards compatibility) */
  signature?: string;

  /** For Solana 'channel': Base58-encoded channel PDA address */
  channelId?: string;

  /** For Solana 'channel': Cumulative amount claimed (string for bigint) */
  amount?: string;

  /** For Solana 'channel': Current nonce (string for bigint) */
  nonce?: string;

  /** For Solana 'channel': Base64-encoded Ed25519 signature (64 bytes) */
  channelSignature?: string;

  /** For Solana 'channel': Optional expiry timestamp (Unix seconds) */
  expiry?: string;

  /** Scheme-specific additional data */
  [key: string]: any;
}

/**
 * Payment channel payload interface
 * Used for scheme: 'channel' payments
 *
 * Structure:
 * - channelId: Base58-encoded PDA of the channel account
 * - amount: Total cumulative amount claimed from channel (micro-USDC)
 * - nonce: Monotonically increasing counter for replay protection
 * - signature: Ed25519 signature over domain + channelId + server + amount + nonce + expiry
 * - expiry: Optional Unix timestamp when claim expires
 */
export interface ChannelPayload {
  /** Base58-encoded channel PDA address */
  channelId: string;

  /** Total cumulative amount claimed in micro-USDC (string to support bigint) */
  amount: string;

  /** Current nonce for replay protection (string to support bigint) */
  nonce: string;

  /** Base64-encoded Ed25519 signature (64 bytes) */
  signature: string;

  /** Optional: Unix timestamp when claim expires */
  expiry?: string;
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

  // Payment channel error codes
  /** Channel not found on-chain */
  CHANNEL_NOT_FOUND = 'CHANNEL_NOT_FOUND',

  /** Channel is not in Open status */
  CHANNEL_NOT_OPEN = 'CHANNEL_NOT_OPEN',

  /** Channel signature verification failed */
  CHANNEL_INVALID_SIGNATURE = 'CHANNEL_INVALID_SIGNATURE',

  /** Channel claim nonce is not greater than current nonce */
  CHANNEL_INVALID_NONCE = 'CHANNEL_INVALID_NONCE',

  /** Channel claim amount is less than current server claimed amount */
  CHANNEL_AMOUNT_BACKWARDS = 'CHANNEL_AMOUNT_BACKWARDS',

  /** Channel claim amount exceeds available balance */
  CHANNEL_INSUFFICIENT_BALANCE = 'CHANNEL_INSUFFICIENT_BALANCE',

  /** Channel claim has expired */
  CHANNEL_CLAIM_EXPIRED = 'CHANNEL_CLAIM_EXPIRED',

  /** Server pubkey doesn't match expected recipient */
  CHANNEL_WRONG_SERVER = 'CHANNEL_WRONG_SERVER',

  /** Invalid channel payload */
  CHANNEL_INVALID_PAYLOAD = 'CHANNEL_INVALID_PAYLOAD',
}

/**
 * Facilitator API types
 * Official x402 protocol facilitator endpoints
 */

/**
 * Request body for POST /verify endpoint
 * Validates payment without blockchain interaction
 */
export interface VerifyRequest {
  /** x402 protocol version */
  x402Version: number;

  /** Payment header data (X-PAYMENT header contents) */
  paymentHeader: X402Payment;

  /** Payment requirements that were requested */
  paymentRequirements: PaymentAccept;
}

/**
 * Response from POST /verify endpoint
 */
export interface VerifyResponse {
  /** Whether payment is valid */
  isValid: boolean;

  /** Reason why payment is invalid (if isValid is false) */
  invalidReason: string | null;
}

/**
 * Request body for POST /settle endpoint
 * Executes payment on blockchain
 */
export interface SettleRequest {
  /** x402 protocol version */
  x402Version: number;

  /** Payment header data (X-PAYMENT header contents) */
  paymentHeader: X402Payment;

  /** Payment requirements that were requested */
  paymentRequirements: PaymentAccept;
}

/**
 * Response from POST /settle endpoint
 */
export interface SettleResponse {
  /** Whether settlement was successful */
  success: boolean;

  /** Error message if settlement failed */
  error: string | null;

  /** Transaction hash/signature if successful */
  txHash: string | null;

  /** Network identifier where transaction was executed */
  networkId: string | null;
}

/**
 * Supported scheme/network pair
 */
export interface SupportedPair {
  /** Payment scheme (e.g., 'exact') */
  scheme: string;

  /** Network identifier (e.g., 'solana-devnet') */
  network: string;
}

/**
 * Response from GET /supported endpoint
 * Lists all supported (scheme, network) combinations
 */
export interface SupportedResponse {
  /** Array of supported scheme/network pairs */
  supported: SupportedPair[];
}
