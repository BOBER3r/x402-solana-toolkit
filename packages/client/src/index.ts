/**
 * @x402-solana/client - Client SDK for automatic x402 payment handling on Solana
 *
 * This package provides a simple SDK for handling HTTP 402 Payment Required
 * responses by automatically creating USDC payments on Solana.
 *
 * @example
 * ```typescript
 * import { X402Client } from '@x402-solana/client';
 *
 * const client = new X402Client({
 *   solanaRpcUrl: 'https://api.devnet.solana.com',
 *   walletPrivateKey: 'your-base58-private-key',
 *   network: 'devnet',
 * });
 *
 * // Automatically handles 402 payments
 * const response = await client.fetch('https://api.example.com/data');
 * const data = await response.json();
 * ```
 *
 * @packageDocumentation
 */

// Main client
export { X402Client, X402ClientConfig } from './x402-client';

// Utilities
export { WalletManager, WalletInfo } from './wallet-manager';
export {
  PaymentSender,
  PaymentCostEstimate,
  SendUSDCOptions,
} from './payment-sender';

// Types
export {
  PaymentRequirements,
  PaymentAccept,
  PaymentInfo,
  PaymentProof,
  PaymentError,
  PaymentErrorCode,
} from './types';
