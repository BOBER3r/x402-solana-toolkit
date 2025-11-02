/**
 * Retry handler with exponential backoff
 * For handling transient RPC failures
 */

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries?: number;

  /** Base delay in milliseconds (default: 100) */
  baseDelayMs?: number;

  /** Maximum delay in milliseconds (default: 10000) */
  maxDelayMs?: number;

  /** Exponential backoff multiplier (default: 2) */
  backoffMultiplier?: number;

  /** Jitter to add to delay (0-1, default: 0.1 = 10%) */
  jitter?: number;

  /** Function to determine if error is retryable */
  isRetryable?: (error: any) => boolean;

  /** Callback called on each retry */
  onRetry?: (attempt: number, error: any, delayMs: number) => void;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitter: 0.1,
  isRetryable: () => true,
  onRetry: () => {},
};

/**
 * Execute a function with exponential backoff retry
 *
 * @param fn - Async function to execute
 * @param config - Retry configuration
 * @returns Result of the function
 * @throws Last error if all retries fail
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   async () => connection.getTransaction(signature),
 *   { maxRetries: 3, baseDelayMs: 100 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: any;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt >= cfg.maxRetries || !cfg.isRetryable(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const baseDelay = cfg.baseDelayMs * Math.pow(cfg.backoffMultiplier, attempt);
      const jitterAmount = baseDelay * cfg.jitter * (Math.random() * 2 - 1); // Random jitter: -10% to +10%
      const delayMs = Math.min(baseDelay + jitterAmount, cfg.maxDelayMs);

      // Call retry callback
      cfg.onRetry(attempt + 1, error, delayMs);

      // Wait before retry
      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * Sleep for a specified duration
 *
 * @param ms - Duration in milliseconds
 * @returns Promise that resolves after delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is a network error (should be retried)
 *
 * @param error - Error object
 * @returns Whether error is retryable
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false;

  // Check error message for common network errors
  const message = error.message?.toLowerCase() || '';

  const networkErrorPatterns = [
    'network',
    'timeout',
    'econnrefused',
    'enotfound',
    'etimedout',
    'socket',
    'fetch failed',
    '429', // Rate limit
    '502', // Bad gateway
    '503', // Service unavailable
    '504', // Gateway timeout
  ];

  return networkErrorPatterns.some(pattern => message.includes(pattern));
}

/**
 * Check if error is an RPC error (should be retried)
 *
 * @param error - Error object
 * @returns Whether error is retryable
 */
export function isRPCError(error: any): boolean {
  if (!error) return false;

  // Check for Solana RPC specific errors
  const message = error.message?.toLowerCase() || '';

  const rpcErrorPatterns = [
    'node is behind',
    'node is unhealthy',
    'transaction not found', // Might not be propagated yet
    'blockhash not found',
    'internal error',
    'server error',
  ];

  return rpcErrorPatterns.some(pattern => message.includes(pattern));
}

/**
 * Default retryable error checker for Solana operations
 *
 * @param error - Error object
 * @returns Whether error should be retried
 */
export function isRetryableError(error: any): boolean {
  return isNetworkError(error) || isRPCError(error);
}

/**
 * Retry configuration for transaction fetching
 */
export const TRANSACTION_FETCH_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 1000,
  backoffMultiplier: 2,
  jitter: 0.1,
  isRetryable: isRetryableError,
};

/**
 * Retry configuration for transaction confirmation
 */
export const TRANSACTION_CONFIRM_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelayMs: 200,
  maxDelayMs: 2000,
  backoffMultiplier: 2,
  jitter: 0.1,
  isRetryable: isRetryableError,
};

/**
 * Create a retry handler with custom configuration
 *
 * @param config - Retry configuration
 * @returns Retry function with bound configuration
 *
 * @example
 * ```typescript
 * const retry = createRetryHandler({ maxRetries: 5 });
 * const result = await retry(() => someAsyncOperation());
 * ```
 */
export function createRetryHandler(config: RetryConfig = {}) {
  return <T>(fn: () => Promise<T>) => withRetry(fn, config);
}

/**
 * Batch retry multiple operations with the same configuration
 *
 * @param operations - Array of async operations
 * @param config - Retry configuration
 * @returns Array of results
 *
 * @example
 * ```typescript
 * const results = await batchRetry([
 *   () => operation1(),
 *   () => operation2(),
 *   () => operation3(),
 * ], { maxRetries: 3 });
 * ```
 */
export async function batchRetry<T>(
  operations: Array<() => Promise<T>>,
  config: RetryConfig = {}
): Promise<T[]> {
  return Promise.all(operations.map(op => withRetry(op, config)));
}

/**
 * Execute operations with retry sequentially (one after another)
 *
 * @param operations - Array of async operations
 * @param config - Retry configuration
 * @returns Array of results
 */
export async function sequentialRetry<T>(
  operations: Array<() => Promise<T>>,
  config: RetryConfig = {}
): Promise<T[]> {
  const results: T[] = [];

  for (const operation of operations) {
    const result = await withRetry(operation, config);
    results.push(result);
  }

  return results;
}

/**
 * Timeout wrapper with retry
 * Fails the operation if it takes too long
 *
 * @param fn - Async function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param config - Retry configuration
 * @returns Result of the function
 * @throws Error if operation times out
 */
export async function withRetryAndTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  config: RetryConfig = {}
): Promise<T> {
  return withRetry(async () => {
    return Promise.race([
      fn(),
      sleep(timeoutMs).then(() => {
        throw new Error(`Operation timed out after ${timeoutMs}ms`);
      }),
    ]);
  }, config);
}
