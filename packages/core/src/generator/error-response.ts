/**
 * Error response formatting
 * Creates user-friendly error responses for payment failures
 */

import { X402Error, X402ErrorCode } from '../types/x402.types';
import { VerificationResult } from '../types/solana.types';
import { microUSDCToUSD } from '../utils/currency-converter';

/**
 * Create an x402 error response from verification result
 *
 * @param result - Verification result (must be invalid)
 * @returns x402 error object
 *
 * @example
 * ```typescript
 * const error = createErrorResponse(result);
 * res.status(402).json({
 *   error: error.message,
 *   code: error.code,
 *   debug: error.debug,
 * });
 * ```
 */
export function createErrorResponse(result: VerificationResult): X402Error {
  if (result.valid) {
    throw new Error('Cannot create error response for valid result');
  }

  return {
    code: (result.code as X402ErrorCode) || X402ErrorCode.VERIFICATION_ERROR,
    message: result.error || 'Payment verification failed',
    debug: result.debug,
  };
}

/**
 * Create a user-friendly error message
 * Converts technical errors into actionable messages
 *
 * @param result - Verification result
 * @returns User-friendly error message
 *
 * @example
 * ```typescript
 * const message = createUserFriendlyError(result);
 * // "Payment amount insufficient. Required: $0.001, Paid: $0.0008"
 * ```
 */
export function createUserFriendlyError(result: VerificationResult): string {
  if (result.valid) {
    return 'Payment verified successfully';
  }

  const code = result.code as X402ErrorCode;

  switch (code) {
    case X402ErrorCode.REPLAY_ATTACK:
      return 'This payment has already been used. Please create a new payment.';

    case X402ErrorCode.TX_NOT_FOUND:
      return 'Transaction not found on blockchain. It may not have been confirmed yet. Please wait a moment and try again.';

    case X402ErrorCode.TX_FAILED:
      return 'Transaction failed on blockchain. Please check your transaction and try again with a new payment.';

    case X402ErrorCode.NO_USDC_TRANSFER:
      return 'No USDC transfer found in transaction. Please ensure you are sending USDC to the correct address.';

    case X402ErrorCode.TRANSFER_MISMATCH:
      return createTransferMismatchMessage(result);

    case X402ErrorCode.TX_EXPIRED:
      return createExpiredMessage(result);

    case X402ErrorCode.INSUFFICIENT_AMOUNT:
      return createInsufficientAmountMessage(result);

    case X402ErrorCode.WRONG_TOKEN:
      return 'Wrong token transferred. Please send USDC, not another token.';

    case X402ErrorCode.INVALID_HEADER:
      return 'Invalid payment header format. Please check your X-PAYMENT header.';

    default:
      return result.error || 'Payment verification failed. Please try again.';
  }
}

/**
 * Create error message for transfer mismatch
 */
function createTransferMismatchMessage(result: VerificationResult): string {
  const debug = result.debug;

  if (!debug) {
    return 'Payment does not match requirements. Please check recipient address and amount.';
  }

  const parts: string[] = [];

  // Check recipient mismatch
  if (debug.expectedRecipient) {
    const foundRecipients = debug.foundTransfers?.map((t: any) => t.destination) || [];
    if (foundRecipients.length > 0 && !foundRecipients.includes(debug.expectedRecipient)) {
      parts.push(
        `Wrong recipient. Expected: ${debug.expectedRecipient.slice(0, 8)}...${debug.expectedRecipient.slice(-4)}`
      );
    }
  }

  // Check amount mismatch
  if (debug.expectedAmount && debug.actualAmount) {
    const expectedUSD = microUSDCToUSD(debug.expectedAmount);
    const actualUSD = microUSDCToUSD(debug.actualAmount);
    parts.push(`Insufficient amount. Required: $${expectedUSD.toFixed(6)}, Paid: $${actualUSD.toFixed(6)}`);
  }

  if (parts.length > 0) {
    return parts.join('. ');
  }

  return 'Payment does not match requirements.';
}

/**
 * Create error message for expired transaction
 */
