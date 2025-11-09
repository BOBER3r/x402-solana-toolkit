/**
 * PaymentStatus component
 * Real-time transaction confirmation status
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PaymentStatusProps, TransactionStatus } from './types';
import { Spinner, CheckIcon, ErrorIcon, ExternalLinkIcon, InfoIcon } from '../shared';

/**
 * Component for displaying payment transaction status
 *
 * Polls the Solana network for transaction confirmation status
 * and provides real-time feedback to users.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <PaymentStatus
 *   signature="5xJ..."
 *   network="devnet"
 *   onConfirmed={(sig) => console.log('Confirmed:', sig)}
 * />
 *
 * // With details
 * <PaymentStatus
 *   signature="5xJ..."
 *   network="mainnet-beta"
 *   showDetails
 *   showExplorerLink
 * />
 *
 * // Compact mode
 * <PaymentStatus
 *   signature="5xJ..."
 *   network="devnet"
 *   compact
 * />
 * ```
 */
export function PaymentStatus({
  signature,
  network,
  showDetails = true,
  onConfirmed,
  onFailed,
  className = '',
  pollInterval = 2000,
  maxPollAttempts = 30,
  showExplorerLink = true,
  compact = false,
}: PaymentStatusProps) {
  const { connection } = useConnection();
  const [status, setStatus] = useState<TransactionStatus>('pending');
  const [attempts, setAttempts] = useState(0);
  const [blockTime, setBlockTime] = useState<number | null>(null);
  const [slot, setSlot] = useState<number | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      // Get transaction status
      const result = await connection.getSignatureStatus(signature);

      if (!result || !result.value) {
        // Transaction not found yet, keep polling
        setStatus('confirming');
        return false;
      }

      const { confirmationStatus, err } = result.value;

      if (err) {
        // Transaction failed
        setStatus('failed');
        onFailed?.(signature, JSON.stringify(err));
        return true;
      }

      if (confirmationStatus === 'confirmed' || confirmationStatus === 'finalized') {
        // Transaction confirmed
        setStatus('confirmed');

        // Try to get additional details
        try {
          const txDetails = await connection.getTransaction(signature, {
            maxSupportedTransactionVersion: 0,
          });

          if (txDetails) {
            setBlockTime(txDetails.blockTime || null);
            setSlot(txDetails.slot || null);
          }
        } catch (err) {
          // Ignore errors getting details
        }

        onConfirmed?.(signature);
        return true;
      }

      // Still processing
      setStatus('confirming');
      return false;
    } catch (err) {
      console.error('Error checking transaction status:', err);
      setStatus('confirming');
      return false;
    }
  }, [signature, connection, onConfirmed, onFailed]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let isMounted = true;

    const poll = async () => {
      if (!isMounted) return;

      const isComplete = await checkStatus();

      if (isComplete) {
        // Stop polling
        if (intervalId) clearInterval(intervalId);
        return;
      }

      // Check if we've exceeded max attempts
      setAttempts(prev => {
        const newAttempts = prev + 1;
        if (newAttempts >= maxPollAttempts) {
          setStatus('timeout');
          if (intervalId) clearInterval(intervalId);
          onFailed?.(signature, 'Transaction confirmation timeout');
        }
        return newAttempts;
      });
    };

    // Initial check
    poll();

    // Start polling
    intervalId = setInterval(poll, pollInterval);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [signature, checkStatus, pollInterval, maxPollAttempts, onFailed]);

  const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=${network}`;

  const statusConfig = {
    pending: {
      icon: <Spinner size={compact ? 'sm' : 'md'} variant="primary" />,
      text: 'Initiating...',
      color: '#3b82f6',
      bgColor: '#eff6ff',
      borderColor: '#bfdbfe',
    },
    confirming: {
      icon: <Spinner size={compact ? 'sm' : 'md'} variant="primary" />,
      text: compact ? 'Confirming...' : 'Confirming Transaction...',
      color: '#3b82f6',
      bgColor: '#eff6ff',
      borderColor: '#bfdbfe',
    },
    confirmed: {
      icon: <CheckIcon size={compact ? 16 : 20} color="#10b981" />,
      text: compact ? 'Confirmed' : 'Payment Confirmed!',
      color: '#10b981',
      bgColor: '#f0fdf4',
      borderColor: '#bbf7d0',
    },
    failed: {
      icon: <ErrorIcon size={compact ? 16 : 20} color="#ef4444" />,
      text: compact ? 'Failed' : 'Payment Failed',
      color: '#ef4444',
      bgColor: '#fef2f2',
      borderColor: '#fecaca',
    },
    timeout: {
      icon: <InfoIcon size={compact ? 16 : 20} color="#f59e0b" />,
      text: compact ? 'Timeout' : 'Confirmation Timeout',
      color: '#f59e0b',
      bgColor: '#fffbeb',
      borderColor: '#fde68a',
    },
  };

  const config = statusConfig[status];

  const containerStyles: React.CSSProperties = {
    display: 'inline-flex',
    flexDirection: compact ? 'row' : 'column',
    alignItems: compact ? 'center' : 'flex-start',
    gap: compact ? '8px' : '12px',
    padding: compact ? '8px 12px' : '16px',
    backgroundColor: config.bgColor,
    border: `1px solid ${config.borderColor}`,
    borderRadius: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    maxWidth: compact ? 'auto' : '400px',
  };

  const statusRowStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: config.color,
    fontWeight: 600,
    fontSize: compact ? '13px' : '15px',
  };

  const detailsStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '13px',
    color: '#6b7280',
    width: '100%',
  };

  const linkStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    color: '#3b82f6',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: 500,
    marginTop: '4px',
  };

  return (
    <div
      className={`x402-payment-status x402-payment-status-${status} ${className}`}
      style={containerStyles}
      data-status={status}
      role="status"
      aria-live="polite"
    >
      <div style={statusRowStyles}>
        {config.icon}
        <span>{config.text}</span>
      </div>

      {showDetails && !compact && status === 'confirming' && (
        <div style={detailsStyles}>
          <div>
            Attempt {attempts} of {maxPollAttempts}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af' }}>
            This usually takes 10-30 seconds
          </div>
        </div>
      )}

      {showDetails && !compact && status === 'confirmed' && (
        <div style={detailsStyles}>
          {blockTime && (
            <div>
              Time: {new Date(blockTime * 1000).toLocaleString()}
            </div>
          )}
          {slot && (
            <div>
              Slot: {slot.toLocaleString()}
            </div>
          )}
        </div>
      )}

      {showDetails && !compact && status === 'timeout' && (
        <div style={detailsStyles}>
          <div style={{ color: '#f59e0b' }}>
            Transaction may still confirm. Check the explorer for updates.
          </div>
        </div>
      )}

      {showExplorerLink && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={linkStyles}
          className="x402-payment-status-explorer-link"
        >
          View on Explorer
          <ExternalLinkIcon size={14} color="#3b82f6" />
        </a>
      )}
    </div>
  );
}