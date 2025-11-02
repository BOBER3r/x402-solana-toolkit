/**
 * Currency conversion utilities
 * Handles conversion between USD and micro-USDC (6 decimals)
 */

/**
 * Number of decimals in USDC (6)
 */
export const USDC_DECIMALS = 6;

/**
 * Conversion factor from USD to micro-USDC
 */
export const USD_TO_MICRO_USDC = 1_000_000;

/**
 * Convert USD amount to micro-USDC
 * Uses Math.floor to avoid floating-point precision issues
 *
 * @param usd - Amount in USD (e.g., 0.001 = $0.001)
 * @returns Amount in micro-USDC (e.g., 1000)
 *
 * @example
 * ```typescript
 * const microUSDC = usdToMicroUSDC(0.001); // 1000
 * const microUSDC2 = usdToMicroUSDC(1.5); // 1500000
 * ```
 */
export function usdToMicroUSDC(usd: number): number {
  if (usd < 0) {
    throw new Error('USD amount cannot be negative');
  }

  if (!Number.isFinite(usd)) {
    throw new Error('USD amount must be a finite number');
  }

  // Use Math.floor to ensure we don't overshoot
  return Math.floor(usd * USD_TO_MICRO_USDC);
}

/**
 * Convert micro-USDC to USD
 *
 * @param microUSDC - Amount in micro-USDC (e.g., 1000)
 * @returns Amount in USD (e.g., 0.001)
 *
 * @example
 * ```typescript
 * const usd = microUSDCToUSD(1000); // 0.001
 * const usd2 = microUSDCToUSD(1500000); // 1.5
 * ```
 */
export function microUSDCToUSD(microUSDC: number): number {
  if (microUSDC < 0) {
    throw new Error('Micro-USDC amount cannot be negative');
  }

  if (!Number.isFinite(microUSDC)) {
    throw new Error('Micro-USDC amount must be a finite number');
  }

  return microUSDC / USD_TO_MICRO_USDC;
}

/**
 * Format micro-USDC as USD string with proper decimals
 *
 * @param microUSDC - Amount in micro-USDC
 * @param decimals - Number of decimal places (default: 6)
 * @returns Formatted USD string (e.g., "0.001000")
 *
 * @example
 * ```typescript
 * const formatted = formatMicroUSDC(1000); // "0.001000"
 * const formatted2 = formatMicroUSDC(1500000, 2); // "1.50"
 * ```
 */
export function formatMicroUSDC(microUSDC: number, decimals: number = 6): string {
  const usd = microUSDCToUSD(microUSDC);
  return usd.toFixed(decimals);
}

/**
 * Parse USD string to micro-USDC
 * Handles various input formats
 *
 * @param usdString - USD amount as string (e.g., "0.001", "$1.50")
 * @returns Amount in micro-USDC
 *
 * @example
 * ```typescript
 * const microUSDC = parseUSDString("0.001"); // 1000
 * const microUSDC2 = parseUSDString("$1.50"); // 1500000
 * ```
 */
export function parseUSDString(usdString: string): number {
  // Remove currency symbols and whitespace
  const cleaned = usdString.replace(/[$,\s]/g, '');

  const usd = parseFloat(cleaned);

  if (isNaN(usd)) {
    throw new Error(`Invalid USD string: ${usdString}`);
  }

  return usdToMicroUSDC(usd);
}

/**
 * Check if payment amount is sufficient
 * Uses >= comparison to allow overpayment
 *
 * @param paid - Amount paid in micro-USDC
 * @param required - Amount required in micro-USDC
 * @returns Whether payment is sufficient
 *
 * @example
 * ```typescript
 * const sufficient = isPaymentSufficient(1000, 1000); // true
 * const sufficient2 = isPaymentSufficient(1100, 1000); // true (overpayment allowed)
 * const sufficient3 = isPaymentSufficient(900, 1000); // false
 * ```
 */
export function isPaymentSufficient(paid: number, required: number): boolean {
  return paid >= required;
}

/**
 * Calculate payment difference
 * Returns positive number if overpaid, negative if underpaid
 *
 * @param paid - Amount paid in micro-USDC
 * @param required - Amount required in micro-USDC
 * @returns Difference in micro-USDC
 *
 * @example
 * ```typescript
 * const diff = calculatePaymentDifference(1100, 1000); // 100 (overpaid)
 * const diff2 = calculatePaymentDifference(900, 1000); // -100 (underpaid)
 * ```
 */
export function calculatePaymentDifference(paid: number, required: number): number {
  return paid - required;
}
