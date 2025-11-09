/**
 * Webhook retry queue
 *
 * Handles webhook delivery retries with exponential backoff
 */

import { randomBytes } from 'crypto';
import {
  IWebhookQueue,
  QueuedWebhook,
  WebhookConfig,
  WebhookPayload,
  BackoffStrategy,
} from './types';

/**
 * In-memory webhook queue with retry logic
 *
 * @example
 * ```typescript
 * const queue = new InMemoryWebhookQueue();
 *
 * await queue.enqueue({
 *   id: '123',
 *   config: { url: '...', secret: '...' },
 *   payload: { ... },
 *   attempts: 0,
 *   nextAttempt: Date.now(),
 *   createdAt: Date.now(),
 * });
 *
 * const webhook = await queue.dequeue();
 * if (webhook) {
 *   // Try to send...
 *   // If failed:
 *   await queue.retry(webhook, 'Connection timeout');
 * }
 * ```
 */
export class InMemoryWebhookQueue implements IWebhookQueue {
  private queue: Map<string, QueuedWebhook> = new Map();
  private readonly debug: boolean;

  constructor(config?: { debug?: boolean }) {
    this.debug = config?.debug || false;
  }

  /**
   * Add webhook to queue
   */
  async enqueue(webhook: QueuedWebhook): Promise<void> {
    if (!webhook.id) {
      webhook.id = this.generateId();
    }

    this.queue.set(webhook.id, webhook);

    if (this.debug) {
      console.log('[webhook-queue] Enqueued:', {
        id: webhook.id,
        url: webhook.config.url,
        nextAttempt: new Date(webhook.nextAttempt).toISOString(),
      });
    }
  }

  /**
   * Get next webhook ready for delivery
   *
   * Returns webhooks that have reached their nextAttempt time
   */
  async dequeue(): Promise<QueuedWebhook | null> {
    const now = Date.now();

    // Find first webhook ready for delivery
    for (const webhook of this.queue.values()) {
      if (webhook.nextAttempt <= now) {
        this.queue.delete(webhook.id);

        if (this.debug) {
          console.log('[webhook-queue] Dequeued:', {
            id: webhook.id,
            url: webhook.config.url,
            attempt: webhook.attempts + 1,
          });
        }

        return webhook;
      }
    }

    return null;
  }

  /**
   * Re-queue webhook for retry
   */
  async retry(webhook: QueuedWebhook, error?: string): Promise<void> {
    const retryConfig = webhook.config.retry || {};
    const maxAttempts = retryConfig.maxAttempts || 3;

    // Check if max attempts reached
    if (webhook.attempts >= maxAttempts) {
      if (this.debug) {
        console.log('[webhook-queue] Max attempts reached:', {
          id: webhook.id,
          url: webhook.config.url,
          attempts: webhook.attempts,
        });
      }
      return;
    }

    // Calculate next retry delay
    const delay = this.calculateDelay(webhook.attempts, retryConfig);

    // Update webhook
    webhook.attempts += 1;
    webhook.nextAttempt = Date.now() + delay;
    webhook.lastError = error;

    // Re-queue
    await this.enqueue(webhook);

    if (this.debug) {
      console.log('[webhook-queue] Scheduled retry:', {
        id: webhook.id,
        url: webhook.config.url,
        attempt: webhook.attempts,
        delay,
        nextAttempt: new Date(webhook.nextAttempt).toISOString(),
      });
    }
  }

  /**
   * Remove webhook from queue
   */
  async remove(id: string): Promise<void> {
    this.queue.delete(id);
  }

  /**
   * Get queue size
   */
  async size(): Promise<number> {
    return this.queue.size;
  }

  /**
   * Process all pending webhooks
   *
   * This method should be called periodically by WebhookManager
   */
  async processQueue(): Promise<void> {
    // This is a no-op for InMemoryQueue
    // Processing is handled by WebhookManager
  }

  /**
   * Close queue
   */
  async close(): Promise<void> {
    this.queue.clear();
  }

  /**
   * Calculate retry delay based on attempt number
   */
  private calculateDelay(
    attempts: number,
    config: {
      initialDelay?: number;
      maxDelay?: number;
      backoff?: BackoffStrategy;
    }
  ): number {
    const initialDelay = config.initialDelay || 100;
    const maxDelay = config.maxDelay || 60000;
    const backoff = config.backoff || 'exponential';

    let delay: number;

    if (backoff === 'exponential') {
      // Exponential: 100ms, 200ms, 400ms, 800ms, 1600ms...
      delay = initialDelay * Math.pow(2, attempts);
    } else {
      // Linear: 100ms, 200ms, 300ms, 400ms...
      delay = initialDelay * (attempts + 1);
    }

    return Math.min(delay, maxDelay);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `webhook_${Date.now()}_${randomBytes(4).toString('hex')}`;
  }

  /**
   * Get all webhooks in queue (for debugging)
   */
  getAll(): QueuedWebhook[] {
    return Array.from(this.queue.values());
  }
}

/**
 * Redis-based webhook queue (optional)
 *
 * Provides persistent queue storage using Redis
 */
export class RedisWebhookQueue implements IWebhookQueue {
  private redis: any; // Redis client
  private readonly keyPrefix: string;
  private readonly debug: boolean;

