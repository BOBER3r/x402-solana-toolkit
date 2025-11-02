/**
 * RPC endpoint configuration and management
 * Provides RPC endpoints with automatic failover
 */

import { SolanaNetwork } from './network-config';

/**
 * RPC endpoint configuration
 */
export interface RPCEndpoint {
  /** Endpoint URL */
  url: string;

  /** Weight for load balancing (higher = more likely to be chosen) */
  weight: number;

  /** Whether this endpoint is currently healthy */
  healthy: boolean;

  /** Last failure timestamp */
  lastFailure?: number;
}

/**
 * RPC configuration
 */
export interface RPCConfig {
  /** Network */
  network: SolanaNetwork;

  /** List of RPC endpoints */
  endpoints: RPCEndpoint[];

  /** Retry configuration */
  retryConfig: {
    /** Maximum number of retries */
    maxRetries: number;

    /** Base delay between retries in milliseconds */
    baseDelayMs: number;

    /** Maximum delay between retries in milliseconds */
    maxDelayMs: number;

    /** Exponential backoff multiplier */
    backoffMultiplier: number;
  };

  /** Health check interval in milliseconds */
  healthCheckIntervalMs: number;

  /** Timeout for marking endpoint as unhealthy in milliseconds */
  unhealthyTimeoutMs: number;
}

/**
 * Default devnet RPC endpoints
 */
export const DEFAULT_DEVNET_ENDPOINTS: RPCEndpoint[] = [
  {
    url: 'https://api.devnet.solana.com',
    weight: 100,
    healthy: true,
  },
  {
    url: 'https://devnet.helius-rpc.com/?api-key=public',
    weight: 80,
    healthy: true,
  },
];

/**
 * Default mainnet RPC endpoints
 */
export const DEFAULT_MAINNET_ENDPOINTS: RPCEndpoint[] = [
  {
    url: 'https://api.mainnet-beta.solana.com',
    weight: 100,
    healthy: true,
  },
  {
    url: 'https://mainnet.helius-rpc.com/?api-key=public',
    weight: 80,
    healthy: true,
  },
];

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
};

/**
 * RPC manager for handling multiple endpoints with failover
 */
export class RPCManager {
  private config: RPCConfig;

  /**
   * Create RPC manager
   *
   * @param network - Network name
   * @param customEndpoints - Custom RPC endpoints (optional)
   *
   * @example
   * ```typescript
   * const manager = new RPCManager('devnet', [
   *   { url: 'https://my-rpc.com', weight: 100, healthy: true }
   * ]);
   * ```
   */
  constructor(network: SolanaNetwork, customEndpoints?: RPCEndpoint[]) {
    const defaultEndpoints =
      network === 'devnet'
        ? DEFAULT_DEVNET_ENDPOINTS
        : DEFAULT_MAINNET_ENDPOINTS;

    this.config = {
      network,
      endpoints: customEndpoints || defaultEndpoints,
      retryConfig: DEFAULT_RETRY_CONFIG,
      healthCheckIntervalMs: 60_000, // 1 minute
      unhealthyTimeoutMs: 300_000, // 5 minutes
    };
  }

  /**
   * Get next available RPC endpoint
   * Uses weighted round-robin with health checking
   *
   * @returns RPC endpoint URL
   * @throws Error if no healthy endpoints available
   *
   * @example
   * ```typescript
   * const url = manager.getNextEndpoint();
   * const connection = new Connection(url);
   * ```
   */
  getNextEndpoint(): string {
    const healthyEndpoints = this.config.endpoints.filter(e => e.healthy);

    if (healthyEndpoints.length === 0) {
      // No healthy endpoints - try to recover the least recently failed one
      const sortedByFailure = [...this.config.endpoints].sort((a, b) => {
        const aTime = a.lastFailure || 0;
        const bTime = b.lastFailure || 0;
        return aTime - bTime;
      });

      if (sortedByFailure.length > 0) {
        const recovered = sortedByFailure[0];
        recovered.healthy = true;
        return recovered.url;
      }

      throw new Error('No RPC endpoints available');
    }

    // Select endpoint using weighted round-robin
    const totalWeight = healthyEndpoints.reduce((sum, e) => sum + e.weight, 0);
    let random = Math.random() * totalWeight;

    for (const endpoint of healthyEndpoints) {
      random -= endpoint.weight;
      if (random <= 0) {
        return endpoint.url;
      }
    }

    // Fallback to first healthy endpoint
    return healthyEndpoints[0].url;
  }

