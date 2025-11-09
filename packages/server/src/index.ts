/**
 * @x402-solana/server
 *
 * Server-side framework integrations for x402 payments on Solana
 *
 * This package provides production-grade middleware, guards, and plugins for
 * popular web frameworks (Express, NestJS, Fastify) to enable x402 payment
 * protocol on Solana.
 *
 * @example Express
 * ```typescript
 * import express from 'express';
 * import { X402Middleware } from '@x402-solana/server';
 *
 * const app = express();
 * const x402 = new X402Middleware({
 *   solanaRpcUrl: 'https://api.devnet.solana.com',
 *   recipientWallet: 'YourWalletAddress...',
 *   network: 'devnet',
 * });
 *
 * app.get('/api/premium',
 *   x402.requirePayment(0.001),
 *   (req, res) => {
 *     res.json({ data: 'premium', payment: req.payment });
 *   }
 * );
 * ```
 *
 * @example NestJS
 * ```typescript
 * import { Controller, Get, UseGuards } from '@nestjs/common';
 * import { X402Guard, RequirePayment } from '@x402-solana/server';
 *
 * @Controller('api')
 * @UseGuards(X402Guard)
 * export class ApiController {
 *   @Get('premium')
 *   @RequirePayment(0.001)
 *   getPremiumData() {
 *     return { data: 'premium' };
 *   }
 * }
 * ```
 *
 * @example Fastify
 * ```typescript
 * import Fastify from 'fastify';
 * import x402Plugin from '@x402-solana/server/fastify';
 *
 * const app = Fastify();
 * await app.register(x402Plugin, {
 *   solanaRpcUrl: 'https://api.devnet.solana.com',
 *   recipientWallet: 'YourWalletAddress...',
 *   network: 'devnet',
 * });
 *
 * app.get('/api/premium',
 *   { x402: { priceUSD: 0.001 } },
 *   async (request, reply) => {
 *     return { data: 'premium', payment: request.payment };
 *   }
 * );
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// Type Definitions
// ============================================================================

export * from './types';

// ============================================================================
// Express Middleware
// ============================================================================

export {
  X402Middleware,
  createX402Middleware,
  PaymentInfo as ExpressPaymentInfo,
  X402MiddlewareConfig as ExpressX402Config,
  MiddlewareOptions as ExpressMiddlewareOptions,
} from './middleware/express';

// ============================================================================
// NestJS Guard
// ============================================================================

export {
  X402Guard,
  RequirePayment,
  Payment,
  X402Module,
  X402Config as NestJSX402Config,
  X402PaymentInfo as NestJSPaymentInfo,
  X402RouteOptions as NestJSRouteOptions,
} from './middleware/nestjs';

// ============================================================================
// Fastify Plugin
// ============================================================================

export {
  default as x402FastifyPlugin,
  registerX402 as registerFastifyX402,
  X402FastifyOptions,
  FastifyRequestWithPayment,
  RoutePaymentOptions as FastifyRouteOptions,
} from './middleware/fastify';

// ============================================================================
// x402 Facilitator (Official Protocol Endpoints)
// ============================================================================

export {
  createFacilitatorRoutes,
  X402FacilitatorMiddleware,
  createFacilitatorMiddleware,
} from './facilitator';

// Re-export facilitator types from core
export type {
  VerifyRequest,
  VerifyResponse,
  SettleRequest,
  SettleResponse,
  SupportedResponse,
  SupportedPair,
} from '@x402-solana/core';

export { X402Facilitator } from '@x402-solana/core';
export type { FacilitatorConfig } from '@x402-solana/core';

// ============================================================================
// Utilities
// ============================================================================

export {
  decodePaymentHeader,
  isValidPaymentHeader,
  extractSignature,
  extractNetwork,
} from './utils';

// ============================================================================
// Re-export commonly used core types
// ============================================================================

export type {
  PaymentRequirements,
  PaymentAccept,
  X402Payment,
  PaymentPayload,
  PaymentReceipt,
  X402Error,
} from '@x402-solana/core';

export {
  X402ErrorCode,
  TransactionVerifier,
  PaymentRequirementsGenerator,
} from '@x402-solana/core';

// ============================================================================
// Webhook System
// ============================================================================

export * from './webhooks';

// ============================================================================
// Version
// ============================================================================

export const VERSION = '0.2.0';

// ============================================================================
// Quick Start Examples
// ============================================================================

/**
 * Quick start guide for Express
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { createX402Middleware } from '@x402-solana/server';
 *
 * const app = express();
 *
 * // Initialize middleware
 * const x402 = createX402Middleware({
 *   solanaRpcUrl: process.env.SOLANA_RPC_URL,
 *   recipientWallet: process.env.RECIPIENT_WALLET,
 *   network: 'devnet',
 *   redis: process.env.REDIS_URL ? { url: process.env.REDIS_URL } : undefined,
 * });
 *
 * // Protected route with payment requirement
 * app.get('/api/premium',
 *   x402.requirePayment(0.001, {
 *     description: 'Access to premium API',
 *     resource: '/api/premium',
 *   }),
 *   (req, res) => {
 *     console.log('Payment from:', req.payment.payer);
 *     res.json({ data: 'premium content' });
 *   }
 * );
 *
 * app.listen(3000);
 * ```
 */
export const EXPRESS_QUICK_START = null;

/**
 * Quick start guide for NestJS
 *
 * @example
 * ```typescript
 * // app.module.ts
 * import { Module } from '@nestjs/common';
 * import { X402Module } from '@x402-solana/server';
 *
 * @Module({
 *   imports: [
 *     X402Module.register({
 *       solanaRpcUrl: process.env.SOLANA_RPC_URL,
 *       recipientWallet: process.env.RECIPIENT_WALLET,
 *       network: 'devnet',
 *       redis: process.env.REDIS_URL ? { url: process.env.REDIS_URL } : undefined,
 *     }),
 *   ],
 * })
 * export class AppModule {}
 *
 * // api.controller.ts
 * import { Controller, Get, UseGuards } from '@nestjs/common';
 * import { X402Guard, RequirePayment, Payment } from '@x402-solana/server';
 *
 * @Controller('api')
 * @UseGuards(X402Guard)
 * export class ApiController {
 *   @Get('premium')
 *   @RequirePayment(0.001, {
 *     description: 'Access to premium API',
 *     resource: '/api/premium',
 *   })
 *   getPremiumData(@Payment() payment) {
 *     console.log('Payment from:', payment.payer);
 *     return { data: 'premium content' };
 *   }
 * }
 * ```
 */
export const NESTJS_QUICK_START = null;

/**
 * Quick start guide for Fastify
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { registerFastifyX402 } from '@x402-solana/server';
 *
 * const app = Fastify();
 *
 * // Register plugin
 * await registerFastifyX402(app, {
 *   solanaRpcUrl: process.env.SOLANA_RPC_URL,
 *   recipientWallet: process.env.RECIPIENT_WALLET,
 *   network: 'devnet',
 *   redis: process.env.REDIS_URL ? { url: process.env.REDIS_URL } : undefined,
 * });
 *
 * // Protected route with payment requirement
 * app.get('/api/premium',
 *   {
 *     x402: {
 *       priceUSD: 0.001,
 *       description: 'Access to premium API',
 *       resource: '/api/premium',
 *     },
 *   },
 *   async (request, reply) => {
 *     console.log('Payment from:', request.payment.payer);
 *     return { data: 'premium content' };
 *   }
 * );
 *
 * await app.listen({ port: 3000 });
 * ```
 */
export const FASTIFY_QUICK_START = null;
