/**
 * Type definitions for PaymentStatus component
 */

export interface PaymentStatusProps {
  /** Transaction signature */
  signature: string;

  /** Solana network */
  network: 'devnet' | 'mainnet-beta';

  /** Show detailed transaction information */
  showDetails?: boolean;

  /** Callback when transaction is confirmed */
  onConfirmed?: (signature: string) => void;

  /** Callback when transaction fails */
  onFailed?: (signature: string, error?: string) => void;

  /** Custom className */
  className?: string;

  /** Poll interval in milliseconds */
  pollInterval?: number;

  /** Maximum poll attempts */
  maxPollAttempts?: number;

  /** Show explorer link */
  showExplorerLink?: boolean;

  /** Compact display mode */
  compact?: boolean;
}

export type TransactionStatus = 'pending' | 'confirming' | 'confirmed' | 'failed' | 'timeout';