/**
 * Webhook delivery logger
 *
 * Tracks webhook delivery attempts for debugging and monitoring
 */

import { randomBytes } from 'crypto';
import { IWebhookLogger, WebhookLogEntry } from './types';

/**
 * In-memory webhook logger
 *
 * @example
 * ```typescript
 * const logger = new WebhookLogger({ maxEntries: 1000 });
 *
 * await logger.log({
 *   id: '123',
 *   url: 'https://example.com/webhook',
 *   event: 'payment.confirmed',
 *   attempt: 1,
 *   success: true,
 *   statusCode: 200,
 *   responseTime: 150,
 *   timestamp: Date.now(),
 *   payload: { ... },
 * });
 *
 * const recent = await logger.getRecent(10);
 * ```
 */
export class WebhookLogger implements IWebhookLogger {
  private entries: WebhookLogEntry[] = [];
  private readonly maxEntries: number;
  private readonly debug: boolean;

  constructor(config?: { maxEntries?: number; debug?: boolean }) {
    this.maxEntries = config?.maxEntries || 1000;
    this.debug = config?.debug || false;
  }

  /**
   * Log webhook delivery attempt
   *
   * @param entry - Log entry
   */
  async log(entry: WebhookLogEntry): Promise<void> {
    // Ensure entry has an ID
    if (!entry.id) {
      entry.id = this.generateId();
    }

    // Add to in-memory storage
    this.entries.push(entry);

    // Trim if exceeds max size
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    // Console logging
    if (this.debug || !entry.success) {
      this.logToConsole(entry);
    }
  }

  /**
   * Get recent log entries
   *
   * @param limit - Number of entries to return
   * @returns Log entries (newest first)
   */
  async getRecent(limit: number = 100): Promise<WebhookLogEntry[]> {
    const start = Math.max(0, this.entries.length - limit);
    return this.entries.slice(start).reverse();
  }

  /**
   * Get logs for specific webhook URL
   *
   * @param url - Webhook URL
   * @param limit - Number of entries to return
   * @returns Log entries for URL (newest first)
   */
  async getByUrl(url: string, limit: number = 100): Promise<WebhookLogEntry[]> {
    const filtered = this.entries.filter((entry) => entry.url === url);
    const start = Math.max(0, filtered.length - limit);
    return filtered.slice(start).reverse();
  }

  /**
   * Get success rate for webhook URL
   *
   * @param url - Webhook URL
   * @param since - Timestamp to calculate from (default: all time)
   * @returns Success rate (0-1)
   */
  async getSuccessRate(url: string, since?: number): Promise<number> {
    let entries = this.entries.filter((entry) => entry.url === url);

    if (since) {
      entries = entries.filter((entry) => entry.timestamp >= since);
    }

    if (entries.length === 0) {
      return 0;
    }

    const successCount = entries.filter((entry) => entry.success).length;
    return successCount / entries.length;
  }

  /**
   * Get average response time for webhook URL
   *
   * @param url - Webhook URL
   * @param since - Timestamp to calculate from (default: all time)
   * @returns Average response time in milliseconds
   */
  async getAverageResponseTime(url: string, since?: number): Promise<number> {
    let entries = this.entries.filter(
      (entry) => entry.url === url && entry.success
    );

    if (since) {
      entries = entries.filter((entry) => entry.timestamp >= since);
    }

    if (entries.length === 0) {
      return 0;
    }

    const totalTime = entries.reduce(
      (sum, entry) => sum + entry.responseTime,
      0
    );
    return totalTime / entries.length;
  }

  /**
   * Clear all log entries
   */
  async clear(): Promise<void> {
    this.entries = [];
  }

  /**
   * Clear old entries older than timestamp
   *
   * @param before - Timestamp to clear before
   */
  async clearBefore(before: number): Promise<void> {
    this.entries = this.entries.filter((entry) => entry.timestamp >= before);
  }

  /**
   * Get total number of log entries
   */
  size(): number {
    return this.entries.length;
  }

  /**
   * Log entry to console
   */
  private logToConsole(entry: WebhookLogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const status = entry.success
      ? `SUCCESS (${entry.statusCode})`
      : `FAILED (${entry.error})`;

    console.log(
      `[webhook-log] ${timestamp} | ${entry.event} | ${entry.url} | Attempt ${entry.attempt} | ${status} | ${entry.responseTime}ms`
    );
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `log_${Date.now()}_${randomBytes(4).toString('hex')}`;
  }
}

/**
 * File-based webhook logger (optional)
 *
 * Writes log entries to file for persistent storage
 */
export class FileWebhookLogger extends WebhookLogger {
  private readonly logFile: string;
  private writeQueue: WebhookLogEntry[] = [];
  private writeInterval: NodeJS.Timeout | null = null;

  constructor(config: {
    logFile: string;
    maxEntries?: number;
    debug?: boolean;
    flushInterval?: number;
  }) {
    super(config);
    this.logFile = config.logFile;

    // Start periodic flush
    const flushInterval = config.flushInterval || 5000;
    this.writeInterval = setInterval(() => {
      this.flush();
    }, flushInterval);
  }

  /**
   * Log webhook delivery attempt
   */
  async log(entry: WebhookLogEntry): Promise<void> {
    await super.log(entry);

    // Add to write queue
    this.writeQueue.push(entry);
  }

  /**
   * Flush write queue to file
   */
  private async flush(): Promise<void> {
    if (this.writeQueue.length === 0) {
      return;
    }

    const fs = await import('fs/promises');
    const entries = [...this.writeQueue];
    this.writeQueue = [];

    try {
      const lines = entries.map((entry) => JSON.stringify(entry)).join('\n');
      await fs.appendFile(this.logFile, lines + '\n');
    } catch (error: any) {
      console.error('[webhook-logger] Failed to write to log file:', error.message);
      // Re-add entries to queue
      this.writeQueue.unshift(...entries);
    }
  }

  /**
   * Close logger and flush remaining entries
   */
  async close(): Promise<void> {
    if (this.writeInterval) {
      clearInterval(this.writeInterval);
      this.writeInterval = null;
    }

    await this.flush();
  }
}

/**
 * Create webhook logger
 *
 * @param config - Logger configuration
 * @returns Webhook logger instance
 */
export function createWebhookLogger(config?: {
  maxEntries?: number;
  debug?: boolean;
  logFile?: string;
  flushInterval?: number;
}): IWebhookLogger {
  if (config?.logFile) {
    return new FileWebhookLogger({
      logFile: config.logFile,
      maxEntries: config.maxEntries,
      debug: config.debug,
      flushInterval: config.flushInterval,
    });
  }

  return new WebhookLogger(config);
}