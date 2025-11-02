# Getting Started with x402-solana-toolkit

This guide will help you add x402 micropayments to your Solana API in under 10 minutes.

## Prerequisites

- Node.js 18+ installed
- Basic knowledge of Express.js or similar frameworks
- Solana wallet with some SOL and USDC (devnet for testing)

## Installation

```bash
# For server-side (API providers)
npm install @x402-solana/server

# For client-side (API consumers)
npm install @x402-solana/client
```

## Server Setup (API Provider)

### Step 1: Generate a Wallet

```bash
# Using Solana CLI
solana-keygen new --outfile ~/my-x402-wallet.json

# Or use our helper
npx @x402-solana/cli generate-wallet
```

### Step 2: Fund Your Wallet (Devnet)

```bash
# Get devnet SOL
solana airdrop 2 <YOUR_WALLET_ADDRESS> --url devnet

# Get devnet USDC
# Visit: https://spl-token-faucet.com
```

### Step 3: Add x402 to Your API

```typescript
import express from 'express';
import { X402Middleware } from '@x402-solana/server';

const app = express();
app.use(express.json());

// Initialize x402
const x402 = new X402Middleware({
  solanaRpcUrl: 'https://api.devnet.solana.com',
  recipientWallet: process.env.RECIPIENT_WALLET,
  network: 'devnet',
});

// Add a paid endpoint
app.get('/api/premium-data',
  x402.requirePayment(0.01),  // $0.01 USDC
  (req, res) => {
    // Payment verified! req.payment contains details
    res.json({
      data: 'Your premium data here',
      paidBy: req.payment?.payer,
      amount: req.payment?.amount,
    });
  }
);

app.listen(3000, () => {
  console.log('API with x402 running on http://localhost:3000');
});
```

### Step 4: Test Your API

```bash
# Try without payment (should get 402)
curl http://localhost:3000/api/premium-data

# Response:
{
  "x402Version": 1,
  "accepts": [{
    "scheme": "exact",
    "network": "solana-devnet",
    "maxAmountRequired": "10000",
    "payTo": {
      "address": "<USDC_TOKEN_ACCOUNT>",
      "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
    }
  }],
  "error": "Payment Required"
}
```

## Client Setup (API Consumer)

### Step 1: Generate a Wallet

```bash
# Generate a wallet for your client
npx @x402-solana/cli generate-wallet

# Fund it with devnet SOL and USDC
```

### Step 2: Use the Client

```typescript
import { X402Client } from '@x402-solana/client';

// Initialize client
const client = new X402Client({
  solanaRpcUrl: 'https://api.devnet.solana.com',
  walletPrivateKey: process.env.WALLET_PRIVATE_KEY,
  network: 'devnet',
});

// Use it just like fetch()!
async function callPaidAPI() {
  // The client automatically handles payments
  const response = await client.fetch('http://localhost:3000/api/premium-data');

  if (response.ok) {
    const data = await response.json();
    console.log('Got data:', data);
  }
}

callPaidAPI();
```

**Output:**
```
💸 Payment required: 10000 micro-USDC
✅ Payment sent: 3kZ8...9xY2
Got data: { data: 'Your premium data here', ... }
```

## Framework-Specific Guides

### Express.js

See above - Express is the default integration.

### NestJS

```typescript
import { Module } from '@nestjs/common';
import { X402Guard, RequirePayment } from '@x402-solana/server';

@Module({
  providers: [
    {
      provide: 'X402_CONFIG',
      useValue: {
        solanaRpcUrl: process.env.SOLANA_RPC_URL,
        recipientWallet: process.env.RECIPIENT_WALLET,
        network: 'devnet',
      },
    },
    X402Guard,
  ],
})
export class AppModule {}

// In your controller:
@Controller('api')
export class DataController {
  @Get('premium')
  @RequirePayment(0.01)
  getPremiumData(@Payment() payment: PaymentInfo) {
    return { data: 'Premium!', paidBy: payment.payer };
  }
}
```

### Fastify

```typescript
import Fastify from 'fastify';
import x402Plugin from '@x402-solana/server/fastify';

const fastify = Fastify();

await fastify.register(x402Plugin, {
  solanaRpcUrl: process.env.SOLANA_RPC_URL,
  recipientWallet: process.env.RECIPIENT_WALLET,
  network: 'devnet',
});

fastify.get('/api/premium', {
  x402: { priceUSD: 0.01 },
}, async (request, reply) => {
  return { data: 'Premium!', paidBy: request.payment?.payer };
});
```

## Next Steps

- [Explore Examples](../examples/) - See complete working examples
- [API Reference](./API_REFERENCE.md) - Detailed API documentation
- [Security Guide](./SECURITY.md) - Production security best practices
- [Architecture](./ARCHITECTURE.md) - How it works under the hood

## Troubleshooting

### "Payment not found"
- Wait a few seconds for transaction confirmation
- Check Solana RPC is accessible
- Verify network (devnet vs mainnet)

### "Insufficient balance"
- Check USDC balance: `spl-token balance <MINT> --owner <WALLET>`
- Get devnet USDC: https://spl-token-faucet.com

### "Transaction expired"
- Default timeout is 5 minutes
- Increase `maxAgeMs` in configuration
- Check system clock sync

## Need Help?

- [GitHub Issues](https://github.com/yourusername/x402-solana-toolkit/issues)
- [Examples](../examples/)
- [API Reference](./API_REFERENCE.md)
