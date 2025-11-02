/**
 * Fastify plugin for x402 payment verification
 * Implements payment-required responses using Fastify hooks and decorators
 */

import { FastifyInstance, FastifyRequest, FastifyReply, FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import {
  TransactionVerifier,
  PaymentRequirementsGenerator,
  VerifierConfig,
  GeneratorConfig,
  microUSDCToUSD,
  encodePaymentReceipt,
  generatePaymentReceipt,
  createErrorResponse,
} from '@x402-solana/core';
import { X402Config, MiddlewareOptions, PaymentInfo } from '../types';
import { decodePaymentHeader } from '../utils';

/**
 * Fastify x402 plugin options
 */
export interface X402FastifyOptions extends X402Config {
  /** Global payment requirement (optional) */
  defaultPriceUSD?: number;
}

/**
 * Extended Fastify request with payment information
 */
export interface FastifyRequestWithPayment extends FastifyRequest {
  payment?: PaymentInfo;
}

/**
 * Route-specific payment options
 */
export interface RoutePaymentOptions extends MiddlewareOptions {
  /** Price in USD for this route */
  priceUSD: number;
}

/**
 * Fastify plugin for x402 payment verification
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import x402Plugin from '@x402-solana/server/fastify';
 *
 * const app = Fastify();
 *
 * await app.register(x402Plugin, {
 *   solanaRpcUrl: 'https://api.devnet.solana.com',
 *   recipientWallet: 'YourWalletAddress...',
 *   network: 'devnet',
 * });
 *
 * app.get('/api/premium',
 *   { x402: { priceUSD: 0.001, description: 'Premium data' } },
 *   async (request, reply) => {
 *     return { data: 'premium content', payment: request.payment };
 *   }
 * );
 * ```
 */
const x402Plugin: FastifyPluginCallback<X402FastifyOptions> = async (
  fastify: FastifyInstance,
  options: X402FastifyOptions
) => {
  const network = options.network;

  // Initialize verifier
  const verifierConfig: VerifierConfig = {
    rpcUrl: options.solanaRpcUrl,
    commitment: options.commitment || 'confirmed',
    maxRetries: options.maxRetries,
    retryDelayMs: options.retryDelayMs,
    cacheConfig: options.redis
      ? {
          redisUrl: options.redis.url,
          ttlSeconds: 600,
        }
      : {
          useInMemory: true,
          ttlSeconds: 600,
        },
  };

  const verifier = new TransactionVerifier(verifierConfig);

  // Initialize generator
  const generatorConfig: GeneratorConfig = {
    recipientWallet: options.recipientWallet,
    network: options.network,
  };

  const generator = new PaymentRequirementsGenerator(generatorConfig);

  // Add cleanup hook
  fastify.addHook('onClose', async () => {
    await verifier.close();
  });

  /**
   * Helper function to verify payment
   */
  async function verifyPayment(
    request: FastifyRequest,
    reply: FastifyReply,
    priceUSD: number,
    opts: MiddlewareOptions = {}
  ): Promise<boolean> {
    try {
      // 1. Check X-PAYMENT header
      const paymentHeader = request.headers['x-payment'] as string;

      if (!paymentHeader) {
        // No payment provided - return 402 with requirements
        const requirements = generator.generate(priceUSD, {
          description: opts.description || 'Payment required for access',
          resource: opts.resource || request.url,
          timeoutSeconds: opts.timeoutSeconds,
          errorMessage: opts.errorMessage,
        });

        reply.status(402).send(requirements);
        return false;
      }

      // 2. Decode payment header
      let payment;
      try {
        payment = decodePaymentHeader(paymentHeader);
      } catch (error: any) {
        // Invalid header format - return 402 with error
        const requirements = generator.generate(priceUSD, {
          description: opts.description || 'Payment required for access',
          resource: opts.resource || request.url,
          errorMessage: `Invalid payment header: ${error.message}`,
        });

        reply.status(402).send(requirements);
        return false;
      }

      // 3. Verify payment using TransactionVerifier
      const result = await verifier.verifyPayment(
        payment.payload.signature,
        generator.getRecipientUSDCAccount(),
        priceUSD,
        {
          maxAgeMs: opts.timeoutSeconds ? opts.timeoutSeconds * 1000 : 300_000,
          skipCacheCheck: opts.skipCacheCheck,
          commitment: 'confirmed',
        }
      );

      if (!result.valid) {
        // Payment verification failed - return 402 with error
        const errorResponse = createErrorResponse(result);

        const requirements = generator.generate(priceUSD, {
          description: opts.description || 'Payment required for access',
          resource: opts.resource || request.url,
          errorMessage: errorResponse.message,
        });

        reply.status(402).send({
          ...requirements,
          verificationError: errorResponse,
        });
        return false;
      }

      // 4. Attach payment info to request
      const paymentInfo: PaymentInfo = {
        signature: result.signature!,
        amountUSD: microUSDCToUSD(result.transfer!.amount),
        payer: result.transfer!.authority,
        blockTime: result.blockTime,
        slot: result.slot,
      };

      (request as any).payment = paymentInfo;

      // 5. Generate and attach receipt header
      const receipt = generatePaymentReceipt(result, network, {
        includeDetails: true,
      });

      const encodedReceipt = encodePaymentReceipt(receipt);
      reply.header('X-PAYMENT-RESPONSE', encodedReceipt);

      return true;
    } catch (error: any) {
      // Internal error - return 500
      fastify.log.error('Payment verification error:', error);
      reply.status(500).send({
        error: 'Payment verification failed',
        message: error.message,
      });
      return false;
    }
  }

  // Add preHandler hook for routes with x402 options
  fastify.addHook('preHandler', async (request, reply) => {
    const routeConfig = (request.routeConfig as any)?.x402 as RoutePaymentOptions | undefined;

    if (routeConfig && routeConfig.priceUSD) {
      const verified = await verifyPayment(request, reply, routeConfig.priceUSD, routeConfig);

      if (!verified) {
        // Payment verification failed or not provided
        // Reply already sent by verifyPayment
        return;
      }
    }
  });

  // Decorate Fastify instance with helper methods
  fastify.decorate('requirePayment', function (
    priceUSD: number,
    opts: MiddlewareOptions = {}
  ) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      return verifyPayment(request, reply, priceUSD, opts);
    };
  });

  fastify.decorate('x402', {
    verifier,
    generator,
    getRecipientUSDCAccount: () => generator.getRecipientUSDCAccount(),
    getRecipientWallet: () => generator.getRecipientWallet(),
  });
};

