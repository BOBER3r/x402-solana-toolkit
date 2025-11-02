# @x402-solana/server

Server-side framework integrations for x402 payments on Solana. This package provides production-grade middleware, guards, and plugins for popular Node.js web frameworks to enable x402 payment protocol.

## Features

- **Express Middleware** - Easy-to-use middleware for Express applications
- **NestJS Guard** - Decorator-based guards for NestJS applications
- **Fastify Plugin** - High-performance plugin for Fastify applications
- **Automatic Payment Verification** - Verifies USDC payments on Solana blockchain
- **Replay Attack Prevention** - Built-in caching to prevent payment reuse
- **Type-Safe** - Full TypeScript support with comprehensive type definitions
- **Production Ready** - Error handling, logging, and performance optimized

## Installation

```bash
npm install @x402-solana/server @x402-solana/core @solana/web3.js
```

For your specific framework:

```bash
# Express
npm install express

# NestJS
npm install @nestjs/common @nestjs/core

# Fastify
npm install fastify
```

## Quick Start

### Express

```typescript
import express from 'express';
import { X402Middleware } from '@x402-solana/server';

const app = express();

// Initialize x402 middleware
const x402 = new X402Middleware({
  solanaRpcUrl: 'https://api.devnet.solana.com',
  recipientWallet: 'YourWalletPublicKey...',
  network: 'devnet',
});

// Protected route requiring $0.001 payment
app.get('/api/premium',
  x402.requirePayment(0.001, {
    description: 'Access to premium API',
  }),
  (req, res) => {
    console.log('Payment verified:', req.payment);
    res.json({ data: 'premium content' });
  }
);

app.listen(3000);
```

### NestJS

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { X402Module } from '@x402-solana/server';

@Module({
  imports: [
    X402Module.register({
      solanaRpcUrl: process.env.SOLANA_RPC_URL,
      recipientWallet: process.env.RECIPIENT_WALLET,
      network: 'devnet',
    }),
  ],
})
export class AppModule {}

// api.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { X402Guard, RequirePayment } from '@x402-solana/server';

@Controller('api')
@UseGuards(X402Guard)
export class ApiController {
  @Get('premium')
  @RequirePayment(0.001, {
    description: 'Access to premium API',
  })
  getPremiumData() {
    return { data: 'premium content' };
  }
}
```

### Fastify

```typescript
import Fastify from 'fastify';
import { registerFastifyX402 } from '@x402-solana/server';

const app = Fastify();

// Register x402 plugin
await registerFastifyX402(app, {
  solanaRpcUrl: 'https://api.devnet.solana.com',
  recipientWallet: 'YourWalletPublicKey...',
  network: 'devnet',
});

// Protected route requiring $0.001 payment
app.get('/api/premium',
  {
    x402: {
      priceUSD: 0.001,
      description: 'Access to premium API',
    },
  },
  async (request, reply) => {
    console.log('Payment verified:', request.payment);
    return { data: 'premium content' };
  }
);

await app.listen({ port: 3000 });
```

## Configuration

### X402Config

```typescript
interface X402Config {
  /** Solana RPC URL */
  solanaRpcUrl: string;

  /** Recipient wallet address (base58 public key) */
  recipientWallet: string;

  /** Solana network */
  network: 'devnet' | 'mainnet-beta';

  /** Optional: Redis configuration for payment caching */
  redis?: {
    url: string;
  };

  /** Optional: Maximum payment age in milliseconds (default: 300000) */
  maxPaymentAgeMs?: number;

  /** Optional: Maximum retries for RPC calls (default: 3) */
  maxRetries?: number;

  /** Optional: Retry delay in milliseconds (default: 100) */
  retryDelayMs?: number;

  /** Optional: RPC commitment level (default: 'confirmed') */
  commitment?: 'processed' | 'confirmed' | 'finalized';
}
```

### Middleware Options

```typescript
interface MiddlewareOptions {
  /** Resource being paid for (optional) */
  resource?: string;

  /** Description of what payment is for */
  description?: string;

  /** Payment timeout in seconds (default: 300) */
  timeoutSeconds?: number;

  /** Skip cache check (for testing) */
  skipCacheCheck?: boolean;

