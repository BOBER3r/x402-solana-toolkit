/**
 * USDC-specific verification logic
 * Validates USDC transfers match payment requirements
 */

import { USDCTransfer } from '../types/solana.types';
import { usdToMicroUSDC, isPaymentSufficient } from '../utils/currency-converter';
import { isUSDCMint, areAddressesEqual } from '../utils/address-validator';

/**
 * Result of USDC transfer verification
 */
export interface USDCVerificationResult {
  /** Whether transfer is valid */
  valid: boolean;

  /** Matching transfer (if valid) */
  transfer?: USDCTransfer;

  /** Error message (if invalid) */
  error?: string;

  /** Error code (if invalid) */
  code?: string;

  /** Debug information */
  debug?: {
    expectedRecipient: string;
    expectedAmount: number;
    actualAmount?: number;
    foundTransfers: USDCTransfer[];
  };
}

/**
 * Options for USDC verification
 */
export interface USDCVerificationOptions {
  /** Network to validate USDC mint against */
  network?: string;

  /** Allow overpayment (default: true) */
  allowOverpayment?: boolean;

  /** Strict mint checking (default: true) */
  strictMintCheck?: boolean;
}

/**
 * Verify USDC transfers match payment requirements
 *
 * @param transfers - Array of transfers found in transaction
 * @param expectedRecipient - Expected recipient token account address
 * @param expectedAmountUSD - Expected amount in USD
 * @param options - Verification options
 * @returns Verification result
 *
 * @example
 * ```typescript
 * const result = verifyUSDCTransfer(
 *   transfers,
 *   recipientUSDCAccount,
 *   0.001,
 *   { network: 'devnet' }
 * );
 *
 * if (result.valid) {
 *   console.log('Payment verified:', result.transfer);
 * } else {
 *   console.error('Payment invalid:', result.error);
 * }
 * ```
 */
export function verifyUSDCTransfer(
  transfers: USDCTransfer[],
  expectedRecipient: string,
  expectedAmountUSD: number,
  options: USDCVerificationOptions = {}
): USDCVerificationResult {
  const {
    network,
    allowOverpayment = true,
    strictMintCheck = true,
  } = options;

  // Convert USD to micro-USDC
  const expectedMicroUSDC = usdToMicroUSDC(expectedAmountUSD);

  // Debug information
  const debug = {
    expectedRecipient,
    expectedAmount: expectedMicroUSDC,
    foundTransfers: transfers,
  };

  // Check if we have any transfers
  if (transfers.length === 0) {
    return {
      valid: false,
      error: 'No USDC transfers found in transaction',
      code: 'NO_USDC_TRANSFER',
      debug,
    };
  }

  // Find transfer matching recipient
  const matchingTransfers = transfers.filter(t =>
    areAddressesEqual(t.destination, expectedRecipient)
  );

  if (matchingTransfers.length === 0) {
    return {
      valid: false,
      error: `No transfer to expected recipient ${expectedRecipient}`,
      code: 'TRANSFER_MISMATCH',
      debug,
    };
  }

  // Check each matching transfer for amount and mint
  for (const transfer of matchingTransfers) {
    // Verify mint is USDC (if strict checking enabled)
    if (strictMintCheck && transfer.mint !== 'unknown') {
      if (!isUSDCMint(transfer.mint, network)) {
        continue; // Try next transfer
      }
    }

    // Verify amount
    const amountMatch = allowOverpayment
      ? isPaymentSufficient(transfer.amount, expectedMicroUSDC)
      : transfer.amount === expectedMicroUSDC;

    if (amountMatch) {
      // Found a valid transfer!
      return {
        valid: true,
        transfer,
      };
    }
  }

  // No matching transfer found
  const actualAmounts = matchingTransfers.map(t => t.amount);

  return {
    valid: false,
    error: `Transfer amount mismatch. Expected: ${expectedMicroUSDC} micro-USDC, Found: ${actualAmounts.join(', ')} micro-USDC`,
    code: 'INSUFFICIENT_AMOUNT',
    debug: {
      ...debug,
      actualAmount: matchingTransfers[0]?.amount,
    },
  };
}

/**
 * Verify transfer is actually USDC (mint check)
 *
 * @param transfer - Transfer to verify
 * @param network - Network to check against
 * @returns Whether transfer is USDC
 *
 * @example
 * ```typescript
 * const isValid = isValidUSDCMint(transfer, 'devnet');
 * ```
 */
export function isValidUSDCMint(transfer: USDCTransfer, network?: string): boolean {
  if (transfer.mint === 'unknown') {
    // Can't verify if mint is unknown
    return false;
  }

  return isUSDCMint(transfer.mint, network);
}

/**
 * Find all transfers to a specific recipient
 *
 * @param transfers - Array of transfers
 * @param recipient - Recipient address
 * @returns Matching transfers
 */
export function findTransfersToRecipient(
  transfers: USDCTransfer[],
  recipient: string
): USDCTransfer[] {
  return transfers.filter(t => areAddressesEqual(t.destination, recipient));
}

/**
 * Calculate total amount transferred to a recipient
 *
 * @param transfers - Array of transfers
 * @param recipient - Recipient address
 * @returns Total amount in micro-USDC
 *
 * @example
 * ```typescript
 * const total = getTotalAmountToRecipient(transfers, recipientAccount);
 * console.log(`Total received: ${total} micro-USDC`);
 * ```
 */
export function getTotalAmountToRecipient(
  transfers: USDCTransfer[],
  recipient: string
): number {
  const matchingTransfers = findTransfersToRecipient(transfers, recipient);
  return matchingTransfers.reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Validate transfer amounts across multiple requirements
 * Useful for batch payment verification
 *
 * @param transfers - Array of transfers
 * @param requirements - Array of payment requirements
 * @returns Map of recipient to verification result
 */
export function verifyMultipleTransfers(
  transfers: USDCTransfer[],
  requirements: Array<{ recipient: string; amountUSD: number }>
): Map<string, USDCVerificationResult> {
  const results = new Map<string, USDCVerificationResult>();

  for (const req of requirements) {
    const result = verifyUSDCTransfer(transfers, req.recipient, req.amountUSD);
    results.set(req.recipient, result);
  }

  return results;
}
