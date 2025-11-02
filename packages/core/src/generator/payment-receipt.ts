/**
 * Payment receipt generator
 * Creates payment receipts for X-PAYMENT-RESPONSE headers
 */

import { PaymentReceipt } from '../types/x402.types';
import { VerificationResult } from '../types/solana.types';
import { GenerateReceiptOptions, PaymentReceiptDetails } from '../types/payment.types';
import { formatNetworkForX402 } from '../utils/address-validator';

/**
 * Generate a payment receipt from verification result
 *
 * @param result - Verification result
 * @param network - Network name
 * @param options - Receipt generation options
 * @returns Payment receipt
 *
 * @example
 * ```typescript
 * const receipt = generatePaymentReceipt(verificationResult, 'devnet');
 * res.setHeader('X-PAYMENT-RESPONSE', encodePaymentReceipt(receipt));
 * ```
 */
export function generatePaymentReceipt(
  result: VerificationResult,
  network: string,
  options: GenerateReceiptOptions = {}
): PaymentReceipt {
  if (!result.valid) {
    throw new Error('Cannot generate receipt for invalid payment');
  }

  const receipt: PaymentReceipt = {
    signature: result.signature!,
    network: formatNetworkForX402(network),
    amount: result.transfer!.amount,
    timestamp: Date.now(),
    status: 'verified',
  };

  // Add optional fields
  if (options.includeDetails && result.blockTime) {
    receipt.blockTime = result.blockTime;
  }

  if (options.includeDetails && result.slot) {
    receipt.slot = result.slot;
  }

  return receipt;
}

/**
 * Generate detailed payment receipt
 * Includes full transaction information
 *
 * @param result - Verification result
 * @param network - Network name
 * @param options - Receipt generation options
 * @returns Detailed payment receipt
 *
 * @example
 * ```typescript
 * const details = generateDetailedReceipt(verificationResult, 'devnet');
 * ```
 */
export function generateDetailedReceipt(
  result: VerificationResult,
  network: string
): PaymentReceiptDetails {
  if (!result.valid) {
    throw new Error('Cannot generate receipt for invalid payment');
  }

  const details: PaymentReceiptDetails = {
    signature: result.signature!,
    network: formatNetworkForX402(network),
    amount: result.transfer!.amount,
    payer: result.transfer!.authority,
    recipient: result.transfer!.destination,
    timestamp: Date.now(),
  };

  // Add optional fields
  if (result.blockTime) {
    details.blockTime = result.blockTime;
  }

  if (result.slot) {
    details.slot = result.slot;
  }

  return details;
}

/**
 * Encode payment receipt as base64 JSON for X-PAYMENT-RESPONSE header
 *
 * @param receipt - Payment receipt
 * @returns Base64-encoded JSON string
 *
 * @example
 * ```typescript
 * const encoded = encodePaymentReceipt(receipt);
 * res.setHeader('X-PAYMENT-RESPONSE', encoded);
 * ```
 */
export function encodePaymentReceipt(receipt: PaymentReceipt): string {
  return Buffer.from(JSON.stringify(receipt)).toString('base64');
}

/**
 * Decode payment receipt from base64 JSON
 *
 * @param encoded - Base64-encoded payment receipt
 * @returns Payment receipt object
 *
 * @example
 * ```typescript
 * const receipt = decodePaymentReceipt(responseHeader);
 * console.log('Payment verified:', receipt.signature);
 * ```
 */
export function decodePaymentReceipt(encoded: string): PaymentReceipt {
  try {
    const json = Buffer.from(encoded, 'base64').toString('utf-8');
    return JSON.parse(json);
  } catch (error) {
    throw new Error('Invalid payment receipt encoding');
  }
}

/**
 * Format payment receipt for logging
 *
 * @param receipt - Payment receipt
 * @returns Formatted string
 *
 * @example
 * ```typescript
 * console.log(formatPaymentReceipt(receipt));
 * // Output: "Payment verified: 5j7s...Dia7 (1000 micro-USDC on solana-devnet)"
 * ```
 */
export function formatPaymentReceipt(receipt: PaymentReceipt): string {
  const shortSig = receipt.signature.slice(0, 8) + '...' + receipt.signature.slice(-4);
  return `Payment ${receipt.status}: ${shortSig} (${receipt.amount} micro-USDC on ${receipt.network})`;
}

/**
 * Validate payment receipt structure
 *
 * @param receipt - Receipt to validate
 * @returns Whether receipt is valid
 */
export function isValidPaymentReceipt(receipt: any): receipt is PaymentReceipt {
  return (
    typeof receipt === 'object' &&
    typeof receipt.signature === 'string' &&
    typeof receipt.network === 'string' &&
    typeof receipt.amount === 'number' &&
    typeof receipt.timestamp === 'number' &&
    typeof receipt.status === 'string' &&
    ['verified', 'pending', 'failed'].includes(receipt.status)
  );
}

/**
 * Create a failed payment receipt
 * Used when payment verification fails
 *
 * @param signature - Transaction signature
 * @param network - Network name
 * @param error - Error message
 * @returns Failed payment receipt
 */
export function createFailedReceipt(
  signature: string,
  network: string
): PaymentReceipt {
  return {
    signature,
    network: formatNetworkForX402(network),
    amount: 0,
    timestamp: Date.now(),
    status: 'failed',
  };
}

/**
 * Create a pending payment receipt
 * Used when payment is being verified
 *
 * @param signature - Transaction signature
 * @param network - Network name
 * @returns Pending payment receipt
 */
export function createPendingReceipt(
  signature: string,
  network: string
): PaymentReceipt {
  return {
    signature,
    network: formatNetworkForX402(network),
    amount: 0,
    timestamp: Date.now(),
    status: 'pending',
  };
}
