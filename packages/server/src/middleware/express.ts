/**
 * Express middleware for x402 payment verification
 * Implements payment-required responses for Express framework
 */

import { Request, Response, NextFunction } from 'express';
import { TransactionVerifier, PaymentRequirementsGenerator } from '@x402-solana/core';
import { X402Payment, PaymentReceipt } from '@x402-solana/core';
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
}

/**
 * Per-route middleware options
 */
export interface MiddlewareOptions {
  /** Resource identifier for payment requirements */
  resource?: string;

  /** Description of what payment is for */
  description?: string;

  /** Error message override */
  errorMessage?: string;

  /** Maximum payment age for this route (overrides global config) */
  maxPaymentAgeMs?: number;

  /** Timeout in seconds for payment to be valid */
  timeoutSeconds?: number;
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

    if (config.debug) {
      console.log('[x402] Middleware initialized:', {
        network: config.network,
        recipientWallet: config.recipientWallet,
        recipientUSDCAccount: this.generator.getRecipientUSDCAccount(),
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

        // 2. Decode payment header
        const payment = this.decodePaymentHeader(paymentHeader as string);

        if (this.config.debug) {
          console.log('[x402] Decoded payment:', {
            signature: payment.payload.signature,
            network: payment.network,
          });
        }

        // 3. Verify payment on Solana
        const maxAge = options?.maxPaymentAgeMs || this.config.maxPaymentAgeMs || 300_000;
        const result = await this.verifier.verifyPayment(
          payment.payload.signature,
          this.generator.getRecipientUSDCAccount(),
          priceUSD,
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

        // 4. Payment verified - attach to request
        req.payment = {
          signature: result.signature!,
          amount: (result.transfer?.amount || 0) / 1_000_000, // Convert to USD
          payer: result.transfer?.authority || '',
          blockTime: result.blockTime,
          slot: result.slot,
        };

        // 5. Add payment response header
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

        // 6. Continue to handler
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
   *
   * @param res - Express response
   * @param priceUSD - Price in USD
   * @param options - Middleware options
   */
  private send402(res: Response, priceUSD: number, options?: MiddlewareOptions): void {
    const requirements = this.generator.generate(priceUSD, {
      resource: options?.resource,
      description: options?.description,
      errorMessage: options?.errorMessage,
      timeoutSeconds: options?.timeoutSeconds,
    });

    res.status(402).json(requirements);
  }

  /**
   * Decode X-PAYMENT header
   *
   * @param header - Base64-encoded payment header
   * @returns Decoded payment object
   * @throws Error if header format is invalid
   */
  private decodePaymentHeader(header: string): X402Payment {
    try {
      const decoded = Buffer.from(header, 'base64').toString('utf-8');
      return JSON.parse(decoded);
    } catch (error) {
      throw new Error('Invalid X-PAYMENT header format');
    }
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
   * Close middleware and cleanup resources
   */
  async close(): Promise<void> {
    await this.verifier.close();
  }
}

/**
 * Extend Express Request interface to include payment info
 */
declare global {
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
