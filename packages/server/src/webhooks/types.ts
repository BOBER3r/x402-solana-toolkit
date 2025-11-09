/**
 * Webhook types and interfaces for x402-solana-toolkit
 *
 * Defines the webhook system architecture for async payment notifications
 */

/**
 * Webhook events that can be sent
 */
export type WebhookEvent = 'payment.confirmed' | 'payment.failed';

/**
 * Retry backoff strategy
 */
export type BackoffStrategy = 'exponential' | 'linear';

/**
 * Webhook retry configuration
 */
export interface WebhookRetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;

  /** Initial delay in milliseconds (default: 100) */
  initialDelay?: number;

  /** Maximum delay between retries in milliseconds (default: 60000) */
  maxDelay?: number;

  /** Backoff strategy (default: 'exponential') */
  backoff?: BackoffStrategy;
}

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  /** Webhook URL to send notifications to */
  url: string;

  /** Secret for HMAC signature generation */
  secret: string;

  /** Events to subscribe to (default: all events) */
  events?: WebhookEvent[];

  /** Retry configuration */
  retry?: WebhookRetryConfig;

  /** Request timeout in milliseconds (default: 5000) */
  timeout?: number;

  /** Additional headers to include in webhook requests */
  headers?: Record<string, string>;
}

/**
 * Payment information in webhook payload
 */
export interface WebhookPaymentData {
  /** Transaction signature */
  signature: string;

  /** Amount in micro-USDC (6 decimals) */
  amount: number;

  /** Amount in USD */
  amountUSD: number;

  /** Payer wallet address */
  payer: string;

  /** Recipient wallet address */
  recipient: string;

  /** Resource/endpoint that required payment */
  resource: string;

  /** Block timestamp (Unix) */
  blockTime?: number;

  /** Slot number */
  slot?: number;
}

/**
 * Webhook payload structure
 */
export interface WebhookPayload {
  /** Event type */
  event: WebhookEvent;

  /** Event timestamp (Unix milliseconds) */
  timestamp: number;

  /** Payment data */
  payment: WebhookPaymentData;

  /** Optional metadata */
  metadata?: Record<string, any>;
}

/**
 * Webhook delivery result
 */
export interface WebhookDeliveryResult {
  /** Whether delivery was successful */
  success: boolean;

  /** HTTP status code (if request was sent) */
  statusCode?: number;

  /** Error message (if delivery failed) */
  error?: string;

  /** Response time in milliseconds */
  responseTime: number;

  /** Number of attempts made */
  attempts: number;

  /** Webhook URL (for logging) */
  url: string;

  /** Event that was sent */
  event: WebhookEvent;
}

/**
 * Queued webhook for retry processing
 */
export interface QueuedWebhook {
  /** Unique identifier */
  id: string;

  /** Webhook configuration */
  config: WebhookConfig;

  /** Payload to send */
  payload: WebhookPayload;

  /** Number of delivery attempts made */
  attempts: number;

  /** Timestamp for next retry attempt (Unix milliseconds) */
  nextAttempt: number;

  /** Creation timestamp (Unix milliseconds) */
  createdAt: number;

  /** Last error message (if any) */
  lastError?: string;
}

/**
 * Webhook send options
 */
export interface WebhookSendOptions {
  /** Request timeout in milliseconds */
  timeout?: number;

  /** Additional headers */
  headers?: Record<string, string>;

  /** Whether to follow redirects (default: false) */
  followRedirects?: boolean;
}

/**
 * Webhook manager configuration
 */
export interface WebhookManagerConfig {
  /** Redis configuration for persistent queue */
  redis?: {
    url: string;
    keyPrefix?: string;
  };

  /** Default request timeout in milliseconds */
  defaultTimeout?: number;

  /** Enable debug logging */
  debug?: boolean;

  /** Queue processing interval in milliseconds (default: 1000) */
  queueProcessInterval?: number;
}

/**
 * Webhook delivery log entry
 */
export interface WebhookLogEntry {
  /** Log entry ID */
  id: string;

  /** Webhook URL */
  url: string;

  /** Event type */
  event: WebhookEvent;

  /** Delivery attempt number */
  attempt: number;

  /** Success status */
  success: boolean;

  /** HTTP status code */
  statusCode?: number;

  /** Error message */
  error?: string;

  /** Response time in milliseconds */
  responseTime: number;

  /** Timestamp (Unix milliseconds) */
  timestamp: number;

  /** Request payload */
  payload: WebhookPayload;
}

/**
 * Webhook signer interface
 */
export interface IWebhookSigner {
  /**
   * Generate HMAC signature for payload
   */
  sign(payload: any, secret: string): string;

  /**
   * Verify HMAC signature
   */
  verify(payload: any, signature: string, secret: string): boolean;
}

/**
 * Webhook sender interface
 */
export interface IWebhookSender {
  /**
   * Send webhook HTTP request
   */
  send(
    url: string,
    payload: WebhookPayload,
    signature: string,
    options?: WebhookSendOptions
  ): Promise<WebhookDeliveryResult>;
}

/**
 * Webhook queue interface
 */
export interface IWebhookQueue {
  /**
   * Add webhook to queue
   */
  enqueue(webhook: QueuedWebhook): Promise<void>;

  /**
   * Get next webhook from queue
   */
  dequeue(): Promise<QueuedWebhook | null>;

  /**
   * Re-queue webhook for retry
   */
  retry(webhook: QueuedWebhook, error?: string): Promise<void>;

  /**
   * Remove webhook from queue
   */
  remove(id: string): Promise<void>;

  /**
   * Get queue size
   */
  size(): Promise<number>;

  /**
   * Process all pending webhooks
   */
  processQueue(): Promise<void>;

  /**
   * Close queue and cleanup resources
   */
  close(): Promise<void>;
}

/**
 * Webhook logger interface
 */
export interface IWebhookLogger {
  /**
   * Log webhook delivery attempt
   */
  log(entry: WebhookLogEntry): Promise<void>;

  /**
   * Get recent log entries
   */
  getRecent(limit?: number): Promise<WebhookLogEntry[]>;

  /**
   * Get logs for specific webhook URL
   */
  getByUrl(url: string, limit?: number): Promise<WebhookLogEntry[]>;
}
