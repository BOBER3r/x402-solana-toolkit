/**
 * Payment cache for replay attack prevention
 * Supports both Redis and in-memory caching
 */

import Redis from 'ioredis';
import { PaymentMetadata } from '../types/solana.types';

/**
 * Interface for payment cache implementations
 */
export interface IPaymentCache {
  /**
   * Check if a payment signature has been used
   * @param signature - Transaction signature
   * @returns Whether signature has been used
   */
  isUsed(signature: string): Promise<boolean>;

  /**
   * Mark a payment signature as used
   * @param signature - Transaction signature
   * @param metadata - Payment metadata to store
   */
  markUsed(signature: string, metadata: PaymentMetadata): Promise<void>;

  /**
   * Get metadata for a payment signature
   * @param signature - Transaction signature
   * @returns Payment metadata or null if not found
   */
  getMetadata(signature: string): Promise<PaymentMetadata | null>;

  /**
   * Clear all cached payments (for testing)
   */
  clear(): Promise<void>;

  /**
   * Close the cache connection
   */
  close(): Promise<void>;
}

/**
 * Redis-based payment cache (production)
 */
export class RedisPaymentCache implements IPaymentCache {
  private redis: Redis;
  private ttlSeconds: number;
  private keyPrefix: string;

  /**
   * Create a Redis payment cache
   *
   * @param redisUrl - Redis connection URL (default: redis://localhost:6379)
   * @param ttlSeconds - Cache TTL in seconds (default: 600 = 10 minutes)
   * @param keyPrefix - Key prefix for cache entries (default: x402:payment:)
   *
   * @example
   * ```typescript
   * const cache = new RedisPaymentCache('redis://localhost:6379', 600);
   * await cache.markUsed(signature, metadata);
   * const used = await cache.isUsed(signature);
   * ```
   */
  constructor(
    redisUrl: string = 'redis://localhost:6379',
    ttlSeconds: number = 600,
    keyPrefix: string = 'x402:payment:'
  ) {
    this.redis = new Redis(redisUrl);
    this.ttlSeconds = ttlSeconds;
    this.keyPrefix = keyPrefix;

    // Handle Redis errors
    this.redis.on('error', (err: Error) => {
      console.error('Redis error:', err);
    });
  }

  async isUsed(signature: string): Promise<boolean> {
    const key = this.getKey(signature);
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async markUsed(signature: string, metadata: PaymentMetadata): Promise<void> {
    const key = this.getKey(signature);
    await this.redis.setex(key, this.ttlSeconds, JSON.stringify(metadata));
  }

  async getMetadata(signature: string): Promise<PaymentMetadata | null> {
    const key = this.getKey(signature);
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('Error parsing payment metadata:', error);
      return null;
    }
  }

  async clear(): Promise<void> {
    const keys = await this.redis.keys(`${this.keyPrefix}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }

  private getKey(signature: string): string {
    return `${this.keyPrefix}${signature}`;
  }
}

/**
 * In-memory payment cache (development/testing)
 * Not suitable for production with multiple server instances
 */
export class InMemoryPaymentCache implements IPaymentCache {
  private cache: Map<string, CacheEntry>;
  private ttlMs: number;
  private cleanupInterval: NodeJS.Timeout | null;

  /**
   * Create an in-memory payment cache
   *
   * @param ttlSeconds - Cache TTL in seconds (default: 600 = 10 minutes)
   * @param cleanupIntervalMs - How often to clean expired entries (default: 60000 = 1 minute)
   *
   * @example
   * ```typescript
   * const cache = new InMemoryPaymentCache(600);
   * await cache.markUsed(signature, metadata);
   * ```
   */
  constructor(ttlSeconds: number = 600, cleanupIntervalMs: number = 60000) {
    this.cache = new Map();
    this.ttlMs = ttlSeconds * 1000;
    this.cleanupInterval = null;

    // Start periodic cleanup
    if (cleanupIntervalMs > 0) {
      this.startCleanup(cleanupIntervalMs);
    }
  }

  async isUsed(signature: string): Promise<boolean> {
    this.cleanupExpired();
    return this.cache.has(signature);
  }

  async markUsed(signature: string, metadata: PaymentMetadata): Promise<void> {
    const entry: CacheEntry = {
      metadata,
      expiresAt: Date.now() + this.ttlMs,
    };
    this.cache.set(signature, entry);
  }

  async getMetadata(signature: string): Promise<PaymentMetadata | null> {
    this.cleanupExpired();
    const entry = this.cache.get(signature);
    return entry ? entry.metadata : null;
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    for (const [signature, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(signature);
      }
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(intervalMs: number): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, intervalMs);

    // Don't block process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }
}

/**
 * Cache entry for in-memory cache
 */
interface CacheEntry {
  metadata: PaymentMetadata;
  expiresAt: number;
}

/**
 * Create a payment cache based on configuration
 *
 * @param config - Cache configuration
 * @returns Payment cache implementation
 *
 * @example
 * ```typescript
 * const cache = createPaymentCache({
 *   redisUrl: process.env.REDIS_URL,
 *   ttlSeconds: 600,
 *   useInMemory: !process.env.REDIS_URL,
 * });
 * ```
 */
export function createPaymentCache(config: {
  redisUrl?: string;
  ttlSeconds?: number;
  useInMemory?: boolean;
}): IPaymentCache {
  const ttl = config.ttlSeconds || 600;

  if (config.useInMemory || !config.redisUrl) {
    console.warn('Using in-memory payment cache. Not suitable for production with multiple instances.');
    return new InMemoryPaymentCache(ttl);
  }

  return new RedisPaymentCache(config.redisUrl, ttl);
}
