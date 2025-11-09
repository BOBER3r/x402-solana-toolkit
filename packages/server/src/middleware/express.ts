/**
 * Express middleware for x402 payment verification
 * Implements official x402 protocol for Express framework
 *
 * Compliant with: https://github.com/coinbase/x402
 */

import { Request, Response, NextFunction } from 'express';
import {
  TransactionVerifier,
  PaymentRequirementsGenerator,
  parseX402Payment,
} from '@x402-solana/core';
import { PaymentReceipt } from '@x402-solana/core';
import { SolanaNetwork } from '../config/network-config';

/**
 * Payment information attached to Express request
 */
export interface PaymentInfo {
  /** Transaction signature */
  signature: string;

  /** Amount paid in USD */
  amount: number;

  /** Payer wallet address */
  payer: string;

  /** Block time (Unix timestamp) */
  blockTime?: number;

  /** Slot number */
  slot?: number;
}

/**
 * Middleware configuration options
 */
export interface X402MiddlewareConfig {
  /** Solana RPC URL */
  solanaRpcUrl: string;

  /** Recipient wallet address */
  recipientWallet: string;

  /** Network (devnet or mainnet-beta) */
  network: SolanaNetwork;

  /** Redis configuration for replay attack prevention (optional) */
  redis?: {
    url: string;
  };

  /** Maximum payment age in milliseconds (default: 300000 = 5 minutes) */
  maxPaymentAgeMs?: number;

  /** Enable debug logging (default: false) */
  debug?: boolean;

  /** Webhook configuration (optional) */
  webhook?: {
    /** Enable webhook manager */
    enabled?: boolean;
    /** Queue processing interval in milliseconds (default: 1000) */
    processInterval?: number;
  };
}

/**
 * Per-route middleware options
 * Compliant with x402 protocol specification
 */
export interface MiddlewareOptions {
  /** Resource identifier for payment requirements (e.g., '/api/endpoint') */
  resource?: string;

  /** Description of what payment is for */
  description?: string;

  /** MIME type of the resource (default: 'application/json') */
  mimeType?: string;

  /** Optional JSON schema for response output */
  outputSchema?: object | null;

  /** Error message override */
  errorMessage?: string;

  /** Maximum payment age for this route (overrides global config) */
  maxPaymentAgeMs?: number;

  /** Timeout in seconds for payment to be valid */
  timeoutSeconds?: number;

  /** Optional additional data (scheme-specific) */
  extra?: object | null;

  /** Webhook URL to send payment notifications to */
  webhookUrl?: string;

  /** Webhook secret for HMAC signature generation */
  webhookSecret?: string;

  /** Webhook events to subscribe to (default: ['payment.confirmed']) */
  webhookEvents?: ('payment.confirmed' | 'payment.failed')[];

  /** Webhook retry configuration */
  webhookRetry?: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoff?: 'exponential' | 'linear';
  };

  /** Webhook timeout in milliseconds (default: 5000) */
  webhookTimeout?: number;

  /** Additional webhook headers */
  webhookHeaders?: Record<string, string>;
}

/**
 * Express middleware class for x402 payment verification
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { X402Middleware } from '@x402-solana/server';
 *
 * const app = express();
 * const x402 = new X402Middleware({
 *   solanaRpcUrl: 'https://api.devnet.solana.com',
 *   recipientWallet: 'YourWalletPublicKey...',
 *   network: 'devnet',
 * });
 *
 * app.get('/api/premium', x402.requirePayment(0.001), (req, res) => {
 *   console.log('Payment from:', req.payment?.payer);
 *   res.json({ data: 'premium content' });
 * });
 * ```
 */
export class X402Middleware {
  private verifier: TransactionVerifier;
  private generator: PaymentRequirementsGenerator;
  private config: X402MiddlewareConfig;
  private webhookManager: any; // WebhookManager (lazy loaded)

  /**
   * Create x402 middleware
   *
   * @param config - Middleware configuration
   */
  constructor(config: X402MiddlewareConfig) {
    this.config = config;

    this.verifier = new TransactionVerifier({
      rpcUrl: config.solanaRpcUrl,
      commitment: 'confirmed',
      cacheConfig: config.redis
        ? {
            redisUrl: config.redis.url,
            ttlSeconds: 600,
          }
        : { useInMemory: true },
    });

    this.generator = new PaymentRequirementsGenerator({
      recipientWallet: config.recipientWallet,
      network: config.network,
    });

    // Initialize webhook manager if enabled
    if (config.webhook?.enabled) {
      this.initializeWebhookManager();
    }

    if (config.debug) {
      console.log('[x402] Middleware initialized:', {
        network: config.network,
        recipientWallet: config.recipientWallet,
        recipientUSDCAccount: this.generator.getRecipientUSDCAccount(),
        webhookEnabled: !!config.webhook?.enabled,
      });
    }
  }

