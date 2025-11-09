/**
 * X-PAYMENT header parsing and validation utilities
 * Compliant with official x402 protocol specification
 *
 * Reference: https://github.com/coinbase/x402
 */

import { X402Payment, PaymentPayload } from '../types/x402.types';

/**
 * Result of parsing X-PAYMENT header
 */
export interface ParseResult {
  /** Whether parsing was successful */
  success: boolean;

  /** Parsed payment data (if successful) */
  payment?: X402Payment;

  /** Error message (if failed) */
  error?: string;

  /** Error code for programmatic handling */
  code?: string;
}

/**
 * Validation error codes
 */
export enum X402ParseError {
  /** Header is missing or empty */
  MISSING_HEADER = 'MISSING_HEADER',

  /** Header is not valid base64 */
  INVALID_BASE64 = 'INVALID_BASE64',

  /** JSON parsing failed */
  INVALID_JSON = 'INVALID_JSON',

  /** Missing required field */
  MISSING_FIELD = 'MISSING_FIELD',

  /** Invalid field value */
  INVALID_FIELD = 'INVALID_FIELD',

  /** Unsupported protocol version */
  UNSUPPORTED_VERSION = 'UNSUPPORTED_VERSION',

  /** Unsupported scheme */
  UNSUPPORTED_SCHEME = 'UNSUPPORTED_SCHEME',

  /** Invalid network identifier */
  INVALID_NETWORK = 'INVALID_NETWORK',

  /** Invalid payload for scheme */
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',
}

/**
 * Parse X-PAYMENT header from base64-encoded JSON
 *
 * @param header - Base64-encoded X-PAYMENT header value
 * @returns Parse result with payment data or error
 *
 * @example
 * ```typescript
 * const result = parseX402Payment(req.headers['x-payment']);
 * if (result.success) {
 *   console.log('Payment scheme:', result.payment.scheme);
 *   console.log('Network:', result.payment.network);
 * } else {
 *   console.error('Parse error:', result.error);
 * }
 * ```
 */
export function parseX402Payment(header: string | undefined): ParseResult {
  // Check if header exists
  if (!header || header.trim().length === 0) {
    return {
      success: false,
      error: 'X-PAYMENT header is missing or empty',
      code: X402ParseError.MISSING_HEADER,
    };
  }

  // Decode from base64
  let decodedJson: string;
  try {
    decodedJson = Buffer.from(header, 'base64').toString('utf-8');
  } catch (error) {
    return {
      success: false,
      error: 'X-PAYMENT header is not valid base64',
      code: X402ParseError.INVALID_BASE64,
    };
  }

  // Parse JSON
  let payment: any;
  try {
    payment = JSON.parse(decodedJson);
  } catch (error) {
    return {
      success: false,
      error: 'X-PAYMENT header contains invalid JSON',
      code: X402ParseError.INVALID_JSON,
    };
  }

  // Validate required fields
  if (typeof payment.x402Version !== 'number') {
    return {
      success: false,
      error: 'Missing or invalid x402Version field',
      code: X402ParseError.MISSING_FIELD,
    };
  }

  if (typeof payment.scheme !== 'string' || payment.scheme.length === 0) {
    return {
      success: false,
      error: 'Missing or invalid scheme field',
      code: X402ParseError.MISSING_FIELD,
    };
  }

  if (typeof payment.network !== 'string' || payment.network.length === 0) {
    return {
      success: false,
      error: 'Missing or invalid network field',
      code: X402ParseError.MISSING_FIELD,
    };
  }

  if (!payment.payload || typeof payment.payload !== 'object') {
    return {
      success: false,
      error: 'Missing or invalid payload field',
      code: X402ParseError.MISSING_FIELD,
    };
  }

  // Validate protocol version
  if (payment.x402Version !== 1) {
    return {
      success: false,
      error: `Unsupported x402 protocol version: ${payment.x402Version}`,
      code: X402ParseError.UNSUPPORTED_VERSION,
    };
  }

  // Return parsed payment
  return {
    success: true,
    payment: payment as X402Payment,
  };
}

/**
 * Encode X-PAYMENT header to base64 JSON
 *
 * @param payment - Payment object to encode
 * @returns Base64-encoded string for X-PAYMENT header
 *
 * @example
 * ```typescript
 * const payment: X402Payment = {
 *   x402Version: 1,
 *   scheme: 'exact',
 *   network: 'solana-devnet',
 *   payload: { signature: 'abc123...' }
 * };
 * const header = encodeX402Payment(payment);
 * // Use in HTTP request: headers['X-PAYMENT'] = header
 * ```
 */
export function encodeX402Payment(payment: X402Payment): string {
  return Buffer.from(JSON.stringify(payment)).toString('base64');
}

/**
 * Validate Solana network identifier
 *
 * @param network - Network identifier to validate
 * @returns True if valid Solana network
 */
export function isValidSolanaNetwork(network: string): boolean {
  return network === 'solana-devnet' || network === 'solana-mainnet';
}

