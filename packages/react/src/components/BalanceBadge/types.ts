/**
 * Type definitions for BalanceBadge component
 */

export interface BalanceBadgeProps {
  /** Show SOL balance */
  showSOL?: boolean;

  /** Show USDC balance */
  showUSDC?: boolean;

  /** Auto-refresh interval in milliseconds (0 to disable) */
  refreshInterval?: number;

  /** Low balance threshold for warnings (in USDC) */
  lowBalanceThreshold?: number;

  /** Compact display mode */
  compact?: boolean;

  /** Custom className */
  className?: string;

  /** Callback when balance is low */
  onLowBalance?: (balance: number) => void;

  /** Show refresh button */
  showRefresh?: boolean;
}