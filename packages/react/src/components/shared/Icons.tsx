/**
 * Icon components
 * Reusable SVG icons for x402 components
 */

import React from 'react';

export interface IconProps {
  /** Icon size in pixels */
  size?: number;
  /** Icon color */
  color?: string;
  /** Custom className */
  className?: string;
}

/**
 * Checkmark icon for success states
 */
export function CheckIcon({ size = 20, color = '#10b981', className = '' }: IconProps) {
  return (
    <svg
      className={`x402-icon x402-check-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        fill={color}
      />
    </svg>
  );
}

/**
 * Error/X icon for error states
 */
export function ErrorIcon({ size = 20, color = '#ef4444', className = '' }: IconProps) {
  return (
    <svg
      className={`x402-icon x402-error-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        fill={color}
      />
    </svg>
  );
}

/**
 * Warning icon for warning states
 */
export function WarningIcon({ size = 20, color = '#f59e0b', className = '' }: IconProps) {
  return (
    <svg
      className={`x402-icon x402-warning-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
        fill={color}
      />
    </svg>
  );
}

/**
 * Refresh/Reload icon
 */
export function RefreshIcon({ size = 20, color = '#6b7280', className = '' }: IconProps) {
  return (
    <svg
      className={`x402-icon x402-refresh-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
        fill={color}
      />
    </svg>
  );
}

/**
 * External link icon
 */
export function ExternalLinkIcon({ size = 20, color = '#6b7280', className = '' }: IconProps) {
  return (
    <svg
      className={`x402-icon x402-external-link-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"
        fill={color}
      />
      <path
        d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"
        fill={color}
      />
    </svg>
  );
}

/**
 * Wallet icon
 */
export function WalletIcon({ size = 20, color = '#6b7280', className = '' }: IconProps) {
  return (
    <svg
      className={`x402-icon x402-wallet-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-5L9 4H4zm7 5a1 1 0 011-1h3a1 1 0 011 1v2a1 1 0 01-1 1h-3a1 1 0 01-1-1V9z"
        fill={color}
      />
    </svg>
  );
}

/**
 * Download/Export icon
 */
export function DownloadIcon({ size = 20, color = '#6b7280', className = '' }: IconProps) {
  return (
    <svg
      className={`x402-icon x402-download-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
        fill={color}
      />
    </svg>
  );
}

/**
 * Info icon
 */
export function InfoIcon({ size = 20, color = '#3b82f6', className = '' }: IconProps) {
  return (
    <svg
      className={`x402-icon x402-info-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        fill={color}
      />
    </svg>
  );
}