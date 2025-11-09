/**
 * Type definitions for PaymentHistory component
 */

export interface PaymentHistoryProps {
  /** Maximum number of items to display */
  maxItems?: number;

  /** Show filter controls */
  showFilters?: boolean;

  /** Enable CSV export */
  exportable?: boolean;

  /** Callback when a transaction is clicked */
  onTransactionClick?: (signature: string) => void;

  /** Custom className */
  className?: string;

  /** Show summary statistics */
  showSummary?: boolean;

  /** Compact display mode */
  compact?: boolean;

  /** Network for explorer links */
  network?: 'devnet' | 'mainnet-beta';

  /** Show pagination controls */
  showPagination?: boolean;

  /** Items per page */
  itemsPerPage?: number;
}

export interface PaymentFilter {
  status?: 'all' | 'confirmed' | 'pending' | 'failed';
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
}