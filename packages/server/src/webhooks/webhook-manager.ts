/**
 * Webhook manager orchestrator
 *
 * Coordinates webhook sending, retries, logging, and queue processing
 */

import {
  WebhookConfig,
  WebhookPayload,
  WebhookDeliveryResult,
  WebhookManagerConfig,
  IWebhookQueue,
  IWebhookLogger,
  IWebhookSender,
} from './types';
import { WebhookSigner } from './webhook-signer';
import { WebhookSender } from './webhook-sender';
import { createWebhookQueue, createQueuedWebhook } from './webhook-queue';
import { createWebhookLogger } from './webhook-logger';

/**
 * Webhook manager for orchestrating webhook deliveries
 *
 * @example
 * ```typescript
 * const manager = new WebhookManager({
 *   debug: true,
 *   redis: { url: 'redis://localhost:6379' },
 * });
 *
 * // Send webhook immediately
 * await manager.send(
 *   {
 *     url: 'https://example.com/webhook',
 *     secret: 'my-secret',
 *   },
 *   {
 *     event: 'payment.confirmed',
 *     timestamp: Date.now(),
 *     payment: { ... },
 *   }
 * );
 *
 * // Send with automatic retries
 * await manager.sendWithRetry(config, payload);
 *
 * // Close manager
 * await manager.close();
 * ```
 */
export class WebhookManager {
  private readonly queue: IWebhookQueue;
  private readonly logger: IWebhookLogger;
  private readonly sender: IWebhookSender;
  private readonly signer: WebhookSigner;
  private readonly config: WebhookManagerConfig;
  private processInterval: NodeJS.Timeout | null = null;

  constructor(config?: WebhookManagerConfig) {
    this.config = config || {};

    // Initialize components
    this.signer = new WebhookSigner();
    this.sender = new WebhookSender({
      defaultTimeout: config?.defaultTimeout,
      debug: config?.debug,
    });

    // Create queue (Redis or in-memory)
    let redis: any = null;
    if (config?.redis) {
      try {
        // Dynamically import ioredis if available
        const Redis = require('ioredis');
        redis = new Redis(config.redis.url, {
          keyPrefix: config.redis.keyPrefix || 'x402:webhook:',
        });
      } catch (error) {
        console.warn('[webhook-manager] Redis not available, using in-memory queue');
      }
    }

    this.queue = createWebhookQueue({
      redis,
      debug: config?.debug,
    });

    this.logger = createWebhookLogger({
      debug: config?.debug,
    });

    // Start queue processor
    const interval = config?.queueProcessInterval || 1000;
    this.startQueueProcessor(interval);

    if (config?.debug) {
      console.log('[webhook-manager] Initialized:', {
        queue: redis ? 'redis' : 'in-memory',
        processInterval: interval,
      });
    }
  }

  /**
   * Send webhook immediately (no retry)
   *
   * @param config - Webhook configuration
   * @param payload - Webhook payload
   * @returns Delivery result
   */
  async send(
    config: WebhookConfig,
    payload: WebhookPayload
  ): Promise<WebhookDeliveryResult> {
    // Check if event is subscribed
    if (config.events && !config.events.includes(payload.event)) {
      return {
        success: false,
        error: 'Event not subscribed',
        responseTime: 0,
        attempts: 0,
        url: config.url,
        event: payload.event,
      };
    }

    // Generate signature
    const signature = this.signer.sign(payload, config.secret);

    // Send webhook
    const result = await this.sender.send(config.url, payload, signature, {
      timeout: config.timeout,
      headers: config.headers,
    });

    // Log delivery
    await this.logger.log({
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      url: config.url,
      event: payload.event,
      attempt: 1,
      success: result.success,
      statusCode: result.statusCode,
      error: result.error,
      responseTime: result.responseTime,
      timestamp: Date.now(),
      payload,
    });

    return result;
  }