  /**
   * Mark endpoint as failed
   *
   * @param url - Endpoint URL that failed
   *
   * @example
   * ```typescript
   * try {
   *   // ... RPC call fails
   * } catch (error) {
   *   manager.markEndpointFailed(url);
   * }
   * ```
   */
  markEndpointFailed(url: string): void {
    const endpoint = this.config.endpoints.find(e => e.url === url);

    if (endpoint) {
      endpoint.healthy = false;
      endpoint.lastFailure = Date.now();
    }
  }

  /**
   * Mark endpoint as healthy
   *
   * @param url - Endpoint URL
   *
   * @example
   * ```typescript
   * manager.markEndpointHealthy(url);
   * ```
   */
  markEndpointHealthy(url: string): void {
    const endpoint = this.config.endpoints.find(e => e.url === url);

    if (endpoint) {
      endpoint.healthy = true;
      endpoint.lastFailure = undefined;
    }
  }

  /**
   * Add custom RPC endpoint
   *
   * @param url - Endpoint URL
   * @param weight - Weight for load balancing (default: 100)
   *
   * @example
   * ```typescript
   * manager.addEndpoint('https://my-custom-rpc.com', 150);
   * ```
   */
  addEndpoint(url: string, weight: number = 100): void {
    // Check if endpoint already exists
    const existing = this.config.endpoints.find(e => e.url === url);

    if (existing) {
      existing.weight = weight;
      existing.healthy = true;
      return;
    }

    this.config.endpoints.push({
      url,
      weight,
      healthy: true,
    });
  }

  /**
   * Remove RPC endpoint
   *
   * @param url - Endpoint URL to remove
   *
   * @example
   * ```typescript
   * manager.removeEndpoint('https://slow-rpc.com');
   * ```
   */
  removeEndpoint(url: string): void {
    this.config.endpoints = this.config.endpoints.filter(e => e.url !== url);
  }

  /**
   * Get all endpoints
   *
   * @returns Array of RPC endpoints
   */
  getEndpoints(): RPCEndpoint[] {
    return [...this.config.endpoints];
  }

  /**
   * Get healthy endpoints count
   *
   * @returns Number of healthy endpoints
   */
  getHealthyCount(): number {
    return this.config.endpoints.filter(e => e.healthy).length;
  }

  /**
   * Get retry configuration
   *
   * @returns Retry configuration
   */
  getRetryConfig() {
    return { ...this.config.retryConfig };
  }

  /**
   * Update retry configuration
   *
   * @param config - Partial retry configuration
   *
   * @example
   * ```typescript
   * manager.updateRetryConfig({ maxRetries: 5, baseDelayMs: 200 });
   * ```
   */
  updateRetryConfig(config: Partial<typeof DEFAULT_RETRY_CONFIG>): void {
    this.config.retryConfig = {
      ...this.config.retryConfig,
      ...config,
    };
  }

  /**
   * Restore all endpoints to healthy state
   * Useful for testing or recovery scenarios
   */
  resetHealth(): void {
    for (const endpoint of this.config.endpoints) {
      endpoint.healthy = true;
      endpoint.lastFailure = undefined;
    }
  }
}

/**
 * Create RPC manager with environment variable configuration
 * Reads SOLANA_RPC_URL environment variable
 *
 * @param network - Network name
 * @returns RPC manager
 *
 * @example
 * ```typescript
 * // With SOLANA_RPC_URL environment variable set
 * const manager = createRPCManagerFromEnv('devnet');
 * ```
 */
export function createRPCManagerFromEnv(network: SolanaNetwork): RPCManager {
  const customUrl = process.env.SOLANA_RPC_URL;

  if (customUrl) {
    return new RPCManager(network, [
      {
        url: customUrl,
        weight: 100,
        healthy: true,
      },
    ]);
  }

  return new RPCManager(network);
}
