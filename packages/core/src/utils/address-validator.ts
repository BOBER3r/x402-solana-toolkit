/**
 * Solana address validation utilities
 */

import { PublicKey } from '@solana/web3.js';
import { USDC_MINT_ADDRESSES } from '../types/solana.types';

/**
 * Validate if a string is a valid Solana address
 *
 * @param address - Address string to validate
 * @returns Whether address is valid
 *
 * @example
 * ```typescript
 * const valid = isValidSolanaAddress('11111111111111111111111111111111'); // true
 * const invalid = isValidSolanaAddress('invalid'); // false
 * ```
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate if a string is a valid transaction signature
 * Solana signatures are base58-encoded and 88 characters long
 *
 * @param signature - Signature string to validate
 * @returns Whether signature is valid format
 *
 * @example
 * ```typescript
 * const valid = isValidSignature('5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7');
 * ```
 */
export function isValidSignature(signature: string): boolean {
  // Solana signatures are base58-encoded and typically 87-88 characters
  if (signature.length < 87 || signature.length > 88) {
    return false;
  }

  // Check if it's valid base58
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  return base58Regex.test(signature);
}

/**
 * Validate if an address is a USDC mint address
 *
 * @param address - Address to check
 * @param network - Network to check against (optional)
 * @returns Whether address is a known USDC mint
 *
 * @example
 * ```typescript
 * const isUSDC = isUSDCMint('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'); // true (devnet)
 * ```
 */
export function isUSDCMint(address: string, network?: string): boolean {
  if (network) {
    return USDC_MINT_ADDRESSES[network] === address;
  }

  // Check against all known networks
  return Object.values(USDC_MINT_ADDRESSES).includes(address);
}

/**
 * Get USDC mint address for a network
 *
 * @param network - Network name
 * @returns USDC mint address for the network
 * @throws Error if network is not supported
 *
 * @example
 * ```typescript
 * const mint = getUSDCMint('devnet'); // '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
 * ```
 */
export function getUSDCMint(network: string): string {
  const mint = USDC_MINT_ADDRESSES[network];

  if (!mint) {
    throw new Error(`Unsupported network: ${network}. Supported: ${Object.keys(USDC_MINT_ADDRESSES).join(', ')}`);
  }

  return mint;
}

/**
 * Normalize network name to canonical form
 *
 * @param network - Network name (various formats)
 * @returns Canonical network name
 *
 * @example
 * ```typescript
 * const normalized = normalizeNetwork('mainnet'); // 'mainnet-beta'
 * const normalized2 = normalizeNetwork('devnet'); // 'devnet'
 * ```
 */
export function normalizeNetwork(network: string): string {
  const normalized = network.toLowerCase().trim();

  // Handle common variations
  if (normalized === 'mainnet' || normalized === 'mainnet-beta') {
    return 'mainnet-beta';
  }

  if (normalized === 'devnet') {
    return 'devnet';
  }

  if (normalized === 'testnet') {
    return 'testnet';
  }

  if (normalized === 'localnet' || normalized === 'localhost') {
    return 'localnet';
  }

  // Return as-is if already canonical
  return normalized;
}

/**
 * Extract network from x402 network identifier
 *
 * @param x402Network - Network identifier from x402 protocol (e.g., 'solana-devnet')
 * @returns Canonical network name
 *
 * @example
 * ```typescript
 * const network = extractNetworkFromX402('solana-devnet'); // 'devnet'
 * const network2 = extractNetworkFromX402('solana-mainnet-beta'); // 'mainnet-beta'
 * ```
 */
export function extractNetworkFromX402(x402Network: string): string {
  // Remove 'solana-' prefix if present
  const withoutPrefix = x402Network.replace(/^solana-/, '');
  return normalizeNetwork(withoutPrefix);
}

/**
 * Format network for x402 protocol
 *
 * @param network - Canonical network name
 * @returns x402 network identifier
 *
 * @example
 * ```typescript
 * const x402Network = formatNetworkForX402('devnet'); // 'solana-devnet'
 * const x402Network2 = formatNetworkForX402('mainnet-beta'); // 'solana-mainnet-beta'
 * ```
 */
export function formatNetworkForX402(network: string): string {
  const normalized = normalizeNetwork(network);
  return `solana-${normalized}`;
}

/**
 * Compare two addresses for equality
 * Handles both string and PublicKey comparisons
 *
 * @param address1 - First address
 * @param address2 - Second address
 * @returns Whether addresses are equal
 *
 * @example
 * ```typescript
 * const equal = areAddressesEqual('11111111111111111111111111111111', '11111111111111111111111111111111');
 * ```
 */
export function areAddressesEqual(
  address1: string | PublicKey,
  address2: string | PublicKey
): boolean {
  const addr1 = typeof address1 === 'string' ? address1 : address1.toString();
  const addr2 = typeof address2 === 'string' ? address2 : address2.toString();

  return addr1 === addr2;
}