  /**
   * Send webhook with automatic retries
   *
   * @param config - Webhook configuration
   * @param payload - Webhook payload
   * @returns Delivery result (from first attempt)
   */
  async sendWithRetry(
    config: WebhookConfig,
    payload: WebhookPayload
  ): Promise<WebhookDeliveryResult> {
    // Check if event is subscribed
    if (config.events && !config.events.includes(payload.event)) {
      return {
        success: false,
        error: 'Event not subscribed',
        responseTime: 0,
        attempts: 0,
        url: config.url,
        event: payload.event,
      };
    }

    // Generate signature
    const signature = this.signer.sign(payload, config.secret);

    // Send webhook
    const result = await this.sender.send(config.url, payload, signature, {
      timeout: config.timeout,
      headers: config.headers,
    });

    // Log delivery
    await this.logger.log({
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      url: config.url,
      event: payload.event,
      attempt: 1,
      success: result.success,
      statusCode: result.statusCode,
      error: result.error,
      responseTime: result.responseTime,
      timestamp: Date.now(),
      payload,
    });

    // If failed, queue for retry
    if (!result.success && config.retry) {
      const queued = createQueuedWebhook(config, payload);
      queued.attempts = 1; // First attempt already made
      queued.lastError = result.error;

      // Calculate next retry time
      const retryConfig = config.retry;
      const initialDelay = retryConfig.initialDelay || 100;
      queued.nextAttempt = Date.now() + initialDelay;

      await this.queue.enqueue(queued);

      if (this.config.debug) {
        console.log('[webhook-manager] Queued for retry:', {
          url: config.url,
          event: payload.event,
          nextAttempt: new Date(queued.nextAttempt).toISOString(),
        });
      }
    }

    return result;
  }

  /**
   * Send webhook asynchronously (fire and forget)
   *
   * @param config - Webhook configuration
   * @param payload - Webhook payload
   */
  sendAsync(config: WebhookConfig, payload: WebhookPayload): void {
    this.sendWithRetry(config, payload).catch((error) => {
      console.error('[webhook-manager] Async send failed:', error);
    });
  }

  /**
   * Get logger instance
   */
  getLogger(): IWebhookLogger {
    return this.logger;
  }

  /**
   * Get queue instance
   */
  getQueue(): IWebhookQueue {
    return this.queue;
  }

  /**
   * Close manager and cleanup resources
   */
  async close(): Promise<void> {
    // Stop queue processor
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }

    // Close queue
    await this.queue.close();

    if (this.config.debug) {
      console.log('[webhook-manager] Closed');
    }
  }

  /**
   * Start queue processor
   *
   * Periodically processes pending webhooks from queue
   */
  private startQueueProcessor(interval: number): void {
    this.processInterval = setInterval(async () => {
      await this.processQueue();
    }, interval);

    // Don't block process exit
    if (this.processInterval.unref) {
      this.processInterval.unref();
    }
  }

  /**
   * Process pending webhooks from queue
   */
  private async processQueue(): Promise<void> {
    try {
      // Process one webhook at a time
      const webhook = await this.queue.dequeue();
      if (!webhook) {
        return;
      }

      // Generate signature
      const signature = this.signer.sign(webhook.payload, webhook.config.secret);

      // Send webhook
      const result = await this.sender.send(
        webhook.config.url,
        webhook.payload,
        signature,
        {
          timeout: webhook.config.timeout,
          headers: webhook.config.headers,
        }
      );

      // Log delivery
      await this.logger.log({
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        url: webhook.config.url,
        event: webhook.payload.event,
        attempt: webhook.attempts + 1,
        success: result.success,
        statusCode: result.statusCode,
        error: result.error,
        responseTime: result.responseTime,
        timestamp: Date.now(),
        payload: webhook.payload,
      });

      // If failed, re-queue for retry
      if (!result.success) {
        await this.queue.retry(webhook, result.error);
      }
    } catch (error: any) {
      console.error('[webhook-manager] Queue processing error:', error.message);
    }
  }
}

/**
 * Create webhook manager
 *
 * @param config - Manager configuration
 * @returns Webhook manager instance
 *
 * @example
 * ```typescript
 * const manager = createWebhookManager({
 *   redis: { url: process.env.REDIS_URL },
 *   debug: true,
 * });
 * ```
 */
export function createWebhookManager(
  config?: WebhookManagerConfig
): WebhookManager {
  return new WebhookManager(config);
}