/**
 * BalanceBadge component
 * Displays wallet balances with real-time updates
 */

import React, { useEffect, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletBalance } from '../../hooks/useWalletBalance';
import { BalanceBadgeProps } from './types';
import { RefreshIcon, WarningIcon, Spinner } from '../shared';

/**
 * Helper function to safely check wallet state
 * Prevents React 19 strict mode errors with wallet adapter proxy
 */
function getSafeWalletState(wallet: any): { isConnected: boolean; hasPublicKey: boolean } {
  try {
    return {
      isConnected: wallet?.connected || false,
      hasPublicKey: !!wallet?.publicKey,
    };
  } catch (err) {
    return {
      isConnected: false,
      hasPublicKey: false,
    };
  }
}

/**
 * Component for displaying wallet balances
 *
 * Shows SOL and/or USDC balances with auto-refresh capability
 * and low balance warnings.
 *
 * @example
 * ```tsx
 * // Show both SOL and USDC
 * <BalanceBadge showSOL showUSDC refreshInterval={30000} />
 *
 * // Only USDC with low balance warning
 * <BalanceBadge
 *   showUSDC
 *   lowBalanceThreshold={1.0}
 *   onLowBalance={(balance) => alert('Low balance!')}
 * />
 *
 * // Compact mode
 * <BalanceBadge showUSDC compact />
 * ```
 */
export function BalanceBadge({
  showSOL = true,
  showUSDC = true,
  refreshInterval = 30000,
  lowBalanceThreshold = 0.01,
  compact = false,
  className = '',
  onLowBalance,
  showRefresh = true,
}: BalanceBadgeProps) {
  const wallet = useWallet();
  const { usdcBalance, solBalance, isLoading, refresh, error } = useWalletBalance({
    refreshInterval,
  });

  // Check for low balance
  const isLowBalance = useMemo(() => {
    return showUSDC && usdcBalance < lowBalanceThreshold;
  }, [showUSDC, usdcBalance, lowBalanceThreshold]);

  // Trigger low balance callback
  useEffect(() => {
    if (isLowBalance && onLowBalance) {
      onLowBalance(usdcBalance);
    }
  }, [isLowBalance, usdcBalance, onLowBalance]);

  // Not connected state
  const { isConnected, hasPublicKey } = getSafeWalletState(wallet);

  if (!isConnected || !hasPublicKey) {
    return (
      <div
        className={`x402-balance-badge x402-balance-badge-disconnected ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: compact ? '6px 10px' : '8px 16px',
          backgroundColor: '#f3f4f6',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          fontSize: compact ? '13px' : '14px',
          color: '#6b7280',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <span>Wallet not connected</span>
      </div>
    );
  }

  const containerStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: compact ? '8px' : '12px',
    padding: compact ? '6px 10px' : '8px 16px',
    backgroundColor: isLowBalance ? '#fef2f2' : '#f9fafb',
    border: isLowBalance ? '1px solid #fecaca' : '1px solid #e5e7eb',
    borderRadius: '12px',
    fontSize: compact ? '13px' : '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 500,
  };

  const labelStyles: React.CSSProperties = {
    color: '#9ca3af',
    fontWeight: 400,
    fontSize: compact ? '11px' : '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const balanceItemStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  };

  const tokenStyles: React.CSSProperties = {
    color: '#6b7280',
    fontSize: compact ? '11px' : '12px',
    fontWeight: 600,
  };

  const amountStyles: React.CSSProperties = {
    color: isLowBalance ? '#dc2626' : '#1f2937',
    fontWeight: 600,
    fontSize: compact ? '13px' : '14px',
  };

  const refreshButtonStyles: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: isLoading ? 'not-allowed' : 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: isLoading ? 0.5 : 1,
    transition: 'opacity 0.2s',
  };

  return (
    <div
      className={`x402-balance-badge ${isLowBalance ? 'x402-balance-low' : ''} ${className}`}
      style={containerStyles}
      data-low-balance={isLowBalance}
    >
      {!compact && <span style={labelStyles}>Balance</span>}

      <div style={{ display: 'flex', gap: compact ? '8px' : '12px' }}>
        {showSOL && (
          <div className="x402-balance-item" style={balanceItemStyles}>
            <span style={tokenStyles}>SOL</span>
            <span style={amountStyles}>
              {isLoading ? '...' : solBalance.toFixed(4)}
            </span>
          </div>
        )}

        {showUSDC && (
          <div className="x402-balance-item" style={balanceItemStyles}>
            <span style={tokenStyles}>USDC</span>
            <span style={amountStyles}>
              {isLoading ? '...' : usdcBalance.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {isLowBalance && (
        <div
          className="x402-balance-warning"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: '#dc2626',
            fontSize: compact ? '11px' : '12px',
          }}
          title={`Balance is below ${lowBalanceThreshold} USDC`}
        >
          <WarningIcon size={16} color="#dc2626" />
          {!compact && <span>Low</span>}
        </div>
      )}

      {showRefresh && (
        <button
          onClick={refresh}
          disabled={isLoading}
          className="x402-balance-refresh"
          style={refreshButtonStyles}
          aria-label="Refresh balance"
          type="button"
        >
          {isLoading ? (
            <Spinner size="sm" variant="gray" />
          ) : (
            <RefreshIcon size={16} color="#6b7280" />
          )}
        </button>
      )}

      {error && !compact && (
        <span
          style={{
            color: '#ef4444',
            fontSize: '11px',
          }}
          title={error.message}
        >
          Error
        </span>
      )}
    </div>
  );
}