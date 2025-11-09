# x402-solana-toolkit

**Add x402 micropayments to any Solana API in under 5 lines of code.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Solana](https://img.shields.io/badge/Solana-Web3.js-9945FF)](https://solana.com)
[![x402](https://img.shields.io/badge/x402-v1%20Compliant-success)](https://github.com/coinbase/x402)

A production-grade TypeScript library that enables any HTTP API on Solana to implement the official **x402 payment protocol**. Framework-agnostic, fully typed, and battle-tested.

> **🏆 x402 Hackathon**: This toolkit is fully compliant with the official x402 protocol specification and qualifies for the "Best x402 Dev Tool" track. [See X402_COMPLIANCE.md](./X402_COMPLIANCE.md) 
---

## 📥 Installation

```bash
# Install server package (for API developers)
npm install @x402-solana/server @solana/web3.js

# Install client package (for API consumers)
npm install @x402-solana/client @solana/web3.js

# Install React hooks (for React apps)
npm install @x402-solana/react @solana/wallet-adapter-react

# Or install all packages
npm install @x402-solana/server @x402-solana/client @x402-solana/react
```

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

### React (Drop-in hooks for React apps) 🆕

```tsx
import { X402Provider, useX402Payment } from '@x402-solana/react';
import { WalletProvider } from '@solana/wallet-adapter-react';

// 1. Wrap your app with providers
function App() {
  return (
    <WalletProvider wallets={[]} autoConnect>
      <X402Provider config={{ solanaRpcUrl: 'https://api.devnet.solana.com' }}>
        <YourApp />
      </X402Provider>
    </WalletProvider>
  );
}

// 2. Use the hook - that's it!
function PremiumContent() {
  const { fetch, isLoading } = useX402Payment();

  const loadData = async () => {
    const response = await fetch('/api/premium'); // Auto-handles 402!
    const data = await response.json();
  };

  return (
    <button onClick={loadData} disabled={isLoading}>
      {isLoading ? 'Processing...' : 'Load Premium Data'}
    </button>
  );
}
```

**Built for React developers:**
- ✅ Works with Phantom, Solflare, and all Solana wallets
- ✅ Automatic 402 detection and payment
- ✅ Balance monitoring with `useWalletBalance()`
- ✅ Payment history tracking with `usePaymentHistory()`
- ✅ Full TypeScript support
- ✅ Zero configuration needed

👉 **[Complete React Guide](./REACT_INTEGRATION_GUIDE.md)**

---

## 📦 Packages

| Package | Description | Status |
|---------|-------------|--------|
| **[@x402-solana/core](https://www.npmjs.com/package/@x402-solana/core)** | Core payment verification and x402 protocol | ✅ Published (96 tests) |
| **[@x402-solana/server](https://www.npmjs.com/package/@x402-solana/server)** | Express, NestJS, Fastify middleware | ✅ Published |
| **[@x402-solana/client](https://www.npmjs.com/package/@x402-solana/client)** | Auto-payment fetch wrapper | ✅ Published |
| **[@x402-solana/react](./packages/react)** | React hooks and components 🆕 | ✅ Ready (v0.2.0) |

---

## 🎯 Features

### ✅ Production Ready
- Full TypeScript with strict mode
- Transaction replay protection
- Exponential backoff retry logic
- Redis caching support

### ✅ Framework Agnostic
- **Express** middleware
- **NestJS** guard with decorators
- **Fastify** plugin
- Generic HTTP handler

### ✅ Developer Experience
- Clear error messages
- Comprehensive examples
- Complete API documentation

### ✅ Solana Native
- USDC payments (devnet & mainnet)
- SPL Token support
- Versioned transactions
- Associated Token Accounts

---

## ✨ x402 Protocol Compliance

This toolkit is **100% compliant** with the official x402 specification by Coinbase.

### What is x402?

x402 is a protocol for HTTP micropayments using the `402 Payment Required` status code. Unlike L402 (Bitcoin Lightning-specific), **x402 is blockchain-agnostic** and designed to work with any payment system.

### Key Compliance Features

✅ **Official Protocol Format**
- Uses `scheme: "exact"` for fixed payments
- Network format: `solana-devnet` / `solana-mainnet`
- Flat `payTo` string (token account address)
- Includes `mimeType`, `outputSchema`, `extra` fields

✅ **Facilitator Pattern**
- `/verify` - Lightweight payment validation
- `/settle` - On-chain payment verification
- `/supported` - Capability discovery

✅ **Payment Format Support**
- `serializedTransaction` - Official x402 format
- `signature` - Backwards compatibility

✅ **X-PAYMENT Header**
- Base64-encoded JSON format
- Proper scheme and network identifiers
- Version tracking with `x402Version: 1`

### 📋 Full Compliance Documentation

See [X402_COMPLIANCE.md](./X402_COMPLIANCE.md) for:
- Complete protocol specification
- Implementation details
- Payment flow diagrams
- Facilitator endpoint documentation
- Type definitions
- Security considerations
- Testing & verification

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

- **[X402 Compliance Documentation](./X402_COMPLIANCE.md)** - Full x402 protocol compliance details
- **[Getting Started Guide](./GETTING_STARTED.md)** - Complete setup and integration guide
- **[Examples Overview](./examples/EXAMPLES_OVERVIEW.md)** - Walkthrough of all examples
- **[Package Documentation](./packages/)** - API reference for each package

---

## 🔐 Security

- ✅ **Transaction verification** on Solana blockchain
- ✅ **Replay attack prevention** with signature caching
- ✅ **Amount validation** (prevents underpayment)
- ✅ **Recipient validation** (checks USDC token account)
- ✅ **Timing validation** (rejects old transactions)
- ✅ **Mint verification** (ensures payment is USDC)

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

## 🤖 MCP Integration

Looking to use this toolkit with Model Context Protocol? Check out our [betting-analytics-mcp](https://github.com/BOBER3r/betting-analytics-mcp) server that demonstrates MCP + x402 integration.

---

## 🙏 Acknowledgments

Built for the x402 Protocol Hackathon. Powered by:
- Solana Web3.js
- SPL Token Program
- TypeScript

---

## 🔗 Links

- [npm: @x402-solana/core](https://www.npmjs.com/package/@x402-solana/core)
- [npm: @x402-solana/server](https://www.npmjs.com/package/@x402-solana/server)
- [npm: @x402-solana/client](https://www.npmjs.com/package/@x402-solana/client)
- [Getting Started Guide](./GETTING_STARTED.md)
- [Examples](./examples/)

---

## ⭐ Star us on GitHub!

If this toolkit helped you, please consider giving us a star ⭐

**Ready to add micropayments to your Solana API?** [Get started now →](./GETTING_STARTED.md)
