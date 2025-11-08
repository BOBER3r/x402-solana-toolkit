# x402 Solana Toolkit - Examples Overview

This directory contains production-ready examples demonstrating different use cases of the x402 payment protocol on Solana.

## Available Examples

### 1. Basic API (`01-basic-api/`)

**The simplest possible x402 integration**

Perfect for getting started. Shows how to add micropayments to an API in just a few lines of code.

- **Complexity**: Beginner
- **Server Code**: 78 lines
- **Client Code**: 43 lines
- **Pricing**: Free endpoint + $0.001 paid endpoint

**What you'll learn:**
- How to add x402 middleware to Express
- Creating free and paid endpoints
- Using the x402 client
- Basic payment flow

**When to use this:**
- First time using x402
- Adding payments to existing API
- Simple single-tier pricing

```bash
cd 01-basic-api
npm install
npm run demo
```

---

### 2. Solex Betting (`02-solex-betting/`)

**Complete AI-powered betting platform**

Production-ready application showing x402 at scale with multiple features.

- **Complexity**: Advanced
- **Features**: AI agent, analytics, tier system
- **Pricing**: 4 tiers from free to $0.10

**What you'll learn:**
- Building complete applications with x402
- Multi-tier pricing strategies
- Integration with AI agents
- Production deployment patterns

**When to use this:**
- Building a complete application
- Need multiple pricing tiers
- Want AI/agent integration
- Production deployment example

```bash
cd 02-solex-betting
npm install
npm run demo
```

---

### 3. Weather API (`03-weather-api/`)

**Realistic API with tiered pricing**

Real-world example showing how to monetize API data with different access levels.

- **Complexity**: Intermediate
- **Server Code**: 226 lines
- **Client Code**: 131 lines
- **Pricing**: Free, $0.001, $0.01 tiers

**What you'll learn:**
- Implementing tiered pricing
- Different data access levels
- Query parameter handling
- Payment receipt management

**When to use this:**
- Building a data API
- Need multiple pricing tiers
- Different feature levels
- Usage-based pricing

```bash
cd 03-weather-api
npm install
npm run demo
```

---

### 4. NestJS API (`04-nestjs-api/`)

**Production-ready NestJS microservice**

Enterprise-grade TypeScript framework with x402 decorators and guards.

- **Complexity**: Intermediate
- **Framework**: NestJS
- **Features**: Guards, Decorators, Modules
- **Pricing**: Free, $0.001, $0.005 tiers

**What you'll learn:**
- NestJS x402 module integration
- Using @RequirePayment() decorator
- Guards for route protection
- Dependency injection patterns
- TypeScript best practices

**When to use this:**
- Building enterprise microservices
- Need scalable architecture
- Want dependency injection
- TypeScript-first development
- Microservice patterns

```bash
cd 04-nestjs-api
npm install
npm run demo
```

---

### 5. Fastify API (`05-fastify-api/`)

**High-performance Fastify server**

One of the fastest Node.js frameworks with x402 plugin system.

- **Complexity**: Intermediate
- **Framework**: Fastify
- **Features**: Plugins, Hooks, Performance
- **Pricing**: Free, $0.001, $0.005 tiers

**What you'll learn:**
- Fastify plugin system
- Route option configuration
- High-performance patterns
- Type-safe request handling
- Performance optimization

**When to use this:**
- Need maximum performance (70k+ req/s)
- High-frequency trading APIs
- Real-time data feeds
- Low-latency requirements
- Streaming services

```bash
cd 05-fastify-api
npm install
npm run demo
```

---

## Comparison Table

| Feature | Basic API | Weather API | Solex Betting | NestJS API | Fastify API |
|---------|-----------|-------------|---------------|------------|-------------|
| **Framework** | Express | Express | Express | NestJS | Fastify |
| **Complexity** | Beginner | Intermediate | Advanced | Intermediate | Intermediate |
| **Server Lines** | 78 | 226 | 500+ | 125 | 95 |
| **Client Lines** | 43 | 131 | 350+ | 65 | 65 |
| **Pricing Tiers** | 2 | 3 | 4 | 3 | 3 |
| **Performance** | ~30k req/s | ~30k req/s | ~25k req/s | ~25k req/s | ~70k req/s |
| **Use Case** | Getting started | Data API | Complete app | Enterprise | High-perf |
| **Setup Time** | 5 minutes | 10 minutes | 20 minutes | 10 minutes | 10 minutes |
| **Best For** | Learning | Production API | Full platform | Microservices | Speed |

