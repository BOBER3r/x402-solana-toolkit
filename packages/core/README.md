# @x402-solana/core

Core payment verification and x402 protocol implementation for Solana.

[![npm version](https://img.shields.io/npm/v/@x402-solana/core.svg)](https://www.npmjs.com/package/@x402-solana/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![x402](https://img.shields.io/badge/x402-v1%20Compliant-success)](https://github.com/coinbase/x402)

## Overview

`@x402-solana/core` provides the foundational building blocks for implementing **official x402 micropayments** on Solana. It handles the complex tasks of verifying USDC transactions on-chain, preventing replay attacks, and generating x402-compliant payment requirements.

> **🏆 x402 v1 Compliant**: Fully implements the official x402 protocol specification. See [X402_COMPLIANCE.md](../../X402_COMPLIANCE.md) for details.

This is a low-level package typically used by server frameworks. **Most users should use [@x402-solana/server](https://www.npmjs.com/package/@x402-solana/server) or [@x402-solana/client](https://www.npmjs.com/package/@x402-solana/client) instead.**

## Installation

```bash
npm install @x402-solana/core @solana/web3.js
```

## Features

- ✅ **x402 v1 Compliant** - Official protocol implementation
- ✅ **Transaction Verification** - Parse and verify Solana transactions
- ✅ **Payment Channels** (NEW in v0.3.0) - Off-chain instant micropayments
- ✅ **USDC Validation** - Validate SPL token transfers on-chain
- ✅ **Replay Protection** - Prevent payment signature reuse
- ✅ **Payment Requirements** - Generate x402-compliant 402 responses
- ✅ **Facilitator Pattern** - `/verify`, `/settle`, `/supported` endpoints
- ✅ **Flexible Format** - Supports `serializedTransaction` and `signature`
- ✅ **Network Support** - Works with devnet and mainnet-beta
- ✅ **Legacy & Versioned** - Supports both transaction formats
- ✅ **Dual Schemes** - On-chain (`exact`) and off-chain (`channel`)

## Payment Schemes

Starting with **v0.3.0**, this package supports TWO payment schemes:

### 1. On-Chain Payments (`scheme: 'exact'`)
Traditional USDC transactions verified on Solana blockchain:
- **Latency:** 400-800ms
- **Cost:** ~$0.0005 per payment
- **Best for:** Low-frequency, sporadic usage

### 2. Payment Channels (`scheme: 'channel'`) - NEW!
Off-chain cryptographic claims verified instantly:
- **Latency:** <10ms
- **Cost:** $0 per payment (after channel setup)
- **Best for:** High-frequency (100+ req/hr), streaming data, AI billing

See [CHANNEL_PAYMENTS.md](./CHANNEL_PAYMENTS.md) for full documentation.

## Quick Start

### Verify an On-Chain Payment

```typescript
import { TransactionVerifier } from '@x402-solana/core';
import { Connection } from '@solana/web3.js';

const connection = new Connection('https://api.devnet.solana.com');
const verifier = new TransactionVerifier(connection, {
  network: 'devnet',
});

// Verify a USDC payment transaction
const result = await verifier.verifyPayment({
  signature: '5j7s...3xY2',
  expectedRecipient: 'YourUSDCTokenAccount...',
  expectedAmountUSD: 0.01,
  maxAgeMs: 300000, // 5 minutes
});

if (result.valid) {
  console.log('Payment verified!');
  console.log('Payer:', result.payer);
  console.log('Amount:', result.amount, 'USDC');
} else {
  console.error('Payment invalid:', result.error);
}
```

### Generate Payment Requirements

```typescript
import { PaymentRequirementsGenerator } from '@x402-solana/core';

const generator = new PaymentRequirementsGenerator({
  recipientWallet: 'YourWalletPublicKey...',
  network: 'devnet',
});

// Generate x402 payment requirements
const requirements = generator.generate(0.01, {
  description: 'API access payment',
  resource: '/api/premium-data',
  timeoutSeconds: 300,
});

// Return in 402 response
res.status(402).json(requirements);
```

### Verify a Channel Payment (NEW in v0.3.0)

```typescript
import { TransactionVerifier } from '@x402-solana/core';

const verifier = new TransactionVerifier({
  rpcUrl: 'https://api.devnet.solana.com',
  commitment: 'confirmed',
});

// Payment requirements for channel scheme
const requirements = {
  scheme: 'channel',  // ← Off-chain payment channel
  network: 'solana-devnet',
  payTo: 'ServerWalletPubkey...',
  maxAmountRequired: '10000',  // $0.01
  resource: '/api/data',
  description: 'API access',
  mimeType: 'application/json',
  asset: 'USDC',
  maxTimeoutSeconds: 300,
};

// Verify channel payment (<10ms, $0 fee)
const result = await verifier.verifyX402Payment(
  req.headers['x-payment'],
  requirements,
  {},
  process.env.CHANNEL_PROGRAM_ID  // Required for channels!
);

if (result.valid) {
  console.log('✅ Channel payment verified instantly!');
  console.log('Amount:', result.transfer?.amount, 'micro-USDC');
}
```

See [CHANNEL_PAYMENTS.md](./CHANNEL_PAYMENTS.md) for complete guide.

### Prevent Replay Attacks

```typescript
import { PaymentCache } from '@x402-solana/core';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
const cache = new PaymentCache({ redis });

// Check if signature was already used
const isUsed = await cache.isUsed(signature);
if (isUsed) {
  throw new Error('Payment already used');
}

// Mark signature as used
await cache.markUsed(signature, 86400); // 24 hours TTL
```

## Core Components

### TransactionVerifier

Verifies Solana transactions contain valid USDC transfers.

```typescript
interface VerificationOptions {
  network?: 'devnet' | 'mainnet-beta';
  maxAgeMs?: number;
  strictMintCheck?: boolean;
}

interface VerificationResult {
  valid: boolean;
  error?: string;
  code?: string;
  amount?: number;
  payer?: string;
  timestamp?: number;
  debug?: any;
}
```

**Key Features:**
- Fetches transactions from Solana RPC
- Parses SPL token transfer instructions
- Validates amount, recipient, and timing
- Handles both legacy and versioned transactions
- Provides detailed error information

### USDCVerifier

Validates USDC transfer details within a transaction.

```typescript
verifyUSDCTransfer(
  transfers: USDCTransfer[],
  expectedRecipient: string,
  expectedAmountUSD: number,
  options?: {
    network?: 'devnet' | 'mainnet-beta';
    strictMintCheck?: boolean;
  }
): VerificationResult
```

**Validates:**
- ✅ Transfer destination matches expected recipient
- ✅ Transfer amount >= expected amount (allows overpayment)
- ✅ Token mint is USDC (devnet or mainnet)
- ✅ Amount precision (6 decimals for USDC)

### PaymentRequirementsGenerator

Generates x402 protocol payment requirement responses.

```typescript
generate(
  priceUSD: number,
  options?: {
    description?: string;
    resource?: string;
    timeoutSeconds?: number;
    errorMessage?: string;
  }
): PaymentRequirements
```

**Output Format:**
```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "solana-usdc",
      "network": "solana-devnet",
      "maxAmountRequired": "10000",
      "resource": "/api/data",
      "description": "Payment required",
      "payTo": {
        "address": "TokenAccount...",
        "asset": "Gh9ZwEm..."
      },
      "timeout": 300
    }
  ],
  "error": "Payment Required"
}
```

### PaymentCache

Redis-backed cache for preventing replay attacks.

```typescript
// In-memory cache (development)
const cache = new PaymentCache();

// Redis cache (production)
const cache = new PaymentCache({
  redis: new Redis(process.env.REDIS_URL),
  keyPrefix: 'x402:',
});

await cache.isUsed(signature);
await cache.markUsed(signature, ttlSeconds);
```

## API Reference

### USDC Mint Addresses

```typescript
import { USDC_MINT_ADDRESSES } from '@x402-solana/core';

// Devnet: Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr
// Mainnet: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

### Address Validation

```typescript
import {
  isValidSolanaAddress,
  isUSDCMint,
  getUSDCMint,
  deriveUSDCTokenAccount
} from '@x402-solana/core';

isValidSolanaAddress('YourAddress...');
isUSDCMint('Gh9ZwEm...', 'devnet');
const mint = getUSDCMint('mainnet-beta');
const tokenAccount = await deriveUSDCTokenAccount(walletPubkey, mint);
```

### Transaction Parsing

```typescript
import { extractUSDCTransfers } from '@x402-solana/core';

const transfers = extractUSDCTransfers(transaction, 'devnet');
// Returns: USDCTransfer[]
```

## Error Codes

### On-Chain (scheme: 'exact')

| Code | Description |
|------|-------------|
| `TRANSACTION_NOT_FOUND` | Signature doesn't exist on-chain |
| `TRANSACTION_FAILED` | Transaction executed but failed |
| `NO_USDC_TRANSFER` | No USDC transfers found in transaction |
| `INSUFFICIENT_AMOUNT` | Payment amount too low |
| `WRONG_RECIPIENT` | Payment sent to wrong address |
| `PAYMENT_EXPIRED` | Transaction too old |
| `INVALID_SIGNATURE` | Malformed transaction signature |
| `REPLAY_ATTACK` | Signature already used |

### Payment Channels (scheme: 'channel') - NEW in v0.3.0

| Code | Description |
|------|-------------|
| `CHANNEL_NOT_FOUND` | Channel PDA not found on-chain |
| `CHANNEL_NOT_OPEN` | Channel is Closed or Disputed |
| `CHANNEL_INVALID_SIGNATURE` | Ed25519 signature verification failed |
| `CHANNEL_INVALID_NONCE` | Nonce not strictly increasing |
| `CHANNEL_AMOUNT_BACKWARDS` | Claimed amount < previous claim |
| `CHANNEL_INSUFFICIENT_BALANCE` | Claim exceeds deposit + credit |
| `CHANNEL_CLAIM_EXPIRED` | Claim past expiry timestamp |
| `CHANNEL_WRONG_SERVER` | Server pubkey mismatch |
| `CHANNEL_INVALID_PAYLOAD` | Malformed channel payload |

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Network Configuration

### Devnet
- **RPC:** `https://api.devnet.solana.com`
- **USDC Mint:** `Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr`
- **Faucet:** https://spl-token-faucet.com

### Mainnet
- **RPC:** `https://api.mainnet-beta.solana.com`
- **USDC Mint:** `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`

## Related Packages

- **[@x402-solana/server](https://www.npmjs.com/package/@x402-solana/server)** - Express/NestJS/Fastify middleware
- **[@x402-solana/client](https://www.npmjs.com/package/@x402-solana/client)** - Automatic payment client

## Documentation

- [Full Documentation](https://github.com/BOBER3r/x402-solana-toolkit)
- [Getting Started Guide](https://github.com/BOBER3r/x402-solana-toolkit/blob/main/GETTING_STARTED.md)
- [Examples](https://github.com/BOBER3r/x402-solana-toolkit/tree/main/examples)

## License

MIT © 2025

## Support

- [GitHub Issues](https://github.com/BOBER3r/x402-solana-toolkit/issues)
- [npm Package](https://www.npmjs.com/package/@x402-solana/core)
