/**
 * Unit tests for currency converter utilities
 */

import {
  usdToMicroUSDC,
  microUSDCToUSD,
  formatMicroUSDC,
  parseUSDString,
  isPaymentSufficient,
  calculatePaymentDifference,
  USDC_DECIMALS,
  USD_TO_MICRO_USDC,
} from '../../src/utils/currency-converter';

describe('Currency Converter', () => {
  describe('Constants', () => {
    it('should have correct USDC decimals', () => {
      expect(USDC_DECIMALS).toBe(6);
    });

    it('should have correct conversion factor', () => {
      expect(USD_TO_MICRO_USDC).toBe(1_000_000);
    });
  });

  describe('usdToMicroUSDC', () => {
    it('should convert USD to micro-USDC correctly', () => {
      expect(usdToMicroUSDC(1)).toBe(1_000_000);
      expect(usdToMicroUSDC(0.001)).toBe(1_000);
      expect(usdToMicroUSDC(0.5)).toBe(500_000);
      expect(usdToMicroUSDC(10.123456)).toBe(10_123_456);
    });

    it('should use Math.floor for rounding', () => {
      expect(usdToMicroUSDC(0.0000015)).toBe(1); // Floors to 1
      expect(usdToMicroUSDC(0.0000019)).toBe(1); // Floors to 1
    });

    it('should handle zero', () => {
      expect(usdToMicroUSDC(0)).toBe(0);
    });

    it('should throw on negative amounts', () => {
      expect(() => usdToMicroUSDC(-1)).toThrow('USD amount cannot be negative');
    });

    it('should throw on non-finite amounts', () => {
      expect(() => usdToMicroUSDC(NaN)).toThrow('USD amount must be a finite number');
      expect(() => usdToMicroUSDC(Infinity)).toThrow('USD amount must be a finite number');
    });
  });

  describe('microUSDCToUSD', () => {
    it('should convert micro-USDC to USD correctly', () => {
      expect(microUSDCToUSD(1_000_000)).toBe(1);
      expect(microUSDCToUSD(1_000)).toBe(0.001);
      expect(microUSDCToUSD(500_000)).toBe(0.5);
      expect(microUSDCToUSD(10_123_456)).toBe(10.123456);
    });

    it('should handle zero', () => {
      expect(microUSDCToUSD(0)).toBe(0);
    });

    it('should throw on negative amounts', () => {
      expect(() => microUSDCToUSD(-1)).toThrow('Micro-USDC amount cannot be negative');
    });

    it('should throw on non-finite amounts', () => {
      expect(() => microUSDCToUSD(NaN)).toThrow('Micro-USDC amount must be a finite number');
      expect(() => microUSDCToUSD(Infinity)).toThrow('Micro-USDC amount must be a finite number');
    });
  });

  describe('formatMicroUSDC', () => {
    it('should format micro-USDC as USD string', () => {
      expect(formatMicroUSDC(1_000_000)).toBe('1.000000');
      expect(formatMicroUSDC(1_000)).toBe('0.001000');
      expect(formatMicroUSDC(500_000)).toBe('0.500000');
    });

    it('should respect decimal places parameter', () => {
      expect(formatMicroUSDC(1_500_000, 2)).toBe('1.50');
      expect(formatMicroUSDC(1_500_000, 4)).toBe('1.5000');
    });
  });

  describe('parseUSDString', () => {
    it('should parse USD strings', () => {
      expect(parseUSDString('1')).toBe(1_000_000);
      expect(parseUSDString('0.001')).toBe(1_000);
      expect(parseUSDString('10.5')).toBe(10_500_000);
    });

    it('should handle currency symbols', () => {
      expect(parseUSDString('$1')).toBe(1_000_000);
      expect(parseUSDString('$0.001')).toBe(1_000);
    });

    it('should handle commas', () => {
      expect(parseUSDString('1,000')).toBe(1_000_000_000);
      expect(parseUSDString('$1,234.56')).toBe(1_234_560_000);
    });

    it('should handle whitespace', () => {
      expect(parseUSDString('  1  ')).toBe(1_000_000);
      expect(parseUSDString(' $ 0.001 ')).toBe(1_000);
    });

    it('should throw on invalid strings', () => {
      expect(() => parseUSDString('invalid')).toThrow('Invalid USD string');
      expect(() => parseUSDString('')).toThrow('Invalid USD string');
      expect(() => parseUSDString('abc123')).toThrow('Invalid USD string');
    });
  });

  describe('isPaymentSufficient', () => {
    it('should return true when paid >= required', () => {
      expect(isPaymentSufficient(1000, 1000)).toBe(true);
      expect(isPaymentSufficient(1100, 1000)).toBe(true);
    });

    it('should return false when paid < required', () => {
      expect(isPaymentSufficient(900, 1000)).toBe(false);
      expect(isPaymentSufficient(999, 1000)).toBe(false);
    });

    it('should handle zero amounts', () => {
      expect(isPaymentSufficient(0, 0)).toBe(true);
      expect(isPaymentSufficient(1, 0)).toBe(true);
      expect(isPaymentSufficient(0, 1)).toBe(false);
    });
  });

  describe('calculatePaymentDifference', () => {
    it('should return positive for overpayment', () => {
      expect(calculatePaymentDifference(1100, 1000)).toBe(100);
      expect(calculatePaymentDifference(2000, 1000)).toBe(1000);
    });

    it('should return negative for underpayment', () => {
      expect(calculatePaymentDifference(900, 1000)).toBe(-100);
      expect(calculatePaymentDifference(0, 1000)).toBe(-1000);
    });

    it('should return zero for exact payment', () => {
      expect(calculatePaymentDifference(1000, 1000)).toBe(0);
    });
  });

  describe('Roundtrip conversions', () => {
    it('should maintain precision through roundtrip', () => {
      const testValues = [1, 0.001, 0.5, 10.123456, 999.999999];

      testValues.forEach(usd => {
        const microUSDC = usdToMicroUSDC(usd);
        const backToUSD = microUSDCToUSD(microUSDC);
        // Allow small precision difference due to Math.floor
        expect(Math.abs(backToUSD - usd)).toBeLessThan(0.000001);
      });
    });
  });
});
