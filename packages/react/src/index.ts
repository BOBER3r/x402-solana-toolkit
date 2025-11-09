/**
 * @x402-solana/react
 * React hooks and components for x402 payment protocol on Solana
 *
 * @packageDocumentation
 */

// Main provider component
export { X402Provider } from './components/X402Provider';
export type { X402ProviderProps } from './components/X402Provider';

// Context
export { useX402, X402Context } from './context/X402Context';

// Hooks
export { useX402Payment } from './hooks/useX402Payment';
export { useWalletBalance } from './hooks/useWalletBalance';
export { usePaymentHistory } from './hooks/usePaymentHistory';

// UI Components
export { PaymentButton } from './components/PaymentButton';
export { BalanceBadge } from './components/BalanceBadge';
export { PaymentStatus } from './components/PaymentStatus';
export { PaymentHistory } from './components/PaymentHistory';
export { PriceTag } from './components/PriceTag';
export { WalletConnect } from './components/WalletConnect';

// Shared UI Components
export {
  Spinner,
  CheckIcon,
  ErrorIcon,
  WarningIcon,
  RefreshIcon,
  ExternalLinkIcon,
  WalletIcon,
  DownloadIcon,
  InfoIcon,
} from './components/shared';

// Component Types
export type { PaymentButtonProps } from './components/PaymentButton';
export type { BalanceBadgeProps } from './components/BalanceBadge';
export type { PaymentStatusProps, TransactionStatus } from './components/PaymentStatus';
export type { PaymentHistoryProps, PaymentFilter } from './components/PaymentHistory';
export type { PriceTagProps } from './components/PriceTag';
export type { WalletConnectProps } from './components/WalletConnect';
export type { SpinnerProps, IconProps } from './components/shared';

// Theme and Styling
export {
  defaultTheme,
  darkTheme,
  createTheme,
  usdcColors,
  solanaColors,
} from './styles/theme';
export type { X402Theme } from './styles/theme';

// Hook and Provider Types
export type {
  X402ProviderConfig,
  X402ContextValue,
  PaymentHistoryEntry,
  UseX402PaymentOptions,
  UseX402PaymentReturn,
  UseWalletBalanceOptions,
  UseWalletBalanceReturn,
  UsePaymentHistoryOptions,
  UsePaymentHistoryReturn,
  X402PaymentError,
} from './types';

// Utility functions (for advanced use cases)
export {
  createPaymentWithWallet,
  getUSDCBalance,
  getSOLBalance,
  encodePaymentProof,
  isWalletSupported,
  getUSDCMint,
  validatePaymentRequirements,
} from './utils/wallet-adapter';