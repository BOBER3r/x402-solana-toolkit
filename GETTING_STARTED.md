# Getting Started with x402-solana-toolkit

Complete guide to integrating x402 micropayments into your Solana application.

---

## Table of Contents

1. [Installation](#installation)
2. [Quick Setup](#quick-setup)
3. [Server Integration](#server-integration)
4. [Client Integration](#client-integration)
5. [MCP Integration](#mcp-integration)
6. [AI Agent Integration](#ai-agent-integration)
7. [Production Deployment](#production-deployment)
8. [Troubleshooting](#troubleshooting)

---

## Installation

### For API Developers (Server)

```bash
npm install @x402-solana/server @solana/web3.js express
```

### For API Consumers (Client/Agent)

```bash
npm install @x402-solana/client @solana/web3.js
```

### For Development (Both)

```bash
npm install @x402-solana/server @x402-solana/client @solana/web3.js
```

---

## Quick Setup

### 1. Get Solana Wallet

```typescript
// Generate new wallet or use existing
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

// Generate new (for testing)
const keypair = Keypair.generate();
console.log('Public Key:', keypair.publicKey.toString());
console.log('Private Key:', bs58.encode(keypair.secretKey));

// Or use existing
const existingKeypair = Keypair.fromSecretKey(
  bs58.decode('YOUR_BASE58_PRIVATE_KEY')
);
```

### 2. Fund Wallet

**Devnet:**
- SOL: https://faucet.solana.com
- USDC: https://spl-token-faucet.com (mint: `Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr`)

**Mainnet:**
- Buy SOL on any exchange
- Buy USDC (mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`)

### 3. Environment Variables

Create `.env`:

```bash
# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com  # or mainnet
NETWORK=devnet  # or mainnet-beta

# Server (Treasury)
RECIPIENT_WALLET=YourTreasuryPublicKeyHere

# Client/Agent
WALLET_PRIVATE_KEY=YourBase58PrivateKeyHere

# Optional: Redis for caching
REDIS_URL=redis://localhost:6379
```

---

## Server Integration

### Express (Simplest)

```typescript
import express from 'express';
import { X402Middleware } from '@x402-solana/server';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// Initialize x402
const x402 = new X402Middleware({
  solanaRpcUrl: process.env.SOLANA_RPC_URL!,
  recipientWallet: process.env.RECIPIENT_WALLET!,
  network: process.env.NETWORK as 'devnet' | 'mainnet-beta',
});

// Free endpoint
app.get('/api/free', (req, res) => {
  res.json({ message: 'Free data' });
});

// Paid endpoint - just add one line!
app.get('/api/premium',
  x402.requirePayment(0.01),  // $0.01 USDC
  (req, res) => {
    res.json({
      message: 'Premium data',
      paidBy: req.payment?.payer,
      amount: req.payment?.amount,
    });
  }
);

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

### NestJS

```typescript
import { Module } from '@nestjs/common';
import { X402Guard, X402Module } from '@x402-solana/server/nestjs';
import { UseGuards } from '@nestjs/common';
import { X402Payment } from '@x402-solana/server';

@Module({
  imports: [
    X402Module.forRoot({
      solanaRpcUrl: process.env.SOLANA_RPC_URL!,
      recipientWallet: process.env.RECIPIENT_WALLET!,
      network: 'devnet',
    }),
  ],
})
export class AppModule {}

@Controller('api')
export class ApiController {
  @Get('free')
  getFreeData() {
    return { message: 'Free data' };
  }

  @Get('premium')
  @UseGuards(X402Guard)
  @X402Payment(0.01)  // $0.01 USDC
  getPremiumData(@Request() req) {
    return {
      message: 'Premium data',
      payment: req.payment,
    };
  }
}
```

### Fastify

```typescript
import Fastify from 'fastify';
import x402Plugin from '@x402-solana/server/fastify';

const fastify = Fastify();

await fastify.register(x402Plugin, {
  solanaRpcUrl: process.env.SOLANA_RPC_URL!,
  recipientWallet: process.env.RECIPIENT_WALLET!,
  network: 'devnet',
});

fastify.get('/api/premium', {
  x402: { priceUSD: 0.01 }
}, async (request, reply) => {
  return {
    message: 'Premium data',
    payment: request.payment,
  };
});

await fastify.listen({ port: 3000 });
```

---

## Client Integration

### Basic Usage

```typescript
import { X402Client } from '@x402-solana/client';

const client = new X402Client({
  solanaRpcUrl: process.env.SOLANA_RPC_URL!,
  walletPrivateKey: process.env.WALLET_PRIVATE_KEY!,
  network: 'devnet',
});

// Use exactly like fetch() - payments are automatic!
const response = await client.fetch('http://localhost:3000/api/premium');
const data = await response.json();

console.log('Got premium data:', data);
```

### With Error Handling

```typescript
try {
  const response = await client.fetch('http://localhost:3000/api/premium');

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('Success:', data);

} catch (error) {
  if (error.code === 'INSUFFICIENT_BALANCE') {
    console.error('Not enough USDC in wallet');
  } else if (error.code === 'PAYMENT_TIMEOUT') {
    console.error('Payment took too long to confirm');
  } else {
    console.error('Error:', error.message);
  }
}
```

---

## MCP Integration

### MCP Server with x402

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { X402Client } from '@x402-solana/client';

const client = new X402Client({
  solanaRpcUrl: process.env.SOLANA_RPC_URL!,
  walletPrivateKey: process.env.MCP_WALLET_PRIVATE_KEY!,
  network: 'mainnet-beta',
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'analyze_market') {
    // MCP tool that calls paid API
    const response = await client.fetch(
      'https://api.example.com/analyze',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      }
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(await response.json()),
        },
      ],
    };
  }
});
```

### MCP Tool Definition

```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'analyze_market',
        description: 'Analyze betting market with AI (costs $0.01 USDC)',
        inputSchema: {
          type: 'object',
          properties: {
            marketId: {
              type: 'number',
              description: 'Market ID to analyze',
            },
          },
          required: ['marketId'],
        },
      },
    ],
  };
});
```

---

## AI Agent Integration

### Autonomous Payment Agent

```typescript
import { X402Client } from '@x402-solana/client';