/**
 * Validate payment payload for Solana schemes
 * Supports both 'exact' (on-chain) and 'channel' (off-chain) schemes
 *
 * @param payload - Payment payload to validate
 * @param scheme - Payment scheme ('exact' or 'channel')
 * @returns Validation result
 */
export function validateSolanaPayload(
  payload: PaymentPayload,
  scheme: string
): ParseResult {
  if (scheme === 'exact') {
    return validateExactPayload(payload);
  } else if (scheme === 'channel') {
    return validateChannelPayload(payload);
  } else {
    return {
      success: false,
      error: `Unsupported scheme for Solana: ${scheme}`,
      code: X402ParseError.UNSUPPORTED_SCHEME,
    };
  }
}

/**
 * Validate payload for 'exact' scheme (on-chain transaction)
 * Requires either 'serializedTransaction' or 'signature' field
 *
 * @param payload - Payment payload to validate
 * @returns Validation result
 */
function validateExactPayload(payload: PaymentPayload): ParseResult {
  // Check for serializedTransaction (official x402 format)
  const hasSerializedTx =
    typeof payload.serializedTransaction === 'string' &&
    payload.serializedTransaction.length > 0;

  // Check for signature (backwards compatibility)
  const hasSignature =
    typeof payload.signature === 'string' && payload.signature.length > 0;

  if (!hasSerializedTx && !hasSignature) {
    return {
      success: false,
      error:
        'Payload must contain either serializedTransaction or signature field',
      code: X402ParseError.INVALID_PAYLOAD,
    };
  }

  return {
    success: true,
  };
}

/**
 * Validate payload for 'channel' scheme (off-chain channel payment)
 * Requires channelId, amount, nonce, and signature fields
 *
 * @param payload - Payment payload to validate
 * @returns Validation result
 */
function validateChannelPayload(payload: PaymentPayload): ParseResult {
  // Check for required fields
  if (!payload.channelId || typeof payload.channelId !== 'string') {
    return {
      success: false,
      error: 'Channel payload must contain channelId field',
      code: X402ParseError.INVALID_PAYLOAD,
    };
  }

  if (!payload.amount || typeof payload.amount !== 'string') {
    return {
      success: false,
      error: 'Channel payload must contain amount field',
      code: X402ParseError.INVALID_PAYLOAD,
    };
  }

  if (!payload.nonce || typeof payload.nonce !== 'string') {
    return {
      success: false,
      error: 'Channel payload must contain nonce field',
      code: X402ParseError.INVALID_PAYLOAD,
    };
  }

  if (!payload.channelSignature || typeof payload.channelSignature !== 'string') {
    return {
      success: false,
      error: 'Channel payload must contain channelSignature field',
      code: X402ParseError.INVALID_PAYLOAD,
    };
  }

  // Validate amount format
  try {
    const amount = BigInt(payload.amount);
    if (amount < 0n) {
      return {
        success: false,
        error: 'Channel amount cannot be negative',
        code: X402ParseError.INVALID_PAYLOAD,
      };
    }
  } catch {
    return {
      success: false,
      error: `Invalid channel amount format: ${payload.amount}`,
      code: X402ParseError.INVALID_PAYLOAD,
    };
  }

  // Validate nonce format
  try {
    const nonce = BigInt(payload.nonce);
    if (nonce < 0n) {
      return {
        success: false,
        error: 'Channel nonce cannot be negative',
        code: X402ParseError.INVALID_PAYLOAD,
      };
    }
  } catch {
    return {
      success: false,
      error: `Invalid channel nonce format: ${payload.nonce}`,
      code: X402ParseError.INVALID_PAYLOAD,
    };
  }

  // Validate expiry format (if provided)
  if (payload.expiry !== undefined) {
    try {
      const expiry = BigInt(payload.expiry);
      if (expiry < 0n) {
        return {
          success: false,
          error: 'Channel expiry cannot be negative',
          code: X402ParseError.INVALID_PAYLOAD,
        };
      }
    } catch {
      return {
        success: false,
        error: `Invalid channel expiry format: ${payload.expiry}`,
        code: X402ParseError.INVALID_PAYLOAD,
      };
    }
  }

  return {
    success: true,
  };
}

/**
 * Extract transaction signature from payment payload
 * Handles both serializedTransaction and signature formats
 *
 * @param payload - Payment payload
 * @returns Transaction signature or null if not found
 */
export function extractSignature(payload: PaymentPayload): string | null {
  // If signature is directly provided (backwards compatibility)
  if (payload.signature) {
    return payload.signature;
  }

  // If serializedTransaction is provided, we'll need to deserialize it
  // to get the signature (handled by TransactionVerifier)
  if (payload.serializedTransaction) {
    return null; // Will be extracted during verification
  }

  return null;
}