  constructor(config: {
    redis: any;
    keyPrefix?: string;
    debug?: boolean;
  }) {
    this.redis = config.redis;
    this.keyPrefix = config.keyPrefix || 'webhook:queue:';
    this.debug = config.debug || false;
  }

  /**
   * Add webhook to queue
   */
  async enqueue(webhook: QueuedWebhook): Promise<void> {
    if (!webhook.id) {
      webhook.id = this.generateId();
    }

    const key = `${this.keyPrefix}${webhook.id}`;
    const data = JSON.stringify(webhook);

    await this.redis.set(key, data);

    // Add to sorted set by nextAttempt time
    await this.redis.zadd(
      `${this.keyPrefix}pending`,
      webhook.nextAttempt,
      webhook.id
    );

    if (this.debug) {
      console.log('[webhook-queue] Enqueued (Redis):', {
        id: webhook.id,
        url: webhook.config.url,
      });
    }
  }

  /**
   * Get next webhook ready for delivery
   */
  async dequeue(): Promise<QueuedWebhook | null> {
    const now = Date.now();

    // Get webhooks ready for delivery
    const ids = await this.redis.zrangebyscore(
      `${this.keyPrefix}pending`,
      0,
      now,
      'LIMIT',
      0,
      1
    );

    if (!ids || ids.length === 0) {
      return null;
    }

    const id = ids[0];

    // Get webhook data
    const key = `${this.keyPrefix}${id}`;
    const data = await this.redis.get(key);

    if (!data) {
      // Remove from sorted set if data missing
      await this.redis.zrem(`${this.keyPrefix}pending`, id);
      return null;
    }

    // Remove from queue
    await this.redis.del(key);
    await this.redis.zrem(`${this.keyPrefix}pending`, id);

    const webhook: QueuedWebhook = JSON.parse(data);

    if (this.debug) {
      console.log('[webhook-queue] Dequeued (Redis):', {
        id: webhook.id,
        url: webhook.config.url,
      });
    }

    return webhook;
  }

  /**
   * Re-queue webhook for retry
   */
  async retry(webhook: QueuedWebhook, error?: string): Promise<void> {
    const retryConfig = webhook.config.retry || {};
    const maxAttempts = retryConfig.maxAttempts || 3;

    if (webhook.attempts >= maxAttempts) {
      if (this.debug) {
        console.log('[webhook-queue] Max attempts reached (Redis):', {
          id: webhook.id,
          attempts: webhook.attempts,
        });
      }
      return;
    }

    const delay = this.calculateDelay(webhook.attempts, retryConfig);

    webhook.attempts += 1;
    webhook.nextAttempt = Date.now() + delay;
    webhook.lastError = error;

    await this.enqueue(webhook);
  }

  /**
   * Remove webhook from queue
   */
  async remove(id: string): Promise<void> {
    const key = `${this.keyPrefix}${id}`;
    await this.redis.del(key);
    await this.redis.zrem(`${this.keyPrefix}pending`, id);
  }

  /**
   * Get queue size
   */
  async size(): Promise<number> {
    return await this.redis.zcard(`${this.keyPrefix}pending`);
  }

  /**
   * Process all pending webhooks
   */
  async processQueue(): Promise<void> {
    // No-op, processing handled by WebhookManager
  }

  /**
   * Close queue
   */
  async close(): Promise<void> {
    // Redis connection managed externally
  }

  /**
   * Calculate retry delay
   */
  private calculateDelay(
    attempts: number,
    config: {
      initialDelay?: number;
      maxDelay?: number;
      backoff?: BackoffStrategy;
    }
  ): number {
    const initialDelay = config.initialDelay || 100;
    const maxDelay = config.maxDelay || 60000;
    const backoff = config.backoff || 'exponential';

    let delay: number;

    if (backoff === 'exponential') {
      delay = initialDelay * Math.pow(2, attempts);
    } else {
      delay = initialDelay * (attempts + 1);
    }

    return Math.min(delay, maxDelay);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `webhook_${Date.now()}_${randomBytes(4).toString('hex')}`;
  }
}

/**
 * Create webhook queue
 *
 * @param config - Queue configuration
 * @returns Webhook queue instance
 */
export function createWebhookQueue(config?: {
  redis?: any;
  keyPrefix?: string;
  debug?: boolean;
}): IWebhookQueue {
  if (config?.redis) {
    return new RedisWebhookQueue({
      redis: config.redis,
      keyPrefix: config.keyPrefix,
      debug: config.debug,
    });
  }

  return new InMemoryWebhookQueue({
    debug: config?.debug,
  });
}

/**
 * Create queued webhook from config and payload
 *
 * @param config - Webhook configuration
 * @param payload - Webhook payload
 * @returns Queued webhook ready for delivery
 */
export function createQueuedWebhook(
  config: WebhookConfig,
  payload: WebhookPayload
): QueuedWebhook {
  return {
    id: `webhook_${Date.now()}_${randomBytes(4).toString('hex')}`,
    config,
    payload,
    attempts: 0,
    nextAttempt: Date.now(),
    createdAt: Date.now(),
  };
}