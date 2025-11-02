/**
 * Utility functions for decoding X-PAYMENT headers
 */

import { X402Payment } from '@x402-solana/core';
import { DecodedPayment } from '../types';

/**
 * Decode X-PAYMENT header from base64 JSON
 *
 * @param header - X-PAYMENT header value
 * @returns Decoded payment object
 * @throws Error if header is invalid
 *
 * @example
 * ```typescript
 * const payment = decodePaymentHeader(req.headers['x-payment']);
 * console.log('Signature:', payment.payload.signature);
 * ```
 */
export function decodePaymentHeader(header: string): DecodedPayment {
  if (!header) {
    throw new Error('X-PAYMENT header is missing');
  }

  try {
    // Decode base64 to UTF-8
    const json = Buffer.from(header, 'base64').toString('utf-8');

    // Parse JSON
    const payment: X402Payment = JSON.parse(json);

    // Validate structure
    if (!payment.x402Version || typeof payment.x402Version !== 'number') {
      throw new Error('Invalid x402Version');
    }

    if (!payment.scheme || typeof payment.scheme !== 'string') {
      throw new Error('Invalid scheme');
    }

    if (!payment.network || typeof payment.network !== 'string') {
      throw new Error('Invalid network');
    }

    if (!payment.payload || typeof payment.payload !== 'object') {
      throw new Error('Invalid payload');
    }

    if (!payment.payload.signature || typeof payment.payload.signature !== 'string') {
      throw new Error('Invalid signature in payload');
    }

    return {
      ...payment,
      rawHeader: header,
    };
  } catch (error: any) {
    throw new Error(`Invalid X-PAYMENT header: ${error.message}`);
  }
}

/**
 * Validate X-PAYMENT header format without decoding
 *
 * @param header - X-PAYMENT header value
 * @returns Whether header is valid
 */
export function isValidPaymentHeader(header: string): boolean {
  try {
    decodePaymentHeader(header);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract signature from X-PAYMENT header
 *
 * @param header - X-PAYMENT header value
 * @returns Transaction signature
 * @throws Error if header is invalid
 */
export function extractSignature(header: string): string {
  const payment = decodePaymentHeader(header);
  return payment.payload.signature;
}

/**
 * Extract network from X-PAYMENT header
 *
 * @param header - X-PAYMENT header value
 * @returns Network identifier
 * @throws Error if header is invalid
 */
export function extractNetwork(header: string): string {
  const payment = decodePaymentHeader(header);
  return payment.network;
}
