/**
 * Basic x402 API Example - Server
 *
 * This example shows the SIMPLEST possible x402 integration:
 * - One free endpoint (no payment)
 * - One paid endpoint ($0.001)
 * - Less than 50 lines of code
 */

import express from 'express';
import { X402Middleware } from '@x402-solana/server';
import dotenv from 'dotenv';

dotenv.config();

// Initialize x402 middleware (just 5 lines!)
const x402 = new X402Middleware({
  solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  recipientWallet: process.env.RECIPIENT_WALLET!,
  network: 'devnet',
  debug: true,
});

const app = express();
app.use(express.json());

// ============================================================================
// FREE ENDPOINT - No payment required
// ============================================================================

app.get('/api/hello', (req, res) => {
  res.json({
    message: 'Hello! This endpoint is free.',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// PAID ENDPOINT - $0.001 required
// ============================================================================

app.get('/api/premium-hello',
  x402.requirePayment(0.001),  // Just add this line!
  (req, res) => {
    res.json({
      message: 'Premium hello! You paid for this.',
      paidBy: req.payment?.payer,
      amount: `$${req.payment?.amount}`,
      timestamp: new Date().toISOString(),
    });
  }
);

// ============================================================================
// Start server
// ============================================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    Basic x402 API Server                       ║
╚════════════════════════════════════════════════════════════════╝

Server running on: http://localhost:${PORT}

Endpoints:
  - GET /api/hello            [FREE]
  - GET /api/premium-hello    [PAID: $0.001]

Recipient wallet: ${process.env.RECIPIENT_WALLET}
Network: devnet

Try it:
  1. Free:  curl http://localhost:${PORT}/api/hello
  2. Paid:  npm run client
  `);
});
