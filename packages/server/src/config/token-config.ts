/**
 * SPL token configuration
 * Defines supported tokens for payment
 */

import { PublicKey } from '@solana/web3.js';
import { SolanaNetwork } from './network-config';

/**
 * Token configuration interface
 */
export interface TokenConfig {
  /** Token symbol */
  symbol: string;

  /** Token name */
  name: string;

  /** Mint address */
  mint: string;

  /** Number of decimals */
  decimals: number;

  /** Token logo URL (optional) */
  logoUrl?: string;

  /** Coingecko ID for price lookup (optional) */
  coingeckoId?: string;
}

/**
 * USDC configuration for devnet
 */
export const USDC_DEVNET: TokenConfig = {
  symbol: 'USDC',
  name: 'USD Coin (Devnet)',
  mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  decimals: 6,
  logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  coingeckoId: 'usd-coin',
};

/**
 * USDC configuration for mainnet
 */
export const USDC_MAINNET: TokenConfig = {
  symbol: 'USDC',
  name: 'USD Coin',
  mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  decimals: 6,
  logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  coingeckoId: 'usd-coin',
};

/**
 * USDT configuration for mainnet
 */
export const USDT_MAINNET: TokenConfig = {
  symbol: 'USDT',
  name: 'Tether USD',
  mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  decimals: 6,
  logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
  coingeckoId: 'tether',
};

/**
 * Token registry by network
 */
export const TOKEN_REGISTRY: Record<SolanaNetwork, Record<string, TokenConfig>> = {
  devnet: {
    USDC: USDC_DEVNET,
  },
  'mainnet-beta': {
    USDC: USDC_MAINNET,
    USDT: USDT_MAINNET,
  },
};

/**
 * Get token configuration
 *
 * @param symbol - Token symbol (e.g., 'USDC')
 * @param network - Network name
 * @returns Token configuration
 * @throws Error if token is not supported
 *
 * @example
 * ```typescript
 * const usdcConfig = getTokenConfig('USDC', 'devnet');
 * console.log(usdcConfig.mint); // 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
 * ```
 */
export function getTokenConfig(
  symbol: string,
  network: SolanaNetwork
): TokenConfig {
  const networkTokens = TOKEN_REGISTRY[network];

  if (!networkTokens) {
    throw new Error(`Unsupported network: ${network}`);
  }

  const token = networkTokens[symbol.toUpperCase()];

  if (!token) {
    throw new Error(
      `Token ${symbol} not supported on ${network}. Supported tokens: ${Object.keys(networkTokens).join(', ')}`
    );
  }

  return token;
}

/**
 * Get token by mint address
 *
 * @param mintAddress - Mint address
 * @param network - Network name
 * @returns Token configuration or undefined
 *
 * @example
 * ```typescript
 * const token = getTokenByMint('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', 'devnet');
 * ```
 */
export function getTokenByMint(
  mintAddress: string,
  network: SolanaNetwork
): TokenConfig | undefined {
  const networkTokens = TOKEN_REGISTRY[network];

  if (!networkTokens) {
    return undefined;
  }

  return Object.values(networkTokens).find(
    token => token.mint === mintAddress
  );
}

/**
 * Check if token is supported
 *
 * @param symbol - Token symbol
 * @param network - Network name
 * @returns True if token is supported
 *
 * @example
 * ```typescript
 * const isSupported = isTokenSupported('USDC', 'devnet'); // true
 * const isNotSupported = isTokenSupported('SOL', 'devnet'); // false
 * ```
 */
export function isTokenSupported(
  symbol: string,
  network: SolanaNetwork
): boolean {
  try {
    getTokenConfig(symbol, network);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all supported tokens for network
 *
 * @param network - Network name
 * @returns Array of token configurations
 *
 * @example
 * ```typescript
 * const tokens = getSupportedTokens('mainnet-beta');
 * console.log(tokens.map(t => t.symbol)); // ['USDC', 'USDT']
 * ```
 */
export function getSupportedTokens(network: SolanaNetwork): TokenConfig[] {
  const networkTokens = TOKEN_REGISTRY[network];

  if (!networkTokens) {
    return [];
  }

  return Object.values(networkTokens);
}

/**
 * Convert token amount to smallest unit (micro-tokens)
 *
 * @param amount - Amount in token units
 * @param decimals - Token decimals
 * @returns Amount in smallest unit
 *
 * @example
 * ```typescript
 * const microUSDC = toSmallestUnit(1.5, 6); // 1500000
 * ```
 */
export function toSmallestUnit(amount: number, decimals: number): number {
  return Math.floor(amount * Math.pow(10, decimals));
}

/**
 * Convert smallest unit to token amount
 *
 * @param microAmount - Amount in smallest unit
 * @param decimals - Token decimals
 * @returns Amount in token units
 *
 * @example
 * ```typescript
 * const usdc = fromSmallestUnit(1500000, 6); // 1.5
 * ```
 */
export function fromSmallestUnit(microAmount: number, decimals: number): number {
  return microAmount / Math.pow(10, decimals);
}

/**
 * Validate mint address format
 *
 * @param mintAddress - Mint address to validate
 * @returns True if valid
 *
 * @example
 * ```typescript
 * const valid = isValidMintAddress('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
 * ```
 */
export function isValidMintAddress(mintAddress: string): boolean {
  try {
    new PublicKey(mintAddress);
    return true;
  } catch {
    return false;
  }
}

/**
 * Format token amount with proper decimals
 *
 * @param amount - Amount in token units
 * @param decimals - Token decimals
 * @param maxDecimals - Maximum decimals to display (default: decimals)
 * @returns Formatted amount string
 *
 * @example
 * ```typescript
 * const formatted = formatTokenAmount(1.234567, 6, 4); // '1.2346'
 * ```
 */
export function formatTokenAmount(
  amount: number,
  decimals: number,
  maxDecimals: number = decimals
): string {
  const displayDecimals = Math.min(decimals, maxDecimals);
  return amount.toFixed(displayDecimals);
}