/**
 * Parse and validate X-PAYMENT header for Solana
 * Performs full validation including network and payload checks
 *
 * @param header - X-PAYMENT header value
 * @param expectedNetwork - Expected network (solana-devnet or solana-mainnet)
 * @returns Parse result with validated payment data
 *
 * @example
 * ```typescript
 * const result = parseAndValidateSolanaPayment(
 *   req.headers['x-payment'],
 *   'solana-devnet'
 * );
 *
 * if (!result.success) {
 *   return res.status(400).json({ error: result.error });
 * }
 *
 * // Proceed with payment verification
 * const payment = result.payment!;
 * ```
 */
export function parseAndValidateSolanaPayment(
  header: string | undefined,
  expectedNetwork: 'solana-devnet' | 'solana-mainnet'
): ParseResult {
  // Parse header
  const parseResult = parseX402Payment(header);
  if (!parseResult.success) {
    return parseResult;
  }

  const payment = parseResult.payment!;

  // Validate network
  if (!isValidSolanaNetwork(payment.network)) {
    return {
      success: false,
      error: `Invalid Solana network: ${payment.network}`,
      code: X402ParseError.INVALID_NETWORK,
    };
  }

  // Check network matches expected
  if (payment.network !== expectedNetwork) {
    return {
      success: false,
      error: `Network mismatch: expected ${expectedNetwork}, got ${payment.network}`,
      code: X402ParseError.INVALID_NETWORK,
    };
  }

  // Validate payload
  const payloadResult = validateSolanaPayload(payment.payload, payment.scheme);
  if (!payloadResult.success) {
    return payloadResult;
  }

  return {
    success: true,
    payment,
  };
}

/**
 * Create X-PAYMENT header for Solana transaction signature
 * Helper for creating properly formatted payment headers
 *
 * @param signature - Solana transaction signature
 * @param network - Network identifier
 * @returns Base64-encoded X-PAYMENT header value
 *
 * @example
 * ```typescript
 * const header = createSolanaPaymentHeader(
 *   '5j7s...3xY2',
 *   'solana-devnet'
 * );
 *
 * // Use in HTTP request
 * fetch(url, {
 *   headers: { 'X-PAYMENT': header }
 * });
 * ```
 */
export function createSolanaPaymentHeader(
  signature: string,
  network: 'solana-devnet' | 'solana-mainnet'
): string {
  const payment: X402Payment = {
    x402Version: 1,
    scheme: 'exact',
    network,
    payload: {
      signature,
    },
  };

  return encodeX402Payment(payment);
}

/**
 * Create X-PAYMENT header for serialized Solana transaction
 * Official x402 format using serialized transaction
 *
 * @param serializedTransaction - Base64-encoded serialized transaction
 * @param network - Network identifier
 * @returns Base64-encoded X-PAYMENT header value
 *
 * @example
 * ```typescript
 * const tx = transaction.serialize();
 * const serializedTx = Buffer.from(tx).toString('base64');
 *
 * const header = createSolanaPaymentHeaderWithTransaction(
 *   serializedTx,
 *   'solana-devnet'
 * );
 * ```
 */
export function createSolanaPaymentHeaderWithTransaction(
  serializedTransaction: string,
  network: 'solana-devnet' | 'solana-mainnet'
): string {
  const payment: X402Payment = {
    x402Version: 1,
    scheme: 'exact',
    network,
    payload: {
      serializedTransaction,
    },
  };

  return encodeX402Payment(payment);
}

/**
 * Create X-PAYMENT header for payment channel claim
 * x402 'channel' scheme for off-chain payments
 *
 * @param channelId - Base58-encoded channel PDA address
 * @param amount - Total cumulative amount claimed (micro-USDC)
 * @param nonce - Current nonce for replay protection
 * @param signature - Base64-encoded Ed25519 signature (64 bytes)
 * @param network - Network identifier
 * @param expiry - Optional expiry timestamp (Unix seconds)
 * @returns Base64-encoded X-PAYMENT header value
 *
 * @example
 * ```typescript
 * const header = createChannelPaymentHeader(
 *   'ChannelPDA...',
 *   '1000000',      // $1 claimed total
 *   '5',            // 5th payment
 *   'base64Sig...', // Ed25519 signature
 *   'solana-devnet',
 *   '1735689600'    // Optional expiry
 * );
 *
 * // Use in HTTP request
 * fetch(url, {
 *   headers: { 'X-PAYMENT': header }
 * });
 * ```
 */
export function createChannelPaymentHeader(
  channelId: string,
  amount: string,
  nonce: string,
  signature: string,
  network: 'solana-devnet' | 'solana-mainnet',
  expiry?: string
): string {
  const payload: PaymentPayload = {
    channelId,
    amount,
    nonce,
    channelSignature: signature,
  };

  if (expiry !== undefined) {
    payload.expiry = expiry;
  }

  const payment: X402Payment = {
    x402Version: 1,
    scheme: 'channel',
    network,
    payload,
  };

  return encodeX402Payment(payment);
}
