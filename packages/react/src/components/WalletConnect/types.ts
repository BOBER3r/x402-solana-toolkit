/**
 * Type definitions for WalletConnect component
 */

export interface WalletConnectProps {
  /** Callback when wallet connects */
  onConnect?: (publicKey: string) => void;

  /** Callback when wallet disconnects */
  onDisconnect?: () => void;

  /** Required network (shows warning if different) */
  requiredNetwork?: 'devnet' | 'mainnet-beta';

  /** Custom className */
  className?: string;

  /** Button variant */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';

  /** Button size */
  size?: 'sm' | 'md' | 'lg';

  /** Show network indicator */
  showNetwork?: boolean;

  /** Show wallet icon */
  showWalletIcon?: boolean;

  /** Compact display mode (shows only wallet name when connected) */
  compact?: boolean;

  /** Custom labels */
  labels?: {
    connect?: string;
    disconnect?: string;
    connecting?: string;
    wrongNetwork?: string;
  };
}