/**
 * Export plugin wrapped with fastify-plugin for proper encapsulation
 */
export default fp(x402Plugin, {
  fastify: '4.x',
  name: '@x402-solana/fastify',
});

/**
 * Extend Fastify types
 */
declare module 'fastify' {
  interface FastifyInstance {
    requirePayment(
      priceUSD: number,
      opts?: MiddlewareOptions
    ): (request: FastifyRequest, reply: FastifyReply) => Promise<boolean>;

    x402: {
      verifier: TransactionVerifier;
      generator: PaymentRequirementsGenerator;
      getRecipientUSDCAccount(): string;
      getRecipientWallet(): string;
    };
  }

  interface FastifyRequest {
    payment?: PaymentInfo;
  }

  interface RouteShorthandOptions {
    x402?: RoutePaymentOptions;
  }
}

/**
 * Factory function to create and register x402 plugin
 *
 * @param fastify - Fastify instance
 * @param options - Plugin options
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { registerX402 } from '@x402-solana/server/fastify';
 *
 * const app = Fastify();
 * await registerX402(app, {
 *   solanaRpcUrl: process.env.SOLANA_RPC_URL,
 *   recipientWallet: process.env.RECIPIENT_WALLET,
 *   network: 'devnet',
 * });
 * ```
 */
export async function registerX402(
  fastify: FastifyInstance,
  options: X402FastifyOptions
): Promise<void> {
  await fastify.register(x402Plugin, options);
}
