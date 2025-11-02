# x402-solana-toolkit

**Add x402 micropayments to any Solana API in under 5 lines of code.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Solana](https://img.shields.io/badge/Solana-Web3.js-9945FF)](https://solana.com)

A production-grade TypeScript library that enables any HTTP API on Solana to implement x402 payment protocol. Framework-agnostic, fully typed, and battle-tested.

---

## 📥 Installation

```bash
# Install server package (for API developers)
npm install @x402-solana/server @solana/web3.js

# Install client package (for API consumers)
npm install @x402-solana/client @solana/web3.js

# Or install both
npm install @x402-solana/server @x402-solana/client @solana/web3.js
```

> **Note**: Currently published to GitHub Packages. Full npm registry publication coming soon for hackathon demo.

---

## 🚀 Quick Start

### Server (Add payments to your API)

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

// Paid endpoint - just add this line!
app.get('/api/premium-data',
  x402.requirePayment(0.01),  // $0.01 USDC
  (req, res) => {
    res.json({
      data: 'Premium data!',
      paidBy: req.payment?.payer,
    });
  }
);

app.listen(3000);
```

### Client (Automatic payment handling)

```typescript
import { X402Client } from '@x402-solana/client';

const client = new X402Client({
  solanaRpcUrl: 'https://api.devnet.solana.com',
  walletPrivateKey: process.env.WALLET_PRIVATE_KEY,
  network: 'devnet',
});

// Automatically handles 402, creates payment, and retries!
const response = await client.fetch('http://localhost:3000/api/premium-data');
const data = await response.json();
```

**That's it!** The client automatically:
1. Detects 402 Payment Required responses
2. Creates USDC payment on Solana
3. Waits for transaction confirmation
4. Retries request with payment proof

---

## 📦 Packages

| Package | Description | Size |
|---------|-------------|------|
| **[@x402-solana/core](./packages/core)** | Core payment verification and x402 protocol | 96 tests |
| **[@x402-solana/server](./packages/server)** | Express, NestJS, Fastify middleware | 5+ tests |
| **[@x402-solana/client](./packages/client)** | Auto-payment fetch wrapper | 20+ tests |
| **[@x402-solana/mcp](./packages/mcp)** | Model Context Protocol integration | Coming soon |

---

## 🎯 Features

### ✅ Production Ready
- Full TypeScript with strict mode
- 80%+ test coverage
- Transaction replay protection
- Exponential backoff retry logic
- Redis caching support

### ✅ Framework Agnostic
- **Express** middleware
- **NestJS** guard with decorators
- **Fastify** plugin
- Generic HTTP handler

### ✅ Developer Experience
- Add payments in < 5 lines of code
- Clear error messages
- Comprehensive examples
- Complete API documentation

### ✅ Solana Native
- USDC payments (devnet & mainnet)
- SPL Token support
- Versioned transactions
- Associated Token Accounts

---

## 📚 Examples

### [01-basic-api](./examples/01-basic-api)
The simplest possible x402 integration. Perfect for getting started!
- **1 FREE endpoint**: Hello world
- **1 PAID endpoint**: Premium hello ($0.001)
- **~50 lines** of code total

### [02-solex-betting](./examples/02-solex-betting) ⭐ **SHOWCASE**
Complete betting platform API with AI agent client.
- **4 endpoints**: 1 free, 3 paid
- **Dynamic pricing**: $0.10 + 2% for bet execution
- **Real economics**: Agent spends $0.25, expects $0.48 profit
- **~900 lines** of production-ready code

### [03-weather-api](./examples/03-weather-api)
Realistic weather API with tiered pricing.
- **FREE**: Current weather
- **BASIC** ($0.001): 7-day forecast
- **PREMIUM** ($0.01): Historical data

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Your API (Express/NestJS/Fastify)                          │
│                                                              │
│  app.get('/data', x402.requirePayment(0.01), handler);     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ 402 Payment Required
                       ↓
┌──────────────────────────────────────────────────────────────┐
│  @x402-solana/server                                         │
│                                                              │
│  • Checks X-PAYMENT header                                  │
│  • Verifies USDC transaction on Solana                     │
│  • Validates amount, recipient, timing                      │
│  • Prevents replay attacks (Redis cache)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Transaction signature
                       ↓
┌──────────────────────────────────────────────────────────────┐
│  @x402-solana/core                                           │
│                                                              │
│  • TransactionVerifier - Parse Solana transactions          │
│  • USDCVerifier - Validate USDC transfers                   │
│  • PaymentCache - Prevent replay attacks                    │
└──────────────────────────────────────────────────────────────┘
```

**Client Side:**

```
┌──────────────────────────────────────────────────────────────┐
│  Your Client Code                                            │
│                                                              │
│  const data = await client.fetch('/api/data');              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Automatic payment handling
                       ↓
┌──────────────────────────────────────────────────────────────┐
│  @x402-solana/client                                         │
│                                                              │
│  1. Detect 402 response                                      │
│  2. Create USDC transfer on Solana                          │
│  3. Wait for confirmation                                    │
│  4. Retry with X-PAYMENT header                             │
└──────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Installation

```bash
# Server-side
npm install @x402-solana/server

# Client-side
npm install @x402-solana/client

# Core only (if building custom integrations)
npm install @x402-solana/core
```

---

## 📖 Documentation

- [Getting Started](./docs/GETTING_STARTED.md)
- [API Reference](./docs/API_REFERENCE.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Security](./docs/SECURITY.md)
- [Examples Guide](./examples/EXAMPLES_OVERVIEW.md)

---

## 🔐 Security

- ✅ **Transaction verification** on Solana blockchain
- ✅ **Replay attack prevention** with signature caching
- ✅ **Amount validation** (prevents underpayment)
- ✅ **Recipient validation** (checks USDC token account)
- ✅ **Timing validation** (rejects old transactions)
- ✅ **Mint verification** (ensures payment is USDC)

See [SECURITY.md](./docs/SECURITY.md) for details.

---

## 🧪 Testing

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests for specific package
npm test -- --filter=@x402-solana/core

# Run integration tests (requires devnet)
npm run test:integration
```

---

## 🚢 Deployment

### Environment Variables

```bash
# Server
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
RECIPIENT_WALLET=<your_wallet_address>
NETWORK=mainnet-beta
REDIS_URL=redis://localhost:6379  # Optional but recommended

# Client
WALLET_PRIVATE_KEY=<base58_private_key>
```

### Production Checklist

- [ ] Use mainnet-beta RPC (not devnet)
- [ ] Configure Redis for multi-instance deployments
- [ ] Set appropriate `maxAgeMs` (default 5 minutes)
- [ ] Monitor RPC rate limits
- [ ] Log payment verification metrics
- [ ] Set up alerts for failed verifications

---

## 💡 Why x402 on Solana?

### Traditional APIs
- Monthly subscriptions ($50-200/month)
- All-or-nothing pricing
- Payment processor fees (3%)
- Geographic restrictions

### x402 on Solana
- Pay per request (as low as $0.001)
- Sub-second confirmation times
- Transaction fees < $0.0001
- Global, permissionless access

### Real Economics (from Solex example)

**AI Agent using paid API:**
- Spends: $0.25 per run
  - $0.05 for recommendations
  - $0.20 for bet execution
- Expected profit: $0.48
- **Net gain: $0.23 (92% ROI on fees)**

**vs. Traditional subscription:**
- $50-200/month whether you use it or not
- Requires credit card / payment setup
- Geographic restrictions

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

## 🙏 Acknowledgments

Built for the x402 Protocol Hackathon. Powered by:
- Solana Web3.js
- SPL Token Program
- TypeScript

---

## 🔗 Links

- [Documentation](./docs/)
- [Examples](./examples/)
- [npm Registry](https://www.npmjs.com/package/@x402-solana/core)
- [Issue Tracker](https://github.com/yourusername/x402-solana-toolkit/issues)

---

## ⭐ Star us on GitHub!

If this toolkit helped you, please consider giving us a star ⭐

**Ready to add micropayments to your Solana API?** [Get started now →](./docs/GETTING_STARTED.md)