class BettingAgent {
  private client: X402Client;
  private bankroll: number;

  constructor(bankroll: number) {
    this.bankroll = bankroll;
    this.client = new X402Client({
      solanaRpcUrl: process.env.SOLANA_RPC_URL!,
      walletPrivateKey: process.env.AGENT_PRIVATE_KEY!,
      network: 'mainnet-beta',
    });
  }

  async analyzeAndBet() {
    // Step 1: Get free market data
    const markets = await this.client.fetch('https://api.solex.com/api/markets');
    const data = await markets.json();

    // Step 2: Get paid AI recommendations ($0.05)
    const recommendations = await this.client.fetch(
      'https://api.solex.com/api/get-recommendations',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankroll: this.bankroll,
          riskTolerance: 'moderate',
        }),
      }
    );
    const recs = await recommendations.json();

    // Step 3: Execute best bet ($0.10 + 2%)
    const bestBet = recs.recommendations[0];
    const betResult = await this.client.fetch(
      'https://api.solex.com/api/execute-bet',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketAddress: bestBet.marketAddress,
          outcome: bestBet.recommendedOutcome,
          betAmount: bestBet.recommendedAmount,
        }),
      }
    );

    return await betResult.json();
  }
}

// Use the agent
const agent = new BettingAgent(100); // $100 bankroll
const result = await agent.analyzeAndBet();
console.log('Bet placed:', result);
```

---

## Production Deployment

### 1. Switch to Mainnet

```typescript
// Update configuration
const x402 = new X402Middleware({
  solanaRpcUrl: 'https://api.mainnet-beta.solana.com',  // or Helius/QuickNode
  recipientWallet: process.env.MAINNET_TREASURY_WALLET!,
  network: 'mainnet-beta',
});
```

### 2. Add Redis Caching

```bash
# Install Redis
npm install redis

# Update configuration
const x402 = new X402Middleware({
  solanaRpcUrl: process.env.SOLANA_RPC_URL!,
  recipientWallet: process.env.RECIPIENT_WALLET!,
  network: 'mainnet-beta',
  cacheConfig: {
    redisUrl: process.env.REDIS_URL!,
    ttlSeconds: 600,  // 10 minutes
  },
});
```

### 3. Use Production RPC

```bash
# Recommended RPC providers for production
SOLANA_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/YOUR_KEY
# or
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
# or
SOLANA_RPC_URL=https://your-endpoint.quiknode.pro/YOUR_KEY/
```

### 4. Monitor Payments

```typescript
// Add logging
const x402 = new X402Middleware({
  solanaRpcUrl: process.env.SOLANA_RPC_URL!,
  recipientWallet: process.env.RECIPIENT_WALLET!,
  network: 'mainnet-beta',
  debug: true,  // Enable debug logging
});

// Monitor treasury balance
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

async function checkTreasuryBalance() {
  const connection = new Connection(process.env.SOLANA_RPC_URL!);
  const treasuryWallet = new PublicKey(process.env.RECIPIENT_WALLET!);
  const usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

  const treasuryUSDC = getAssociatedTokenAddressSync(usdcMint, treasuryWallet);
  const balance = await connection.getTokenAccountBalance(treasuryUSDC);

  console.log(`Treasury USDC: ${balance.value.uiAmount} USDC`);
}
```

---

## Troubleshooting

### Common Issues

#### 1. "Insufficient USDC balance"

**Solution:**
- Check wallet USDC balance
- Fund wallet with USDC (not SOL!)
- Ensure using correct USDC mint:
  - Devnet: `Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr`
  - Mainnet: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`

#### 2. "Transaction not confirmed"

**Solution:**
- Wait longer (devnet can be slow)
- Check Solana network status
- Use higher commitment level: `'finalized'`
- Increase timeout in client config

#### 3. "Invalid payment header"

**Solution:**
- Ensure client and server use same network
- Check USDC mint address matches
- Verify wallet has USDC (not SOL)

#### 4. "Signature already used"

**Solution:**
- This is replay protection working!
- Don't reuse payment signatures
- Clear cache if testing: `skipCacheCheck: true`

### Debug Mode

```typescript
// Enable debug logging
const client = new X402Client({
  solanaRpcUrl: process.env.SOLANA_RPC_URL!,
  walletPrivateKey: process.env.WALLET_PRIVATE_KEY!,
  network: 'devnet',
  debug: true,  // See all payment steps
});
```

### Check Balances

```bash
# Check SOL balance
solana balance YOUR_WALLET_ADDRESS

# Check USDC balance
spl-token balance --owner YOUR_WALLET_ADDRESS EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

---

## Next Steps

1. **Run Examples**: `cd examples/01-basic-api && npm run demo`
2. **Read Documentation**: See `README.md` and `CLAUDE.md`
3. **Join Community**: GitHub Discussions and Issues
4. **Deploy**: Try Solex betting platform example

---

## Support

- **GitHub**: https://github.com/BOBER3r/x402-solana-toolkit
- **Issues**: https://github.com/BOBER3r/x402-solana-toolkit/issues
- **Examples**: See `/examples` directory
- **Docs**: Full API documentation in `/docs`

---

**Built for the Solana x Anthropic Hackathon 2025**
