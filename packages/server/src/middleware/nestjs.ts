/**
 * NestJS guard for x402 payment verification
 * Implements payment-required responses using NestJS decorators and guards
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TransactionVerifier, PaymentRequirementsGenerator } from '@x402-solana/core';
import { X402Payment, PaymentReceipt } from '@x402-solana/core';
import { SolanaNetwork } from '../config/network-config';

/**
 * Metadata key for payment requirement
 */
const X402_PRICE_KEY = 'x402:price';
const X402_OPTIONS_KEY = 'x402:options';

/**
 * Payment information attached to request
 */
export interface X402PaymentInfo {
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
 * x402 guard configuration
 */
export interface X402Config {
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
 * Per-route payment options
 */
export interface X402RouteOptions {
  /** Resource identifier for payment requirements */
  resource?: string;

  /** Description of what payment is for */
  description?: string;

  /** Maximum payment age for this route (overrides global config) */
  maxPaymentAgeMs?: number;

  /** Timeout in seconds for payment to be valid */
  timeoutSeconds?: number;
}

/**
 * NestJS guard for x402 payment verification
 *
 * @example
 * ```typescript
 * // app.module.ts
 * import { Module } from '@nestjs/common';
 * import { X402Guard, X402Module } from '@x402-solana/server';
 *
 * @Module({
 *   imports: [
 *     X402Module.register({
 *       solanaRpcUrl: 'https://api.devnet.solana.com',
 *       recipientWallet: 'YourWalletPublicKey...',
 *       network: 'devnet',
 *     }),
 *   ],
 * })
 * export class AppModule {}
 *
 * // controller.ts
 * import { Controller, Get, UseGuards } from '@nestjs/common';
 * import { RequirePayment, X402Guard } from '@x402-solana/server';
 *
 * @Controller('api')
 * @UseGuards(X402Guard)
 * export class ApiController {
 *   @Get('premium')
 *   @RequirePayment(0.001)
 *   getPremiumData() {
 *     return { data: 'premium content' };
 *   }
 * }
 * ```
 */
@Injectable()
export class X402Guard implements CanActivate {
  private verifier: TransactionVerifier;
  private generator: PaymentRequirementsGenerator;
  private config: X402Config;

  constructor(
    private reflector: Reflector,
    config: X402Config,
  ) {
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
      console.log('[x402] Guard initialized:', {
        network: config.network,
        recipientWallet: config.recipientWallet,
        recipientUSDCAccount: this.generator.getRecipientUSDCAccount(),
      });
    }
  }

  /**
   * CanActivate implementation
   * Checks payment and returns false (with 402 response) if payment is required but not provided
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get price from decorator metadata
    const price = this.reflector.get<number>(X402_PRICE_KEY, context.getHandler());

    if (!price) {
      // No price set - allow through
      return true;
    }

    // Get route-specific options
    const options = this.reflector.get<X402RouteOptions>(
      X402_OPTIONS_KEY,
      context.getHandler()
    );

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    try {
      // Check for X-PAYMENT header
      const paymentHeader = request.headers['x-payment'];

      if (this.config.debug) {
        console.log('[x402] Processing request:', {
          path: request.path,
          method: request.method,
          hasPayment: !!paymentHeader,
          price,
        });
      }

      if (!paymentHeader) {
        // No payment - send 402
        if (this.config.debug) {
          console.log('[x402] No payment header, returning 402');
        }
        this.send402(response, price, options);
        return false;
      }

      // Decode payment
      const payment = this.decodePaymentHeader(paymentHeader);

      if (this.config.debug) {
        console.log('[x402] Decoded payment:', {
          signature: payment.payload.signature,
          network: payment.network,
        });
      }

      // Verify payment
      const maxAge = options?.maxPaymentAgeMs || this.config.maxPaymentAgeMs || 300_000;
      const result = await this.verifier.verifyPayment(
        payment.payload.signature,
        this.generator.getRecipientUSDCAccount(),
        price,
        {
          maxAgeMs: maxAge,
          commitment: 'confirmed',
        }
      );

      if (!result.valid) {
        // Invalid payment - send 402 with error
        if (this.config.debug) {
          console.log('[x402] Payment verification failed:', result.error);
        }
        this.send402(response, price, options, result.error);
        return false;
      }

      if (this.config.debug) {
        console.log('[x402] Payment verified successfully:', {
          signature: result.signature,
          amount: result.transfer?.amount,
          payer: result.transfer?.authority,
        });
      }

      // Attach payment to request
      request.payment = {
        signature: result.signature!,
        amount: (result.transfer?.amount || 0) / 1_000_000,
        payer: result.transfer?.authority || '',
        blockTime: result.blockTime,
        slot: result.slot,
      };

      // Add payment response header
      const receipt: PaymentReceipt = {
        signature: result.signature!,
        network: `solana-${this.config.network}`,
        amount: result.transfer?.amount || 0,
        timestamp: Date.now(),
        status: 'verified',
        blockTime: result.blockTime,
        slot: result.slot,
      };

      response.setHeader('X-PAYMENT-RESPONSE', this.encodePaymentResponse(receipt));

      return true;
    } catch (error: any) {
      console.error('[x402] Payment verification error:', error);

      throw new HttpException(
        {
          error: 'Payment verification failed',
          message: this.config.debug ? error.message : 'Internal server error',
          code: 'VERIFICATION_ERROR',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Send 402 Payment Required response
   */
  private send402(
    response: any,
    price: number,
    options?: X402RouteOptions,
    error?: string
  ): void {
    const requirements = this.generator.generate(price, {
      resource: options?.resource,
      description: options?.description,
      errorMessage: error || 'Payment Required',
      timeoutSeconds: options?.timeoutSeconds,
    });

    response.status(402).json(requirements);
  }

