/**
 * Network configuration for Solana
 * Provides devnet and mainnet-beta configurations
 */

/**
 * Supported Solana networks
 */
export type SolanaNetwork = 'devnet' | 'mainnet-beta';

/**
 * Network configuration interface
 */
export interface NetworkConfig {
  /** Network name */
  name: SolanaNetwork;

  /** USDC mint address for this network */
  usdcMint: string;

  /** Default RPC endpoint */
  defaultRpcUrl: string;

  /** Explorer base URL */
  explorerUrl: string;

  /** Average confirmation time in seconds */
  avgConfirmationTime: number;

  /** Maximum recommended payment age in milliseconds */
  maxPaymentAgeMs: number;
}

/**
 * Devnet configuration
 */
export const DEVNET_CONFIG: NetworkConfig = {
  name: 'devnet',
  usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // Devnet USDC
  defaultRpcUrl: 'https://api.devnet.solana.com',
  explorerUrl: 'https://explorer.solana.com',
  avgConfirmationTime: 0.4, // ~400ms for confirmed
  maxPaymentAgeMs: 300_000, // 5 minutes
};

/**
 * Mainnet-beta configuration
 */
export const MAINNET_CONFIG: NetworkConfig = {
  name: 'mainnet-beta',
  usdcMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Mainnet USDC
  defaultRpcUrl: 'https://api.mainnet-beta.solana.com',
  explorerUrl: 'https://explorer.solana.com',
  avgConfirmationTime: 0.4, // ~400ms for confirmed
  maxPaymentAgeMs: 300_000, // 5 minutes
};

/**
 * Network configuration map
 */
export const NETWORK_CONFIGS: Record<SolanaNetwork, NetworkConfig> = {
  devnet: DEVNET_CONFIG,
  'mainnet-beta': MAINNET_CONFIG,
};

/**
 * Get network configuration
 *
 * @param network - Network name
 * @returns Network configuration
 * @throws Error if network is not supported
 *
 * @example
 * ```typescript
 * const config = getNetworkConfig('devnet');
 * console.log(config.usdcMint); // 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
 * ```
 */
export function getNetworkConfig(network: SolanaNetwork): NetworkConfig {
  const config = NETWORK_CONFIGS[network];

  if (!config) {
    throw new Error(`Unsupported network: ${network}`);
  }

  return config;
}

/**
 * Get USDC mint address for network
 *
 * @param network - Network name
 * @returns USDC mint address
 *
 * @example
 * ```typescript
 * const mint = getUSDCMintForNetwork('devnet');
 * ```
 */
export function getUSDCMintForNetwork(network: SolanaNetwork): string {
  return getNetworkConfig(network).usdcMint;
}

/**
 * Format network name for x402 protocol
 *
 * @param network - Network name
 * @returns Formatted network name (e.g., 'solana-devnet')
 *
 * @example
 * ```typescript
 * const formatted = formatNetworkName('devnet'); // 'solana-devnet'
 * ```
 */
export function formatNetworkName(network: SolanaNetwork): string {
  return `solana-${network}`;
}

/**
 * Parse x402 network name to Solana network
 *
 * @param x402Network - x402 network name (e.g., 'solana-devnet')
 * @returns Solana network name
 * @throws Error if network format is invalid
 *
 * @example
 * ```typescript
 * const network = parseX402NetworkName('solana-devnet'); // 'devnet'
 * ```
 */
export function parseX402NetworkName(x402Network: string): SolanaNetwork {
  if (!x402Network.startsWith('solana-')) {
    throw new Error(`Invalid x402 network format: ${x402Network}`);
  }

  const network = x402Network.replace('solana-', '') as SolanaNetwork;

  if (!NETWORK_CONFIGS[network]) {
    throw new Error(`Unsupported network: ${network}`);
  }

  return network;
}

/**
 * Get explorer URL for transaction
 *
 * @param signature - Transaction signature
 * @param network - Network name
 * @returns Explorer URL
 *
 * @example
 * ```typescript
 * const url = getExplorerUrl('5j7s6N...', 'devnet');
 * // https://explorer.solana.com/tx/5j7s6N...?cluster=devnet
 * ```
 */
export function getExplorerUrl(
  signature: string,
  network: SolanaNetwork
): string {
  const config = getNetworkConfig(network);
  const cluster = network === 'mainnet-beta' ? '' : `?cluster=${network}`;
  return `${config.explorerUrl}/tx/${signature}${cluster}`;
}