  /** Custom error message */
  errorMessage?: string;
}
```

## Payment Flow

1. **No Payment**: Client makes request without `X-PAYMENT` header
   - Server responds with `402 Payment Required`
   - Response includes payment requirements (recipient USDC account, amount, etc.)

2. **Client Pays**: Client sends USDC on Solana and gets transaction signature

3. **Verification**: Client includes transaction signature in `X-PAYMENT` header
   - Server verifies transaction on blockchain
   - Checks amount, recipient, and timing
   - Prevents replay attacks

4. **Success**: If valid, request proceeds to handler
   - Payment info attached to `req.payment`
   - Receipt returned in `X-PAYMENT-RESPONSE` header

## Payment Information

After successful verification, payment information is attached to the request:

```typescript
interface PaymentInfo {
  /** Transaction signature */
  signature: string;

  /** Amount paid in USD */
  amountUSD: number;

  /** Payer wallet address */
  payer: string;

  /** Block time (Unix timestamp) */
  blockTime?: number;

  /** Slot number */
  slot?: number;
}
```

### Accessing Payment Info

**Express:**
```typescript
app.get('/api/data', x402.requirePayment(0.001), (req, res) => {
  console.log('Paid by:', req.payment.payer);
  console.log('Amount:', req.payment.amountUSD);
  res.json({ success: true });
});
```

**NestJS:**
```typescript
@Get('data')
@RequirePayment(0.001)
getData(@Payment() payment: PaymentInfo) {
  console.log('Paid by:', payment.payer);
  return { success: true };
}
```

**Fastify:**
```typescript
app.get('/api/data',
  { x402: { priceUSD: 0.001 } },
  async (request, reply) => {
    console.log('Paid by:', request.payment.payer);
    return { success: true };
  }
);
```

## Error Handling

The middleware handles various error scenarios:

- **No Payment**: Returns 402 with payment requirements
- **Invalid Signature**: Returns 402 with error details
- **Insufficient Amount**: Returns 402 indicating amount mismatch
- **Expired Payment**: Returns 402 for payments older than `maxPaymentAgeMs`
- **Replay Attack**: Returns 402 when signature was already used
- **RPC Errors**: Returns 500 with error details

## Redis Configuration

For production deployments, use Redis to prevent replay attacks across multiple server instances:

```typescript
const x402 = new X402Middleware({
  solanaRpcUrl: 'https://api.mainnet-beta.solana.com',
  recipientWallet: process.env.RECIPIENT_WALLET,
  network: 'mainnet-beta',
  redis: {
    url: process.env.REDIS_URL,
  },
});
```

## Advanced Usage

### Multiple Price Tiers

```typescript
// Express
app.get('/api/basic', x402.requirePayment(0.001), handler);
app.get('/api/premium', x402.requirePayment(0.01), handler);

// NestJS
@Get('basic')
@RequirePayment(0.001)
getBasic() { }

@Get('premium')
@RequirePayment(0.01)
getPremium() { }
```

### Custom Descriptions

```typescript
x402.requirePayment(0.001, {
  description: 'Weather data for New York',
  resource: '/api/weather/nyc',
})
```

### Custom Timeout

```typescript
x402.requirePayment(0.001, {
  timeoutSeconds: 600, // 10 minutes
})
```

## Testing

The package includes comprehensive test suites:

```bash
npm test
```

Tests cover:
- Express middleware functionality
- NestJS guard behavior
- Fastify plugin integration
- Payment verification flow
- Error handling scenarios
- Replay attack prevention

## Security Considerations

1. **HTTPS Required**: Always use HTTPS in production to protect payment headers
2. **Replay Prevention**: Use Redis in production for distributed replay attack prevention
3. **Amount Verification**: Middleware verifies payment amount matches or exceeds requirement
4. **Timing Checks**: Payments older than `maxPaymentAgeMs` are rejected
5. **Signature Validation**: All transaction signatures are verified on-chain

## Examples

See the `/examples` directory for complete working examples:
- Express REST API
- NestJS application
- Fastify service

## API Reference

### Express

- `X402Middleware` - Main middleware class
- `createX402Middleware(config)` - Factory function
- `middleware.requirePayment(priceUSD, options?)` - Payment requirement middleware

### NestJS

- `X402Module` - Dynamic module
- `X402Guard` - CanActivate guard
- `@RequirePayment(priceUSD, options?)` - Route decorator
- `@Payment()` - Parameter decorator for payment info

### Fastify

- `x402FastifyPlugin` - Plugin export
- `registerFastifyX402(app, config)` - Registration helper
- Route option: `{ x402: { priceUSD, description } }`

## License

MIT

## Contributing

See the main repository for contribution guidelines.
