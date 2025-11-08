/**
 * Fastify x402 API Example - Server
 * Shows how to use x402 plugin with Fastify route options
 */

import Fastify from 'fastify';
import { x402FastifyPlugin } from '@x402-solana/server';
import dotenv from 'dotenv';

dotenv.config();

const app = Fastify({
  logger: true,
});

// Register x402 plugin
await app.register(x402FastifyPlugin, {
  solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  recipientWallet: process.env.RECIPIENT_WALLET!,
  network: 'devnet',
  debug: true,
});

// ============================================================================
// FREE ENDPOINT - No payment required
// ============================================================================

app.get('/api/hello', async (request, reply) => {
  return {
    message: 'Hello! This endpoint is free.',
    timestamp: new Date().toISOString(),
  };
});

// ============================================================================
// PAID ENDPOINT - $0.001 required
// Use x402 route option to specify payment
// ============================================================================

app.get('/api/premium',
  {
    x402: {
      priceUSD: 0.001,
      description: 'Access to premium data',
      resource: '/api/premium',
    },
  },
  async (request, reply) => {
    return {
      message: 'Premium content! You paid for this.',
      tier: 'premium',
      paidBy: request.payment?.payer,
      amount: `$${request.payment?.amountUSD}`,
      signature: request.payment?.signature,
      timestamp: new Date().toISOString(),
    };
  }
);

// ============================================================================
// PAID ENDPOINT - $0.005 required
// Higher tier pricing example
// ============================================================================

app.get('/api/analytics',
  {
    x402: {
      priceUSD: 0.005,
      description: 'Advanced analytics data',
      resource: '/api/analytics',
    },
  },
  async (request, reply) => {
    return {
      message: 'Analytics data access granted',
      tier: 'analytics',
      data: {
        totalUsers: 10543,
        activeNow: 234,
        growth: '+12.3%',
        revenue: '$45,678',
      },
      paidBy: request.payment?.payer,
      amount: `$${request.payment?.amountUSD}`,
      signature: request.payment?.signature,
      blockTime: request.payment?.blockTime,
      slot: request.payment?.slot,
      timestamp: new Date().toISOString(),
    };
  }
);

// ============================================================================
// Start server
// ============================================================================

const PORT = parseInt(process.env.PORT || '3000');

try {
  await app.listen({ port: PORT, host: '0.0.0.0' });

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                  Fastify x402 API Server                       ║
╚════════════════════════════════════════════════════════════════╝

Server running on: http://localhost:${PORT}

Endpoints:
  - GET /api/hello             [FREE]
  - GET /api/premium           [PAID: $0.001]
  - GET /api/analytics         [PAID: $0.005]

Recipient wallet: ${process.env.RECIPIENT_WALLET}
Recipient USDC: ${app.x402.getRecipientUSDCAccount()}
Network: devnet

Try it:
  1. Free:  curl http://localhost:${PORT}/api/hello
  2. Paid:  npm run client
  `);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}