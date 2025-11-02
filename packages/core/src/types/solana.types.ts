/**
 * Solana-specific types for transaction verification
 */

/**
 * USDC transfer extracted from a Solana transaction
 */
export interface USDCTransfer {
  /** Source token account (sender's USDC account) */
  source: string;

  /** Destination token account (recipient's USDC account) */
  destination: string;

  /** Authority (wallet that signed the transfer) */
  authority: string;

  /** Amount transferred in micro-USDC (6 decimals) */
  amount: number;

  /** Token mint address (should be USDC mint) */
  mint: string;
}

/**
 * Result of payment verification
 */
export interface VerificationResult {
  /** Whether payment is valid */
  valid: boolean;

  /** Transfer details (only if valid) */
  transfer?: USDCTransfer;

  /** Transaction signature (only if valid) */
  signature?: string;

  /** Block time (only if valid) */
  blockTime?: number;

  /** Slot number (only if valid) */
  slot?: number;

  /** Error message (only if invalid) */
  error?: string;

  /** Error code for programmatic handling (only if invalid) */
  code?: string;

  /** Debug information for troubleshooting */
  debug?: {
    expectedRecipient?: string;
    expectedAmount?: number;
    foundTransfers?: USDCTransfer[];
    transactionAge?: number;
    [key: string]: any;
  };
}

/**
 * Options for payment verification
 */
export interface VerificationOptions {
  /** Maximum age of transaction in milliseconds (default: 300000 = 5 minutes) */
  maxAgeMs?: number;

  /** Whether to skip cache check (for testing) */
  skipCacheCheck?: boolean;

  /** Custom commitment level */
  commitment?: 'processed' | 'confirmed' | 'finalized';
}

/**
 * Payment cache metadata stored for each used signature
 */
export interface PaymentMetadata {
  /** Recipient address that was paid */
  recipient: string;

  /** Amount paid in micro-USDC */
  amount: number;

  /** Timestamp when payment was verified */
  timestamp: number;

  /** Optional: payer address */
  payer?: string;
}

/**
 * Supported Solana networks
 */
export type SolanaNetwork = 'devnet' | 'mainnet-beta' | 'testnet' | 'localnet';

/**
 * USDC mint addresses by network
 */
export const USDC_MINT_ADDRESSES: Record<string, string> = {
  devnet: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr', // Devnet USDC mint being used for testing
  'mainnet-beta': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  testnet: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr', // Use same as devnet for testnet
  localnet: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr', // Use same as devnet for local
};

/**
 * Configuration for transaction verifier
 */
export interface VerifierConfig {
  /** Solana RPC URL */
  rpcUrl: string;

  /** Commitment level for transaction fetching */
  commitment?: 'processed' | 'confirmed' | 'finalized';

  /** Cache configuration */
  cacheConfig?: CacheConfig;

  /** Maximum retries for RPC calls */
  maxRetries?: number;

  /** Retry delay base in milliseconds */
  retryDelayMs?: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Redis URL (if using Redis) */
  redisUrl?: string;

  /** Cache TTL in seconds */
  ttlSeconds?: number;

  /** Use in-memory cache if Redis not available */
  useInMemory?: boolean;
}

/**
 * Transaction parser result
 */
export interface ParsedTransaction {
  /** All USDC transfers found in transaction */
  transfers: USDCTransfer[];

  /** Transaction signature */
  signature: string;

  /** Block time */
  blockTime: number | null;

  /** Slot */
  slot: number;

  /** Whether transaction succeeded */
  success: boolean;

  /** Error if transaction failed */
  error?: any;
}
