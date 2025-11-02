# @x402-solana/server

Server-side framework integrations for x402 payment verification on Solana.

[![npm version](https://img.shields.io/npm/v/@x402-solana/server.svg)](https://www.npmjs.com/package/@x402-solana/server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

`@x402-solana/server` makes it trivial to add USDC micropayments to any HTTP API on Solana. Add one line of middleware and your endpoints instantly support x402 payment protocol.

**Turn any endpoint into a paid API in under 5 lines of code.**

## Installation

```bash
npm install @x402-solana/server @solana/web3.js
```

## Quick Start

### Express

```typescript
import express from 'express';
import { X402Middleware } from '@x402-solana/server';

const app = express();
const x402 = new X402Middleware({
  solanaRpcUrl: 'https://api.devnet.solana.com',
  recipientWallet: 'YOUR_WALLET_ADDRESS',
  network: 'devnet',
});

// Free endpoint
app.get('/api/data', (req, res) => {
  res.json({ data: 'This is free!' });
});

// Paid endpoint - just add one line!
app.get('/api/premium',
  x402.requirePayment(0.01),  // $0.01 USDC
  (req, res) => {
    res.json({
      data: 'Premium data!',
      paidBy: req.payment?.payer,
      amount: req.payment?.amount,
    });
  }
);

app.listen(3000);
```

## Features

- ✅ **Framework Support** - Express, NestJS, Fastify
- ✅ **One-Line Integration** - Add payments with single middleware call
- ✅ **Automatic Verification** - Validates USDC transfers on-chain
- ✅ **Replay Protection** - Prevents payment reuse
- ✅ **TypeScript** - Fully typed with excellent DX
- ✅ **Redis Support** - Scales across multiple servers
- ✅ **Dynamic Pricing** - Set different prices per endpoint
- ✅ **Error Handling** - Clear 402 responses for clients

## Framework Integration

### Express

```typescript
import { X402Middleware } from '@x402-solana/server';

const x402 = new X402Middleware({
  solanaRpcUrl: process.env.SOLANA_RPC_URL!,
  recipientWallet: process.env.RECIPIENT_WALLET!,
  network: 'mainnet-beta',
});

// Single endpoint
app.get('/api/data', x402.requirePayment(0.01), handler);

// Multiple endpoints
app.use('/api/premium', x402.requirePayment(0.05));
app.get('/api/premium/analytics', analyticsHandler);
app.post('/api/premium/execute', executeHandler);
```

### NestJS

```typescript
import { X402Guard, X402Module, X402Payment } from '@x402-solana/server/nestjs';

@Module({
  imports: [
    X402Module.forRoot({
      solanaRpcUrl: process.env.SOLANA_RPC_URL!,
      recipientWallet: process.env.RECIPIENT_WALLET!,
      network: 'mainnet-beta',
    }),
  ],
})
export class AppModule {}

@Controller('api')
export class ApiController {
  @Get('premium')
  @UseGuards(X402Guard)
  @X402Payment(0.01)  // $0.01 USDC
  getPremiumData(@Request() req) {
    return {
      data: 'Premium data',
      payment: req.payment,
    };
  }
}
```

### Fastify

```typescript
import x402Plugin from '@x402-solana/server/fastify';

const fastify = Fastify();

await fastify.register(x402Plugin, {
  solanaRpcUrl: process.env.SOLANA_RPC_URL!,
  recipientWallet: process.env.RECIPIENT_WALLET!,
  network: 'mainnet-beta',
});

fastify.get('/api/premium', {
  x402: { priceUSD: 0.01 }
}, async (request, reply) => {
  return {
    data: 'Premium data',
    payment: request.payment,
  };
});
```

## Configuration

### Basic Configuration

```typescript
const x402 = new X402Middleware({
  /** Solana RPC endpoint */
  solanaRpcUrl: string;
  
  /** Your wallet to receive payments */
  recipientWallet: string;
  
  /** Network: 'devnet' or 'mainnet-beta' */
  network: 'devnet' | 'mainnet-beta';
});
```

### Advanced Configuration

```typescript
const x402 = new X402Middleware({
  solanaRpcUrl: process.env.SOLANA_RPC_URL!,
  recipientWallet: process.env.RECIPIENT_WALLET!,
  network: 'mainnet-beta',
  
  /** Maximum transaction age (default: 5 minutes) */
  maxAgeMs: 300000,
  
  /** Transaction commitment level (default: 'confirmed') */
  commitment: 'finalized',
  
  /** Redis for replay protection across servers */
  cacheConfig: {
    redisUrl: process.env.REDIS_URL!,
    keyPrefix: 'x402:',
    ttlSeconds: 600,
  },
  
  /** Enable debug logging */
  debug: true,
});
```

## Usage Patterns

### Fixed Pricing

```typescript
// Always costs $0.01
app.get('/api/search', x402.requirePayment(0.01), handler);
```

### Dynamic Pricing

```typescript
// Price varies based on request
app.post('/api/execute', async (req, res, next) => {
  const betAmount = req.body.betAmount;
  const price = 0.10 + (betAmount * 0.02); // $0.10 + 2%
  
  await x402.requirePayment(price)(req, res, next);
}, executeHandler);
```

### Tiered Pricing

```typescript
app.get('/api/basic', x402.requirePayment(0.001), basicHandler);
app.get('/api/standard', x402.requirePayment(0.01), standardHandler);
app.get('/api/premium', x402.requirePayment(0.10), premiumHandler);
```

### Free + Paid Mix

```typescript
// Free public endpoint
app.get('/api/markets', (req, res) => {
  res.json({ markets: getAllMarkets() });
});

// Paid analysis endpoint
app.post('/api/analyze', x402.requirePayment(0.05), (req, res) => {
  res.json({ analysis: analyzeMarket(req.body.marketId) });
});
```

## Payment Information

Access payment details in your handlers:

```typescript
app.get('/api/data', x402.requirePayment(0.01), (req, res) => {
  console.log('Payment verified!');
  console.log('Signature:', req.payment.signature);
  console.log('Payer:', req.payment.payer);
  console.log('Amount:', req.payment.amount, 'USDC');
  console.log('Timestamp:', new Date(req.payment.timestamp * 1000));
  
  res.json({ data: 'your data' });
});
```

## Error Handling

### 402 Response Format

When payment is required or invalid:

```json
{
  "error": "Payment Required",
  "paymentDetails": {
    "amount": 0.01,
    "currency": "USDC",
    "network": "solana",
    "recipient": "YourUSDCTokenAccount...",
    "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  }
}
```

### Custom Error Messages

```typescript
app.get('/api/premium',
  x402.requirePayment(0.01, {
    errorMessage: 'Premium content requires $0.01 USDC payment',
    resource: '/api/premium',
    description: 'Access to premium analytics',
  }),
  handler
);
```

## Redis Setup (Production)

For multi-instance deployments, use Redis to prevent replay attacks:

```typescript
import Redis from 'ioredis';

const x402 = new X402Middleware({
  solanaRpcUrl: process.env.SOLANA_RPC_URL!,
  recipientWallet: process.env.RECIPIENT_WALLET!,
  network: 'mainnet-beta',
  cacheConfig: {
    redisUrl: process.env.REDIS_URL!,
    keyPrefix: 'x402:',
    ttlSeconds: 600,  // Cache signatures for 10 minutes
  },
});
```

## Wallet Setup

### Get Your Recipient Wallet

```bash
# Your main wallet address
RECIPIENT_WALLET=YourWalletPublicKey...

# The middleware automatically derives your USDC token account
# Payments go to: deriveUSDCTokenAccount(RECIPIENT_WALLET)
```

### Check Payment Revenue

```typescript
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

const connection = new Connection(process.env.SOLANA_RPC_URL!);
const wallet = new PublicKey(process.env.RECIPIENT_WALLET!);
const usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

const usdcAccount = getAssociatedTokenAddressSync(usdcMint, wallet);
const balance = await connection.getTokenAccountBalance(usdcAccount);

console.log(`Revenue: ${balance.value.uiAmount} USDC`);
```

## Examples

### Weather API with Tiered Pricing

```typescript
const app = express();
const x402 = new X402Middleware({ ... });

// FREE: Current weather
app.get('/api/weather/current', (req, res) => {
  res.json(getCurrentWeather(req.query.city));
});

// $0.001: 7-day forecast
app.get('/api/weather/forecast',
  x402.requirePayment(0.001),
  (req, res) => {
    res.json(get7DayForecast(req.query.city));
  }
);

// $0.01: Historical data
app.get('/api/weather/historical',
  x402.requirePayment(0.01),
  (req, res) => {
    res.json(getHistoricalData(req.query.city, req.query.date));
  }
);
```

### AI API with Dynamic Pricing

```typescript
app.post('/api/analyze',
  async (req, res, next) => {
    const complexity = estimateComplexity(req.body.query);
    const price = 0.01 * complexity; // Scale with complexity
    
    await x402.requirePayment(price)(req, res, next);
  },
  async (req, res) => {
    const result = await runAIAnalysis(req.body.query);
    res.json(result);
  }
);
```

## Monitoring & Logging

```typescript
const x402 = new X402Middleware({
  solanaRpcUrl: process.env.SOLANA_RPC_URL!,
  recipientWallet: process.env.RECIPIENT_WALLET!,
  network: 'mainnet-beta',
  debug: true,  // Enable debug logging
});

// Log all successful payments
app.use((req, res, next) => {
  if (req.payment) {
    console.log(`💰 Payment received: ${req.payment.amount} USDC from ${req.payment.payer}`);
  }
  next();
});
```

## Testing

### Development/Testing Mode

```typescript
// Use devnet for testing
const x402 = new X402Middleware({
  solanaRpcUrl: 'https://api.devnet.solana.com',
  recipientWallet: process.env.TEST_WALLET!,
  network: 'devnet',
  debug: true,
});
```

### Integration Tests

```typescript
import request from 'supertest';
import { X402Client } from '@x402-solana/client';

const client = new X402Client({
  solanaRpcUrl: 'https://api.devnet.solana.com',
  walletPrivateKey: process.env.TEST_PRIVATE_KEY!,
  network: 'devnet',
});

// Test paid endpoint
const response = await client.fetch('http://localhost:3000/api/premium');
expect(response.ok).toBe(true);
```

## Related Packages

- **[@x402-solana/client](https://www.npmjs.com/package/@x402-solana/client)** - Auto-payment client
- **[@x402-solana/core](https://www.npmjs.com/package/@x402-solana/core)** - Core verification logic

## Documentation

- [Full Documentation](https://github.com/BOBER3r/x402-solana-toolkit)
- [Getting Started Guide](https://github.com/BOBER3r/x402-solana-toolkit/blob/main/GETTING_STARTED.md)
- [Examples](https://github.com/BOBER3r/x402-solana-toolkit/tree/main/examples)

## License

MIT © 2025
