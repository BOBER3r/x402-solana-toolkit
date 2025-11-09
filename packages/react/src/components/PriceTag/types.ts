/**
 * Type definitions for PriceTag component
 */

export interface PriceTagProps {
  /** Price in USD */
  priceUSD: number;

  /** Display variant */
  variant?: 'badge' | 'inline' | 'large';

  /** Show USD label */
  showUSD?: boolean;

  /** Show USDC conversion */
  showUSDC?: boolean;

  /** Custom className */
  className?: string;

  /** Custom styling */
  style?: React.CSSProperties;
}