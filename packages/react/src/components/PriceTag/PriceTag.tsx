/**
 * PriceTag component
 * Displays USDC price with configurable styling
 */

import React from 'react';
import { PriceTagProps } from './types';

/**
 * Component for displaying prices in USDC
 *
 * @example
 * ```tsx
 * // Badge variant (compact)
 * <PriceTag priceUSD={0.05} variant="badge" />
 *
 * // Inline variant
 * <PriceTag priceUSD={1.50} variant="inline" showUSD />
 *
 * // Large variant
 * <PriceTag priceUSD={10.00} variant="large" showUSDC />
 * ```
 */
export function PriceTag({
  priceUSD,
  variant = 'inline',
  showUSD = true,
  showUSDC = false,
  className = '',
  style,
}: PriceTagProps) {
  const formattedPrice = priceUSD.toFixed(3);
  const microUSDC = Math.floor(priceUSD * 1_000_000);

  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    ...style,
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    badge: {
      fontSize: '11px',
      fontWeight: 600,
      padding: '2px 6px',
      borderRadius: '10px',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      color: '#3b82f6',
      border: '1px solid rgba(59, 130, 246, 0.2)',
    },
    inline: {
      fontSize: '14px',
      fontWeight: 500,
      color: '#374151',
    },
    large: {
      fontSize: '24px',
      fontWeight: 700,
      color: '#1f2937',
    },
  };

  const combinedStyles = {
    ...baseStyles,
    ...variantStyles[variant],
  };

  return (
    <span
      className={`x402-price-tag x402-price-tag-${variant} ${className}`}
      style={combinedStyles}
      aria-label={`Price: ${formattedPrice} USDC`}
    >
      {variant === 'badge' ? (
        <>
          <span className="x402-price-amount">${formattedPrice}</span>
        </>
      ) : (
        <>
          <span className="x402-price-amount">
            ${formattedPrice}
            {showUSD && <span className="x402-price-currency"> USDC</span>}
          </span>
          {showUSDC && (
            <span
              className="x402-price-micro"
              style={{
                fontSize: variant === 'large' ? '14px' : '12px',
                color: '#9ca3af',
                fontWeight: 400,
              }}
            >
              ({microUSDC.toLocaleString()} μUSDC)
            </span>
          )}
        </>
      )}
    </span>
  );
}