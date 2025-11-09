/**
 * PaymentButton component
 * Primary component for triggering x402 payments
 */

import React, { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useX402Payment } from '../../hooks/useX402Payment';
import { PaymentButtonProps } from './types';
import { PriceTag } from '../PriceTag';
import { Spinner, CheckIcon, ErrorIcon } from '../shared';

/**
 * Button component that handles x402 payment flow
 *
 * Integrates with useX402Payment hook to automatically handle:
 * - Wallet connection check
 * - Payment creation
 * - Loading states
 * - Success/error feedback
 *
 * @example
 * ```tsx
 * // Basic usage
 * <PaymentButton priceUSD={0.05} endpoint="/api/premium">
 *   Access Premium Content
 * </PaymentButton>
 *
 * // With callbacks
 * <PaymentButton
 *   priceUSD={1.50}
 *   endpoint="/api/data"
 *   onSuccess={(data) => console.log('Got data:', data)}
 *   onError={(err) => console.error('Payment failed:', err)}
 *   variant="primary"
 *   size="lg"
 * >
 *   Purchase Data
 * </PaymentButton>
 * ```
 */
export function PaymentButton({
  priceUSD,
  description,
  resource,
  onSuccess,
  onError,
  variant = 'primary',
  size = 'md',
  disabled = false,
  children,
  className = '',
  showPrice = true,
  fullWidth = false,
  endpoint,
  method = 'GET',
  fetchOptions = {},
}: PaymentButtonProps) {
  // Destructure wallet values directly - this is safe and doesn't trigger proxy errors
  const { connected, publicKey } = useWallet();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const { fetch: fetchWithPayment, isLoading } = useX402Payment({
    onPaymentSent: (signature, amount) => {
      console.log(`Payment sent: ${signature}, amount: ${amount} USDC`);
    },
    onError: (err) => {
      setStatus('error');
      onError?.(err);

      // Reset to idle after 3 seconds
      setTimeout(() => setStatus('idle'), 3000);
    },
  });

  const handleClick = useCallback(async () => {
    // Check wallet connection - use destructured values directly
    if (!connected || !publicKey) {
      const err = new Error('Please connect your wallet first');
      setStatus('error');
      onError?.(err);
      setTimeout(() => setStatus('idle'), 3000);
      return;
    }

    // If no endpoint provided, just show error
    if (!endpoint) {
      const err = new Error('No endpoint provided for PaymentButton');
      setStatus('error');
      onError?.(err);
      setTimeout(() => setStatus('idle'), 3000);
      return;
    }

    try {
      setStatus('loading');

      // Make request with automatic payment handling
      const response = await fetchWithPayment(endpoint, {
        method,
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }

      // Parse response data
      const data = await response.json();

      setStatus('success');
      onSuccess?.(data);

      // Reset to idle after 2 seconds
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err: any) {
      setStatus('error');
      onError?.(err);

      // Reset to idle after 3 seconds
      setTimeout(() => setStatus('idle'), 3000);
    }
  }, [connected, publicKey, endpoint, method, fetchOptions, fetchWithPayment, onSuccess, onError]);

  // Size styles
  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: {
      padding: '6px 12px',
      fontSize: '14px',
      gap: '6px',
    },
    md: {
      padding: '10px 20px',
      fontSize: '16px',
      gap: '8px',
    },
    lg: {
      padding: '14px 28px',
      fontSize: '18px',
      gap: '10px',
    },
  };

  // Variant styles
  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: '#3b82f6',
      color: 'white',
      border: 'none',
    },
    secondary: {
      backgroundColor: '#6b7280',
      color: 'white',
      border: 'none',
    },
    outline: {
      backgroundColor: 'transparent',
      color: '#3b82f6',
      border: '2px solid #3b82f6',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: '#374151',
      border: 'none',
    },
  };

  // Hover styles (applied via className)
  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 500,
    borderRadius: '8px',
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.2s ease',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    width: fullWidth ? '100%' : 'auto',
    position: 'relative',
    ...sizeStyles[size],
    ...variantStyles[variant],
  };

  const buttonContent = () => {
    if (status === 'loading') {
      return (
        <>
          <Spinner size={size === 'lg' ? 'md' : 'sm'} variant={variant === 'outline' || variant === 'ghost' ? 'primary' : 'white'} />
          <span>Processing...</span>
        </>
      );
    }

    if (status === 'success') {
      return (
        <>
          <CheckIcon size={size === 'lg' ? 24 : 20} color={variant === 'outline' || variant === 'ghost' ? '#10b981' : '#ffffff'} />
          <span>Success!</span>
        </>
      );
    }

    if (status === 'error') {
      return (
        <>
          <ErrorIcon size={size === 'lg' ? 24 : 20} color={variant === 'outline' || variant === 'ghost' ? '#ef4444' : '#ffffff'} />
          <span>Failed</span>
        </>
      );
    }

    return (
      <>
        <span>{children}</span>
        {showPrice && <PriceTag priceUSD={priceUSD} variant="badge" />}
      </>
    );
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isLoading || status === 'loading'}
      className={`x402-payment-button x402-payment-button-${variant} x402-payment-button-${size} ${className}`}
      style={baseStyles}
      data-status={status}
      aria-label={`Pay ${priceUSD} USDC - ${children}`}
      aria-busy={status === 'loading'}
      type="button"
    >
      {buttonContent()}
    </button>
  );
}