## Quick Setup (All Examples)

All examples follow the same setup pattern:

```bash
# 1. Navigate to example
cd 01-basic-api  # or 03-weather-api, 02-solex-betting

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your wallet addresses

# 4. Run demo
npm run demo

# OR run separately:
npm run server  # Terminal 1
npm run client  # Terminal 2
```

## Environment Setup

All examples require:

```env
# Solana RPC
SOLANA_RPC_URL=https://api.devnet.solana.com

# Server wallet (receives payments)
RECIPIENT_WALLET=your-public-key-here

# Client wallet (makes payments)
WALLET_PRIVATE_KEY=your-base58-private-key-here
```

### Getting Test Tokens

For devnet testing:

1. **SOL** (for transaction fees): https://faucet.solana.com
2. **USDC** (for payments): https://spl-token-faucet.com

## Example Selection Guide

**Choose Basic API if you want to:**
- Learn x402 basics quickly
- Add payments to existing Express API
- Simple single-price endpoints
- Minimal code footprint

**Choose Weather API if you want to:**
- Implement tiered pricing
- Different access levels (free/basic/premium)
- Real-world data API pattern
- Query parameter handling

**Choose Solex Betting if you want to:**
- See a complete production application
- AI agent integration
- Complex multi-tier pricing
- Analytics and reporting
- Production deployment patterns

**Choose NestJS API if you want to:**
- Enterprise-grade TypeScript architecture
- Dependency injection patterns
- Decorators and guards
- Scalable microservices
- Best practices for large teams

**Choose Fastify API if you want to:**
- Maximum performance (70k+ req/s)
- Low-latency requirements
- High-frequency trading
- Real-time data streaming
- Plugin-based architecture

## Code Patterns

All examples demonstrate these core patterns:

### Server Pattern
```typescript
import { X402Middleware } from '@x402-solana/server';

const x402 = new X402Middleware({
  solanaRpcUrl: process.env.SOLANA_RPC_URL,
  recipientWallet: process.env.RECIPIENT_WALLET,
  network: 'devnet',
});

app.get('/paid-endpoint',
  x402.requirePayment(0.001),  // Price in USD
  (req, res) => {
    // Access payment info via req.payment
    res.json({ data: 'premium', payment: req.payment });
  }
);
```

### Client Pattern
```typescript
import { X402Client } from '@x402-solana/client';

const client = new X402Client({
  solanaRpcUrl: process.env.SOLANA_RPC_URL,
  walletPrivateKey: process.env.WALLET_PRIVATE_KEY,
  network: 'devnet',
});

// Use exactly like fetch() - payments are automatic!
const response = await client.fetch('http://api.com/paid-endpoint');
const data = await response.json();
```

## Testing Examples

Each example includes:
- **Demo mode** - Runs both server and client automatically
- **Manual mode** - Run server and client separately
- **cURL tests** - Test endpoints with curl
- **Expected output** - Sample output in README

## Production Checklist

Before deploying any example to production:

- [ ] Change network from `devnet` to `mainnet-beta`
- [ ] Use production Solana RPC (Helius, QuickNode, etc.)
- [ ] Secure private keys (use environment variables, not hardcoded)
- [ ] Add Redis for payment caching
- [ ] Implement rate limiting
- [ ] Add monitoring and logging
- [ ] Set appropriate prices
- [ ] Add error handling for edge cases
- [ ] Test with real USDC on mainnet
- [ ] Add analytics tracking

## Next Steps

1. **Start with Basic API** - Get familiar with x402
2. **Try Weather API** - Learn tiered pricing
3. **Study Solex Betting** - See production patterns
4. **Build Your Own** - Use these as templates

## Support

- **Documentation**: [Main README](../README.md)
- **x402 Protocol**: https://github.com/Anthropic/x402
- **Solana Docs**: https://docs.solana.com
- **Issues**: GitHub Issues

## License

MIT - See LICENSE file for details