  /**
   * Decode X-PAYMENT header
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
   * Encode payment response
   */
  private encodePaymentResponse(receipt: PaymentReceipt): string {
    return Buffer.from(JSON.stringify(receipt)).toString('base64');
  }

  /**
   * Close guard and cleanup resources
   */
  async onModuleDestroy(): Promise<void> {
    await this.verifier.close();
  }
}

/**
 * Decorator to require payment for a route
 *
 * @param priceUSD - Price in USD (e.g., 0.001 = $0.001)
 * @param options - Route-specific options
 *
 * @example
 * ```typescript
 * @Get('premium')
 * @RequirePayment(0.001, {
 *   description: 'Access to premium data',
 *   resource: '/api/premium',
 * })
 * getPremiumData() {
 *   return { data: 'premium content' };
 * }
 * ```
 */
export function RequirePayment(
  priceUSD: number,
  options?: X402RouteOptions
): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    SetMetadata(X402_PRICE_KEY, priceUSD)(target, propertyKey, descriptor);
    if (options) {
      SetMetadata(X402_OPTIONS_KEY, options)(target, propertyKey, descriptor);
    }
  };
}

/**
 * Parameter decorator to inject payment info into route handler
 *
 * @example
 * ```typescript
 * @Get('premium')
 * @RequirePayment(0.001)
 * getPremiumData(@Payment() payment: X402PaymentInfo) {
 *   console.log('Paid by:', payment.payer);
 *   return { data: 'premium content' };
 * }
 * ```
 */
export function Payment() {
  return (target: any, propertyKey: string | symbol, parameterIndex: number) => {
    // This is handled by NestJS parameter decorator system
    const existingMetadata =
      Reflect.getMetadata('x402:payment_params', target.constructor) || [];
    existingMetadata.push({ index: parameterIndex, propertyKey });
    Reflect.defineMetadata('x402:payment_params', existingMetadata, target.constructor);
  };
}

/**
 * NestJS dynamic module for x402
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     X402Module.register({
 *       solanaRpcUrl: process.env.SOLANA_RPC_URL,
 *       recipientWallet: process.env.RECIPIENT_WALLET,
 *       network: 'devnet',
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
export class X402Module {
  static register(config: X402Config) {
    return {
      module: X402Module,
      providers: [
        {
          provide: X402Guard,
          useFactory: (reflector: Reflector) => {
            return new X402Guard(reflector, config);
          },
          inject: [Reflector],
        },
      ],
      exports: [X402Guard],
    };
  }
}

/**
 * Type declaration for request with payment
 */
declare module 'http' {
  interface IncomingMessage {
    payment?: X402PaymentInfo;
  }
}
