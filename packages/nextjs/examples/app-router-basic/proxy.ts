/**
 * Next.js 16+ Proxy Example
 *
 * In Next.js 16, middleware.ts is deprecated in favor of proxy.ts
 * This file shows how to use x402 with Next.js 16+ proxy pattern.
 *
 * Note: Proxies in Next.js 16 use Node.js runtime (not Edge runtime)
 */

import { x402Middleware, createMatcher } from '@x402-solana/nextjs';

// Create x402 proxy
export const proxy = x402Middleware({
  solanaRpcUrl: process.env.SOLANA_RPC_URL!,
  recipientWallet: process.env.RECIPIENT_WALLET!,
  network: 'devnet',
  protectedRoutes: [
    '/api/premium/*',
    '/api/private/*',
  ],
  debug: true,
  maxPaymentAgeMs: 300_000, // 5 minutes
  redis: process.env.REDIS_URL
    ? {
        url: process.env.REDIS_URL,
      }
    : undefined,
});

// Export matcher config
export const config = createMatcher([
  '/api/premium/:path*',
  '/api/private/:path*',
]);