function createExpiredMessage(result: VerificationResult): string {
  const debug = result.debug;

  if (debug?.transactionAge && debug?.maxAge) {
    const ageMinutes = Math.floor(debug.transactionAge / 60000);
    const maxMinutes = Math.floor(debug.maxAge / 60000);
    return `Transaction is too old (${ageMinutes} minutes). Maximum age: ${maxMinutes} minutes. Please create a new payment.`;
  }

  return 'Transaction is too old. Please create a new payment.';
}

/**
 * Create error message for insufficient amount
 */
function createInsufficientAmountMessage(result: VerificationResult): string {
  const debug = result.debug;

  if (debug?.expectedAmount && debug?.actualAmount) {
    const expectedUSD = microUSDCToUSD(debug.expectedAmount);
    const actualUSD = microUSDCToUSD(debug.actualAmount);
    return `Payment amount insufficient. Required: $${expectedUSD.toFixed(6)}, Paid: $${actualUSD.toFixed(6)}`;
  }

  return 'Payment amount is insufficient. Please pay the required amount.';
}

/**
 * Format error for API response
 * Creates a consistent error response structure
 *
 * @param result - Verification result
 * @param includeDebug - Whether to include debug info (default: false for production)
 * @returns Formatted error object
 *
 * @example
 * ```typescript
 * const errorResponse = formatErrorForAPI(result, isDevelopment);
 * res.status(402).json(errorResponse);
 * ```
 */
export function formatErrorForAPI(
  result: VerificationResult,
  includeDebug: boolean = false
): {
  error: string;
  code: string;
  message: string;
  debug?: any;
} {
  const x402Error = createErrorResponse(result);
  const userMessage = createUserFriendlyError(result);

  return {
    error: 'Payment Required',
    code: x402Error.code,
    message: userMessage,
    ...(includeDebug && { debug: x402Error.debug }),
  };
}

/**
 * Check if error is retryable
 * Determines if client should retry with a new payment
 *
 * @param code - Error code
 * @returns Whether error is retryable
 *
 * @example
 * ```typescript
 * if (isRetryableError(error.code)) {
 *   console.log('Please try again with a new payment');
 * }
 * ```
 */
export function isRetryableError(code: X402ErrorCode): boolean {
  const retryableCodes = [
    X402ErrorCode.TX_NOT_FOUND, // Might not be confirmed yet
    X402ErrorCode.VERIFICATION_ERROR, // Internal error
  ];

  return retryableCodes.includes(code);
}

/**
 * Check if error requires new payment
 * Determines if client must create an entirely new payment
 *
 * @param code - Error code
 * @returns Whether new payment is required
 */
export function requiresNewPayment(code: X402ErrorCode): boolean {
  const newPaymentCodes = [
    X402ErrorCode.REPLAY_ATTACK,
    X402ErrorCode.TX_FAILED,
    X402ErrorCode.TX_EXPIRED,
    X402ErrorCode.TRANSFER_MISMATCH,
    X402ErrorCode.INSUFFICIENT_AMOUNT,
    X402ErrorCode.WRONG_TOKEN,
  ];

  return newPaymentCodes.includes(code);
}

/**
 * Get suggested action for error
 * Provides actionable guidance for different error types
 *
 * @param code - Error code
 * @returns Suggested action
 */
export function getSuggestedAction(code: X402ErrorCode): string {
  switch (code) {
    case X402ErrorCode.REPLAY_ATTACK:
      return 'Create a new payment transaction';

    case X402ErrorCode.TX_NOT_FOUND:
      return 'Wait for transaction confirmation and try again';

    case X402ErrorCode.TX_FAILED:
      return 'Check transaction error and create a new payment';

    case X402ErrorCode.NO_USDC_TRANSFER:
      return 'Ensure you are sending USDC to the correct token account';

    case X402ErrorCode.TRANSFER_MISMATCH:
      return 'Verify recipient address and amount, then create a new payment';

    case X402ErrorCode.TX_EXPIRED:
      return 'Create a new payment (previous transaction was too old)';

    case X402ErrorCode.INSUFFICIENT_AMOUNT:
      return 'Send the required amount of USDC';

    case X402ErrorCode.WRONG_TOKEN:
      return 'Send USDC, not another token';

    case X402ErrorCode.INVALID_HEADER:
      return 'Fix X-PAYMENT header format';

    case X402ErrorCode.VERIFICATION_ERROR:
      return 'Try again or contact support if error persists';

    default:
      return 'Contact support for assistance';
  }
}
