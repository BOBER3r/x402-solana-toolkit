/**
 * Spinner component
 * Loading indicator with configurable size
 */

import React from 'react';

export interface SpinnerProps {
  /** Size of the spinner */
  size?: 'sm' | 'md' | 'lg';
  /** Custom className */
  className?: string;
  /** Color variant */
  variant?: 'primary' | 'white' | 'gray';
}

/**
 * Loading spinner component
 *
 * @example
 * ```tsx
 * <Spinner size="md" variant="primary" />
 * ```
 */
export function Spinner({ size = 'md', className = '', variant = 'primary' }: SpinnerProps) {
  const sizeMap = {
    sm: '16px',
    md: '24px',
    lg: '32px',
  };

  const colorMap = {
    primary: '#3b82f6',
    white: '#ffffff',
    gray: '#9ca3af',
  };

  return (
    <div
      className={`x402-spinner ${className}`}
      style={{
        width: sizeMap[size],
        height: sizeMap[size],
        display: 'inline-block',
      }}
      role="status"
      aria-label="Loading"
    >
      <svg
        className="x402-spinner-svg"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          animation: 'x402-spin 0.8s linear infinite',
          width: '100%',
          height: '100%',
        }}
      >
        <circle
          className="x402-spinner-circle"
          cx="12"
          cy="12"
          r="10"
          stroke={colorMap[variant]}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="60"
          strokeDashoffset="20"
          opacity="0.25"
        />
        <circle
          className="x402-spinner-circle-active"
          cx="12"
          cy="12"
          r="10"
          stroke={colorMap[variant]}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="15"
          strokeDashoffset="0"
        />
      </svg>
      <style>{`
        @keyframes x402-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}