  /**
   * Middleware to require payment for a route
   *
   * @param priceUSD - Price in USD (e.g., 0.001 = $0.001)
   * @param options - Middleware options
   * @returns Express middleware function
   *
   * @example
   * ```typescript
   * app.get('/api/data',
   *   x402.requirePayment(0.001, {
   *     description: 'Access to premium data',
   *     resource: '/api/data',
   *   }),
   *   handler
   * );
   * ```
   */
  requirePayment(priceUSD: number, options?: MiddlewareOptions) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // 1. Check for X-PAYMENT header
        const paymentHeader = req.headers['x-payment'];

        if (this.config.debug) {
          console.log('[x402] Processing request:', {
            path: req.path,
            method: req.method,
            hasPayment: !!paymentHeader,
          });
        }

        if (!paymentHeader) {
          // No payment - return 402 with payment requirements
          if (this.config.debug) {
            console.log('[x402] No payment header, returning 402');
          }
          return this.send402(res, priceUSD, options);
        }

        // 2. Parse X-PAYMENT header using official x402 parser
        const parseResult = parseX402Payment(paymentHeader as string);

        if (!parseResult.success) {
          // Invalid header format - return 402 with error
          if (this.config.debug) {
            console.log('[x402] Invalid X-PAYMENT header:', parseResult.error);
          }
          return this.send402(res, priceUSD, {
            ...options,
            errorMessage: parseResult.error || 'Invalid payment header',
          });
        }

        const payment = parseResult.payment!;

        if (this.config.debug) {
          console.log('[x402] Parsed payment:', {
            scheme: payment.scheme,
            network: payment.network,
            hasSignature: !!payment.payload.signature,
            hasSerializedTx: !!payment.payload.serializedTransaction,
          });
        }

        // 3. Generate payment requirements for verification
        const paymentRequirements = this.generator.generate(priceUSD, {
          resource: options?.resource,
          description: options?.description,
          timeoutSeconds: options?.timeoutSeconds,
        });

        // Extract first payment accept option for verification
        const paymentAccept = paymentRequirements.accepts[0];

        // 4. Verify payment using x402-compliant method
        const maxAge = options?.maxPaymentAgeMs || this.config.maxPaymentAgeMs || 300_000;
        const result = await this.verifier.verifyX402Payment(
          paymentHeader as string,
          paymentAccept,
          {
            maxAgeMs: maxAge,
            commitment: 'confirmed',
          }
        );

        if (!result.valid) {
          // Invalid payment - return 402 with error
          if (this.config.debug) {
            console.log('[x402] Payment verification failed:', result.error);
          }
          return this.send402(res, priceUSD, {
            ...options,
            errorMessage: result.error || 'Payment verification failed',
          });
        }

        if (this.config.debug) {
          console.log('[x402] Payment verified successfully:', {
            signature: result.signature,
            amount: result.transfer?.amount,
            payer: result.transfer?.authority,
          });
        }

        // 5. Payment verified - attach to request
        req.payment = {
          signature: result.signature!,
          amount: (result.transfer?.amount || 0) / 1_000_000, // Convert to USD
          payer: result.transfer?.authority || '',
          blockTime: result.blockTime,
          slot: result.slot,
        };

        // 6. Add payment response header
        const receipt: PaymentReceipt = {
          signature: result.signature!,
          network: `solana-${this.config.network}`,
          amount: result.transfer?.amount || 0,
          timestamp: Date.now(),
          status: 'verified',
          blockTime: result.blockTime,
          slot: result.slot,
        };

        res.setHeader('X-PAYMENT-RESPONSE', this.encodePaymentResponse(receipt));

        // 7. Send webhook if configured
        if (options?.webhookUrl && options?.webhookSecret) {
          this.sendWebhookNotification(
            options,
            priceUSD,
            result,
            req.path
          ).catch((error) => {
            console.error('[x402] Webhook delivery failed:', error);
            // Don't fail the request if webhook fails
          });
        }

