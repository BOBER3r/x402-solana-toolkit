/**
 * PaymentHistory component
 * Paginated table of payment transactions
 */

import React, { useState, useMemo } from 'react';
import { usePaymentHistory } from '../../hooks/usePaymentHistory';
import { PaymentHistoryProps, PaymentFilter } from './types';
import { ExternalLinkIcon, DownloadIcon, CheckIcon, ErrorIcon, Spinner } from '../shared';
import { PriceTag } from '../PriceTag';

/**
 * Component for displaying payment transaction history
 *
 * Shows a table of past payments with filtering, sorting,
 * and export capabilities.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <PaymentHistory network="devnet" />
 *
 * // With custom max items and export
 * <PaymentHistory
 *   maxItems={20}
 *   exportable
 *   showSummary
 *   onTransactionClick={(sig) => console.log('Clicked:', sig)}
 * />
 *
 * // Compact mode
 * <PaymentHistory compact network="devnet" />
 * ```
 */
export function PaymentHistory({
  maxItems = 10,
  showFilters = true,
  exportable = false,
  onTransactionClick,
  className = '',
  showSummary = true,
  compact = false,
  network = 'devnet',
  showPagination = true,
  itemsPerPage = 10,
}: PaymentHistoryProps) {
  const { history, totalSpent, successfulPayments, clear } = usePaymentHistory();
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<PaymentFilter>({ status: 'all' });

  // Apply filters
  const filteredHistory = useMemo(() => {
    let filtered = [...history];

    // Status filter
    if (filter.status && filter.status !== 'all') {
      filtered = filtered.filter(p => p.status === filter.status);
    }

    // Date filter
    if (filter.dateFrom) {
      filtered = filtered.filter(p => p.timestamp >= filter.dateFrom!.getTime());
    }
    if (filter.dateTo) {
      filtered = filtered.filter(p => p.timestamp <= filter.dateTo!.getTime());
    }

    // Amount filter
    if (filter.minAmount !== undefined) {
      filtered = filtered.filter(p => p.amount >= filter.minAmount!);
    }
    if (filter.maxAmount !== undefined) {
      filtered = filtered.filter(p => p.amount <= filter.maxAmount!);
    }

    return filtered;
  }, [history, filter]);

  // Pagination
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const displayHistory = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredHistory.slice(start, end).slice(0, maxItems);
  }, [filteredHistory, currentPage, itemsPerPage, maxItems]);

  // Export to CSV
  const handleExport = () => {
    const csv = [
      ['Date', 'Amount (USDC)', 'Status', 'URL', 'Signature'].join(','),
      ...filteredHistory.map(p => [
        new Date(p.timestamp).toISOString(),
        p.amount.toString(),
        p.status,
        p.url,
        p.signature,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `x402-payment-history-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tableStyles: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: compact ? '13px' : '14px',
  };

  const headerCellStyles: React.CSSProperties = {
    padding: compact ? '8px' : '12px',
    textAlign: 'left',
    borderBottom: '2px solid #e5e7eb',
    backgroundColor: '#f9fafb',
    fontWeight: 600,
    color: '#374151',
  };

  const cellStyles: React.CSSProperties = {
    padding: compact ? '8px' : '12px',
    borderBottom: '1px solid #e5e7eb',
    color: '#1f2937',
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckIcon size={16} color="#10b981" />;
      case 'failed':
        return <ErrorIcon size={16} color="#ef4444" />;
      case 'pending':
        return <Spinner size="sm" variant="primary" />;
      default:
        return null;
    }
  };

  if (history.length === 0) {
    return (
      <div
        className={`x402-payment-history x402-payment-history-empty ${className}`}
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          backgroundColor: '#f9fafb',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
        }}
      >
        <p style={{ color: '#6b7280', margin: 0 }}>
          No payment history yet
        </p>
      </div>
    );
  }

  return (
    <div className={`x402-payment-history ${className}`}>
      {showSummary && !compact && (
        <div
          style={{
            display: 'flex',
            gap: '20px',
            marginBottom: '20px',
            padding: '16px',
            backgroundColor: '#f9fafb',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
              Total Spent
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937' }}>
              ${totalSpent.toFixed(3)} USDC
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
              Successful Payments
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#10b981' }}>
              {successfulPayments}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
              Total Transactions
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#3b82f6' }}>
              {history.length}
            </div>
          </div>
        </div>
      )}

      {showFilters && !compact && (
        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '16px',
            flexWrap: 'wrap',
          }}
        >
          <select
            value={filter.status || 'all'}
            onChange={(e) => setFilter({ ...filter, status: e.target.value as any })}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              fontSize: '14px',
            }}
          >
            <option value="all">All Status</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>

          {exportable && (
            <button
              onClick={handleExport}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <DownloadIcon size={16} />
              Export CSV
            </button>
          )}

          <button
            onClick={clear}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #fecaca',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Clear History
          </button>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyles} className="x402-payment-history-table">
          <thead>
            <tr>
              <th style={headerCellStyles}>Date</th>
              {!compact && <th style={headerCellStyles}>Amount</th>}
              <th style={headerCellStyles}>Status</th>
              {!compact && <th style={headerCellStyles}>Resource</th>}
              <th style={headerCellStyles}>Transaction</th>
            </tr>
          </thead>
          <tbody>
            {displayHistory.map((payment) => (
              <tr
                key={payment.id}
                onClick={() => onTransactionClick?.(payment.signature)}
                style={{
                  cursor: onTransactionClick ? 'pointer' : 'default',
                }}
                onMouseEnter={(e) => {
                  if (onTransactionClick) {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <td style={cellStyles}>
                  {new Date(payment.timestamp).toLocaleDateString()}
                  {!compact && (
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                      {new Date(payment.timestamp).toLocaleTimeString()}
                    </div>
                  )}
                </td>
                {!compact && (
                  <td style={cellStyles}>
                    <PriceTag priceUSD={payment.amount} variant="inline" showUSD={false} />
                  </td>
                )}
                <td style={cellStyles}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {getStatusIcon(payment.status)}
                    <span style={{ textTransform: 'capitalize' }}>{payment.status}</span>
                  </div>
                </td>
                {!compact && (
                  <td style={cellStyles}>
                    <div
                      style={{
                        maxWidth: '200px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={payment.url}
                    >
                      {payment.url}
                    </div>
                  </td>
                )}
                <td style={cellStyles}>
                  {payment.signature ? (
                    <a
                      href={`https://explorer.solana.com/tx/${payment.signature}?cluster=${network}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: '#3b82f6',
                        textDecoration: 'none',
                        fontSize: '13px',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {compact ? 'View' : payment.signature.slice(0, 8) + '...'}
                      <ExternalLinkIcon size={14} />
                    </a>
                  ) : (
                    <span style={{ color: '#9ca3af' }}>-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPagination && totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            marginTop: '16px',
          }}
        >
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              backgroundColor: 'white',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage === 1 ? 0.5 : 1,
            }}
          >
            Previous
          </button>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              backgroundColor: 'white',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              opacity: currentPage === totalPages ? 0.5 : 1,
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}