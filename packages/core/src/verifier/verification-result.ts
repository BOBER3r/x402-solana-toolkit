/**
 * Verification result builders and helpers
 */

import { VerificationResult, USDCTransfer } from '../types/solana.types';
import { X402ErrorCode } from '../types/x402.types';

/**
 * Create a successful verification result
 *
 * @param signature - Transaction signature
 * @param transfer - USDC transfer details
 * @param blockTime - Block time (optional)
 * @param slot - Slot number (optional)
 * @returns Verification result
 */
export function createSuccessResult(
  signature: string,
  transfer: USDCTransfer,
  blockTime?: number,
  slot?: number
): VerificationResult {
  return {
    valid: true,
    signature,
    transfer,
    blockTime,
    slot,
  };
}

/**
 * Create a failed verification result
 *
 * @param error - Error message
 * @param code - Error code
 * @param debug - Debug information (optional)
 * @returns Verification result
 */
export function createErrorResult(
  error: string,
  code: string,
  debug?: any
): VerificationResult {
  return {
    valid: false,
    error,
    code,
    debug,
  };
}

/**
 * Create replay attack error result
 *
 * @param signature - Transaction signature
 * @returns Verification result
 */
export function createReplayAttackError(signature: string): VerificationResult {
  return createErrorResult(
    `Payment signature ${signature} has already been used`,
    X402ErrorCode.REPLAY_ATTACK,
    { signature }
  );
}

/**
 * Create transaction not found error result
 *
 * @param signature - Transaction signature
 * @returns Verification result
 */
export function createTransactionNotFoundError(signature: string): VerificationResult {
  return createErrorResult(
    `Transaction ${signature} not found on blockchain`,
    X402ErrorCode.TX_NOT_FOUND,
    { signature }
  );
}

/**
 * Create transaction failed error result
 *
 * @param signature - Transaction signature
 * @param txError - Transaction error from blockchain
 * @returns Verification result
 */
export function createTransactionFailedError(
  signature: string,
  txError: any
): VerificationResult {
  return createErrorResult(
    `Transaction ${signature} failed: ${JSON.stringify(txError)}`,
    X402ErrorCode.TX_FAILED,
    { signature, transactionError: txError }
  );
}

/**
 * Create no USDC transfer error result
 *
 * @param signature - Transaction signature
 * @returns Verification result
 */
export function createNoUSDCTransferError(signature: string): VerificationResult {
  return createErrorResult(
    'No USDC transfer found in transaction',
    X402ErrorCode.NO_USDC_TRANSFER,
    { signature }
  );
}

/**
 * Create transfer mismatch error result
 *
 * @param expectedRecipient - Expected recipient
 * @param expectedAmount - Expected amount in micro-USDC
 * @param foundTransfers - Transfers found in transaction
 * @returns Verification result
 */
export function createTransferMismatchError(
  expectedRecipient: string,
  expectedAmount: number,
  foundTransfers: USDCTransfer[]
): VerificationResult {
  return createErrorResult(
    'No matching USDC transfer found for expected recipient and amount',
    X402ErrorCode.TRANSFER_MISMATCH,
    {
      expectedRecipient,
      expectedAmount,
      foundTransfers,
    }
  );
}

/**
 * Create transaction expired error result
 *
 * @param signature - Transaction signature
 * @param age - Transaction age in milliseconds
 * @param maxAge - Maximum allowed age in milliseconds
 * @returns Verification result
 */
export function createTransactionExpiredError(
  signature: string,
  age: number,
  maxAge: number
): VerificationResult {
  return createErrorResult(
    `Transaction ${signature} is too old: ${age}ms > ${maxAge}ms`,
    X402ErrorCode.TX_EXPIRED,
    {
      signature,
      transactionAge: age,
      maxAge,
    }
  );
}

/**
 * Create invalid header error result
 *
 * @param message - Error message
 * @returns Verification result
 */
export function createInvalidHeaderError(message: string): VerificationResult {
  return createErrorResult(
    `Invalid X-PAYMENT header: ${message}`,
    X402ErrorCode.INVALID_HEADER
  );
}

/**
 * Create verification error result (internal error)
 *
 * @param message - Error message
 * @param originalError - Original error object (optional)
 * @returns Verification result
 */
export function createVerificationError(
  message: string,
  originalError?: any
): VerificationResult {
  return createErrorResult(
    `Verification error: ${message}`,
    X402ErrorCode.VERIFICATION_ERROR,
    { originalError: originalError?.message || originalError }
  );
}

/**
 * Check if verification result is successful
 *
 * @param result - Verification result
 * @returns Whether verification succeeded
 */
export function isVerificationSuccessful(result: VerificationResult): boolean {
  return result.valid === true;
}

/**
 * Get error message from verification result
 *
 * @param result - Verification result
 * @returns Error message or null if successful
 */
export function getErrorMessage(result: VerificationResult): string | null {
  return result.error || null;
}

/**
 * Get error code from verification result
 *
 * @param result - Verification result
 * @returns Error code or null if successful
 */
export function getErrorCode(result: VerificationResult): string | null {
  return result.code || null;
}

/**
 * Format verification result for logging
 *
 * @param result - Verification result
 * @returns Formatted string
 */
export function formatVerificationResult(result: VerificationResult): string {
  if (result.valid) {
    return `✓ Payment verified: ${result.signature} (${result.transfer?.amount} micro-USDC)`;
  } else {
    return `✗ Payment verification failed: [${result.code}] ${result.error}`;
  }
}