        // 8. Continue to handler
        next();
      } catch (error: any) {
        // Internal error during verification
        console.error('[x402] Payment verification error:', error);

        return res.status(500).json({
          error: 'Payment verification failed',
          message: this.config.debug ? error.message : 'Internal server error',
          code: 'VERIFICATION_ERROR',
        });
      }
    };
  }

  /**
   * Send 402 Payment Required response
   * Returns x402-compliant payment requirements
   *
   * @param res - Express response
   * @param priceUSD - Price in USD
   * @param options - Middleware options
   */
  private send402(res: Response, priceUSD: number, options?: MiddlewareOptions): void {
    const requirements = this.generator.generate(priceUSD, {
      resource: options?.resource,
      description: options?.description,
      mimeType: options?.mimeType,
      outputSchema: options?.outputSchema,
      errorMessage: options?.errorMessage,
      timeoutSeconds: options?.timeoutSeconds,
      extra: options?.extra,
    });

    res.status(402).json(requirements);
  }

  /**
   * Encode payment response as base64 JSON
   *
   * @param receipt - Payment receipt
   * @returns Base64-encoded receipt
   */
  private encodePaymentResponse(receipt: PaymentReceipt): string {
    return Buffer.from(JSON.stringify(receipt)).toString('base64');
  }

  /**
   * Get verifier instance for advanced usage
   *
   * @returns Transaction verifier
   */
  getVerifier(): TransactionVerifier {
    return this.verifier;
  }

  /**
   * Get generator instance for advanced usage
   *
   * @returns Payment requirements generator
   */
  getGenerator(): PaymentRequirementsGenerator {
    return this.generator;
  }

  /**
   * Initialize webhook manager (lazy load)
   */
  private initializeWebhookManager(): void {
    try {
      const { WebhookManager } = require('../webhooks/webhook-manager');
      this.webhookManager = new WebhookManager({
        redis: this.config.redis,
        debug: this.config.debug,
        queueProcessInterval: this.config.webhook?.processInterval,
      });
    } catch (error: any) {
      console.error('[x402] Failed to initialize webhook manager:', error.message);
    }
  }

  /**
   * Send webhook notification for payment
   */
  private async sendWebhookNotification(
    options: MiddlewareOptions,
    priceUSD: number,
    verificationResult: any,
    resource: string
  ): Promise<void> {
    if (!options.webhookUrl || !options.webhookSecret) {
      return;
    }

    // Lazy load webhook manager if not already loaded
    if (!this.webhookManager) {
      const { WebhookManager } = require('../webhooks/webhook-manager');
      this.webhookManager = new WebhookManager({
        redis: this.config.redis,
        debug: this.config.debug,
      });
    }

    const payload = {
      event: 'payment.confirmed' as const,
      timestamp: Date.now(),
      payment: {
        signature: verificationResult.signature || '',
        amount: verificationResult.transfer?.amount || 0,
        amountUSD: priceUSD,
        payer: verificationResult.transfer?.authority || '',
        recipient: this.config.recipientWallet,
        resource: options.resource || resource,
        blockTime: verificationResult.blockTime,
        slot: verificationResult.slot,
      },
    };

    const webhookConfig = {
      url: options.webhookUrl,
      secret: options.webhookSecret,
      events: options.webhookEvents || ['payment.confirmed' as const],
      retry: options.webhookRetry,
      timeout: options.webhookTimeout,
      headers: options.webhookHeaders,
    };

    await this.webhookManager.sendWithRetry(webhookConfig, payload);
  }

  /**
   * Get webhook manager instance (if enabled)
   */
  getWebhookManager(): any {
    return this.webhookManager;
  }

  /**
   * Close middleware and cleanup resources
   */
  async close(): Promise<void> {
    await this.verifier.close();

    if (this.webhookManager) {
      await this.webhookManager.close();
    }
  }
}

/**
 * Extend Express Request interface to include payment info
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      payment?: PaymentInfo;
    }
  }
}

/**
 * Factory function to create x402 middleware
 *
 * @param config - Middleware configuration
 * @returns X402 middleware instance
 *
 * @example
 * ```typescript
 * const x402 = createX402Middleware({
 *   solanaRpcUrl: process.env.SOLANA_RPC_URL,
 *   recipientWallet: process.env.RECIPIENT_WALLET,
 *   network: 'devnet',
 * });
 * ```
 */
export function createX402Middleware(config: X402MiddlewareConfig): X402Middleware {
  return new X402Middleware(config);
}
