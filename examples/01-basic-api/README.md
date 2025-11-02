# Basic x402 API Example

The **simplest possible** x402 integration. Shows how to add micropayments to your API in just a few lines of code.

## What This Shows

- **Free endpoint** - no payment required
- **Paid endpoint** - $0.001 per request
- **Minimal code** - less than 50 lines for the server, 30 for the client
- **Easy integration** - just add one line to any Express route

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your values:
- `RECIPIENT_WALLET` - Your wallet public key (receives payments)
- `WALLET_PRIVATE_KEY` - Client wallet private key in base58 format (pays for requests)

### 3. Run the Demo

Option A - Run both server and client automatically:
```bash
npm run demo
```

Option B - Run separately:
```bash
# Terminal 1 - Start server
npm run server

# Terminal 2 - Run client
npm run client
```

## How It Works

### Server (server.ts)

Add payment requirement in **just one line**:

```typescript
import { X402Middleware } from '@x402-solana/server';

const x402 = new X402Middleware({
  solanaRpcUrl: 'https://api.devnet.solana.com',
  recipientWallet: process.env.RECIPIENT_WALLET,
  network: 'devnet',
});

// Free endpoint
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Free!' });
});

// Paid endpoint - just add this middleware!
app.get('/api/premium-hello',
  x402.requirePayment(0.001),  // <- Just this line!
  (req, res) => {
    res.json({
      message: 'Premium!',
      paidBy: req.payment?.payer,
    });
  }
);
```

### Client (client.ts)

Use exactly like `fetch()`:

```typescript
import { X402Client } from '@x402-solana/client';

const client = new X402Client({
  solanaRpcUrl: 'https://api.devnet.solana.com',
  walletPrivateKey: process.env.WALLET_PRIVATE_KEY,
  network: 'devnet',
});

// Works exactly like fetch(), but handles payments automatically!
const response = await client.fetch('http://localhost:3000/api/premium-hello');
const data = await response.json();
```

That's it! Payments are handled automatically.

## Understanding the Flow

1. **First request** - Client tries to access paid endpoint
2. **402 response** - Server returns payment requirements
3. **Auto payment** - Client automatically sends USDC on Solana
4. **Retry** - Client retries request with payment proof
5. **Success** - Server verifies payment and returns data

All of this happens **automatically** with x402!

## Expected Output

```
=== Basic x402 Client Demo ===

1. Calling FREE endpoint...
   Response: { message: 'Hello! This endpoint is free.', timestamp: '...' }

2. Calling PAID endpoint ($0.001)...
   Response: {
     message: 'Premium hello! You paid for this.',
     paidBy: 'your-wallet-address',
     amount: '$0.001',
     timestamp: '...'
   }
   Payment verified! Paid by: your-wallet-address

=== Demo complete! ===
```

## Pricing

The server uses these prices:
- `/api/hello` - **FREE**
- `/api/premium-hello` - **$0.001 (0.1 cents)**

Change the price by updating the first parameter:
```typescript
x402.requirePayment(0.01)  // $0.01 (1 cent)
x402.requirePayment(0.10)  // $0.10 (10 cents)
x402.requirePayment(1.00)  // $1.00
```

## Next Steps

- See `examples/03-weather-api/` for tiered pricing
- See `examples/02-solex-betting/` for a complete app
- Read the [main README](../../README.md) for advanced features

## Troubleshooting

**"Recipient wallet not found"**
- Make sure `.env` has `RECIPIENT_WALLET` set to a valid Solana public key

**"Insufficient funds"**
- Make sure your client wallet has devnet USDC
- Get devnet SOL: https://faucet.solana.com
- Get devnet USDC: https://spl-token-faucet.com

**"Payment verification failed"**
- Check that both server and client are using the same network (devnet)
- Verify the recipient wallet address matches

## Learn More

- [x402 Protocol Spec](https://github.com/Anthropic/x402)
- [Solana Devnet Faucet](https://faucet.solana.com)
- [x402 Solana Toolkit Docs](../../README.md)
