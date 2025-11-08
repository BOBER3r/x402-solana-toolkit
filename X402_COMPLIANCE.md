# x402 Protocol Compliance Documentation

## Overview

The x402-solana-toolkit is **fully compliant** with the official x402 protocol specification as defined by Coinbase at https://github.com/coinbase/x402.

This document details our implementation of the x402 protocol for Solana blockchain payments, including compliance verification, architectural decisions, and usage examples.

## Table of Contents

1. [Protocol Overview](#protocol-overview)
2. [Compliance Status](#compliance-status)
3. [Implementation Details](#implementation-details)
4. [Payment Flow](#payment-flow)
5. [Facilitator Endpoints](#facilitator-endpoints)
6. [Type Definitions](#type-definitions)
7. [Security Considerations](#security-considerations)
8. [Testing & Verification](#testing--verification)

---

## Protocol Overview

### What is x402?

x402 is a protocol for micropayments over HTTP, using the `402 Payment Required` status code. It enables:

- **Pay-per-use APIs**: Charge for individual API calls
- **Content monetization**: Require payment for premium content
- **Metered services**: Bill based on actual usage
- **Blockchain payments**: Native integration with various blockchains

### x402 vs L402

While L402 (Lightning HTTP 402) is specific to Bitcoin's Lightning Network, x402 is **blockchain-agnostic** and designed to work with any payment system, including:

- Solana (our implementation)
- Ethereum
- Bitcoin Lightning
- Traditional payment processors

---

## Compliance Status

### ✅ Fully Compliant Features

#### 1. **Payment Requirements Format**
```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "solana-devnet",
      "maxAmountRequired": "1000",
      "resource": "/api/data",
      "description": "Access to premium data",
      "mimeType": "application/json",
      "outputSchema": null,
      "payTo": "TokenAccountAddress...",
      "maxTimeoutSeconds": 300,
      "asset": "USDCMintAddress...",
      "extra": null
    }
  ],
  "error": "Payment Required"
}
```

**Compliance Points:**
- ✅ Uses `scheme: "exact"` for fixed-amount payments
- ✅ Network format: `solana-devnet` or `solana-mainnet`
- ✅ Flat `payTo` string (token account address)
- ✅ `maxTimeoutSeconds` instead of custom `timeout`
- ✅ Includes optional `mimeType`, `outputSchema`, `extra` fields
- ✅ Amount in smallest unit (micro-USDC)

#### 2. **X-PAYMENT Header Format**
```json
{
  "x402Version": 1,
  "scheme": "exact",
  "network": "solana-devnet",
  "payload": {
    "signature": "5j7s6NiJS...",
    "serializedTransaction": "base64..."
  }
}
```

**Compliance Points:**
- ✅ Base64-encoded JSON
- ✅ Supports both `signature` (backwards compat) and `serializedTransaction` (official)
- ✅ Proper scheme and network identifiers
- ✅ Version tracking with `x402Version`

#### 3. **Facilitator Pattern**

Our implementation provides three required facilitator endpoints:

##### `/verify` - Lightweight Validation
```typescript
POST /x402/verify
Content-Type: application/json

{
  "x402Version": 1,
  "paymentHeader": { /* X402Payment object */ },
  "paymentRequirements": { /* PaymentAccept object */ }
}

Response:
{
  "isValid": true,
  "invalidReason": null
}
```

##### `/settle` - On-Chain Verification
```typescript
POST /x402/settle
Content-Type: application/json

{
  "x402Version": 1,
  "paymentHeader": { /* X402Payment object */ },
  "paymentRequirements": { /* PaymentAccept object */ }
}

Response:
{
  "success": true,
  "error": null,
  "txHash": "5j7s6NiJS...",
  "networkId": "solana-devnet"
}
```

##### `/supported` - Capability Discovery
```typescript
GET /x402/supported

Response:
{
  "supported": [
    { "scheme": "exact", "network": "solana-devnet" },
    { "scheme": "exact", "network": "solana-mainnet" }
  ]
}
```

---

## Implementation Details

### Core Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Client    │◄───────►│    Server    │◄───────►│   Solana    │
│  (@client)  │         │  (@server)   │         │  Blockchain │
└─────────────┘         └──────────────┘         └─────────────┘
       │                        │                         │
       │                        │                         │
       ├── X402Client           ├── X402Middleware        ├── USDC Token
       ├── PaymentSender        ├── X402Guard (NestJS)   ├── SPL Token
       └── Auto-402 Handling    ├── x402Plugin (Fastify) └── RPC Calls
                                └── X402Facilitator
```

### Package Structure

#### **@x402-solana/core**
Foundation package with protocol implementation:

- `PaymentRequirementsGenerator` - Creates x402-compliant 402 responses
- `TransactionVerifier` - Verifies Solana USDC payments
- `X402Facilitator` - Implements facilitator pattern
- `parseX402Payment` - Parses and validates X-PAYMENT headers
- `extractSignatureFromSerializedTransaction` - Handles both tx formats

#### **@x402-solana/server**
Framework integrations for Express, NestJS, Fastify:

- `X402Middleware` (Express) - Drop-in middleware
- `X402Guard` (NestJS) - Decorator-based guards
- `x402Plugin` (Fastify) - Plugin-based integration
- `createFacilitatorRoutes` - Facilitator endpoints

#### **@x402-solana/client**
Automatic payment client:

- `X402Client` - Auto-handles 402 responses
- `PaymentSender` - Low-level payment utilities
- Smart retry logic with exponential backoff

---

## Payment Flow

### End-to-End Flow Diagram

```
┌─────────┐                                    ┌─────────┐
│ Client  │                                    │ Server  │
└────┬────┘                                    └────┬────┘
     │                                              │
     │ 1. GET /api/premium (no payment)             │
     │─────────────────────────────────────────────►│
     │                                              │
     │ 2. 402 Payment Required + Requirements      │
     │◄─────────────────────────────────────────────│
     │    {                                         │
     │      "accepts": [{                           │
     │        "scheme": "exact",                    │
     │        "payTo": "TokenAccount...",           │
     │        "maxAmountRequired": "1000"           │
     │      }]                                      │
     │    }                                         │
     │                                              │
     │ 3. Create & Send USDC Payment                │
     │────────────────────────────►┌──────────┐    │
     │                              │  Solana  │    │
     │ 4. Transaction Confirmed     │Blockchain│    │
     │◄─────────────────────────────└──────────┘    │
     │                                              │
     │ 5. GET /api/premium + X-PAYMENT header       │
     │─────────────────────────────────────────────►│
     │    X-PAYMENT: base64(JSON)                   │
     │                                              │
     │                              6. Verify Payment
     │                              ┌──────────┐    │
     │                              │  Solana  │    │
     │                              │Blockchain│◄───┤
     │                              └──────────┘    │
     │                                              │
     │ 7. 200 OK + Content + X-PAYMENT-RESPONSE     │
     │◄─────────────────────────────────────────────│
     │    X-PAYMENT-RESPONSE: receipt               │
     │                                              │
```

### Step-by-Step Explanation

**Step 1: Initial Request (No Payment)**
```http
GET /api/premium HTTP/1.1
Host: api.example.com
```

**Step 2: Server Returns 402**
```http
HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "x402Version": 1,
  "accepts": [{
    "scheme": "exact",
    "network": "solana-devnet",
    "maxAmountRequired": "1000",
    "payTo": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "asset": "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr",
    "resource": "/api/premium",
    "description": "Access to premium API",
    "mimeType": "application/json",
    "maxTimeoutSeconds": 300
  }],
  "error": "Payment Required"
}
```

**Step 3: Client Creates Payment**
```typescript
// Client automatically:
// 1. Parses payment requirements
// 2. Creates USDC transfer transaction
// 3. Signs and sends to Solana
// 4. Waits for confirmation
const signature = await createUSDCPayment(1000, recipientAccount);
```

**Step 4: Transaction Confirmed on Solana**
```
Transaction: 5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tpr...
Status: Confirmed
Amount: 0.001 USDC (1000 micro-USDC)
From: ClientTokenAccount
To: ServerTokenAccount
```

**Step 5: Retry with Payment Proof**
```http
GET /api/premium HTTP/1.1
Host: api.example.com
X-PAYMENT: eyJ4NDAyVmVyc2lvbiI6MSwic2NoZW1lIjoiZXhhY3QiLCJuZXR3b3JrIjoic29sYW5hLWRldm5ldCIsInBheWxvYWQiOnsic2lnbmF0dXJlIjoiNWo3czZOaUpTM0pBa3Zna29jMThXVkFzaVNhY2kycHhCMkE2dWVDSlA0dHByQTJURmc5d1N5VExlWW91eFBCSkVNekppbkVOVGtwQTUyWVN0Ulc1RGlhNyJ9fQ==
```

**Step 6: Server Verifies Payment**
```typescript
// Server automatically:
// 1. Parses X-PAYMENT header
// 2. Extracts signature
// 3. Fetches transaction from Solana
// 4. Verifies:
//    - Transaction succeeded
//    - Correct amount
//    - Correct recipient
//    - Within time window
//    - Not a replay attack
```

**Step 7: Success Response**
```http
HTTP/1.1 200 OK
Content-Type: application/json
X-PAYMENT-RESPONSE: eyJzaWduYXR1cmUiOiI1ajdzNk5pSlMzSkFrdmdrb2MxOFdWQXNpU2FjaTJweEIyQTZ1ZUNKUDR0cHJBMlRGZzl3U3lUTGVZb3V4UEJKRU16SmluRU5Ua3BBNTI...

{
  "data": "premium content here"
}
```

---

## Facilitator Endpoints

### Purpose of Facilitators

Facilitators provide a standardized way to verify payments without exposing blockchain node access. Benefits:

1. **Abstraction**: Clients don't need blockchain node URLs
2. **Caching**: Facilitators can cache verification results
3. **Rate Limiting**: Control verification request rates
4. **Analytics**: Track payment patterns
5. **Multi-chain**: Single interface for multiple blockchains

### Implementation Example (Express)

```typescript
import express from 'express';
import { createFacilitatorRoutes } from '@x402-solana/server';

const app = express();
app.use(express.json());

// Create facilitator routes
const facilitatorRoutes = createFacilitatorRoutes({
  rpcUrl: 'https://api.devnet.solana.com',
  commitment: 'confirmed',
  debug: true,
});

// Mount routes
app.use('/x402', facilitatorRoutes);

// Now available:
// POST /x402/verify
// POST /x402/settle
// GET /x402/supported

app.listen(3000);
```

### Verify Endpoint Details

**Purpose**: Lightweight validation without blockchain calls

**Use Cases**:
- Quick format validation
- Scheme/network compatibility check
- Pre-flight validation

**Example**:
```typescript
const response = await fetch('https://facilitator.example.com/x402/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    x402Version: 1,
    paymentHeader: {
      x402Version: 1,
      scheme: 'exact',
      network: 'solana-devnet',
      payload: { signature: '5j7s...' }
    },
    paymentRequirements: {
      scheme: 'exact',
      network: 'solana-devnet',
      maxAmountRequired: '1000',
      payTo: '7xKXtg...',
      asset: 'Gh9ZwE...',
      // ... other fields
    }
  })
});

const result = await response.json();
// { "isValid": true, "invalidReason": null }
```

### Settle Endpoint Details

**Purpose**: Full on-chain payment verification

**Use Cases**:
- Final payment confirmation
- Blockchain state verification
- Transaction validation

**Example**:
```typescript
const response = await fetch('https://facilitator.example.com/x402/settle', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    x402Version: 1,
    paymentHeader: { /* ... */ },
    paymentRequirements: { /* ... */ }
  })
});

const result = await response.json();
// {
//   "success": true,
//   "error": null,
//   "txHash": "5j7s6NiJS...",
//   "networkId": "solana-devnet"
// }
```

### Supported Endpoint Details

**Purpose**: Capability discovery

**Use Cases**:
- Client capability negotiation
- Network support detection
- Scheme compatibility check

**Example**:
```typescript
const response = await fetch('https://facilitator.example.com/x402/supported');
const result = await response.json();
// {
//   "supported": [
//     { "scheme": "exact", "network": "solana-devnet" },
//     { "scheme": "exact", "network": "solana-mainnet" }
//   ]
// }
```

---

## Type Definitions

### Official x402 Types (from @x402-solana/core)

#### PaymentRequirements
```typescript
export interface PaymentRequirements {
  /** x402 protocol version (always 1) */
  x402Version: number;

  /** List of accepted payment methods */
  accepts: PaymentAccept[];

  /** Error message describing why payment is required */
  error: string;
}
```

#### PaymentAccept
```typescript
export interface PaymentAccept {
  /** Payment scheme - use 'exact' for fixed-amount payments */
  scheme: string;

  /** Network identifier (e.g., 'solana-devnet', 'solana-mainnet') */
  network: string;

  /** Maximum amount required in smallest unit (micro-USDC) */
  maxAmountRequired: string;

  /** Resource being paid for */
  resource: string;

  /** Description of what payment is for */
  description: string;

  /** MIME type of the resource (e.g., 'application/json') */
  mimeType: string;

  /** Optional JSON schema for response output */
  outputSchema?: object | null;

  /** Payment destination address (token account for Solana) */
  payTo: string;

  /** Timeout in seconds for payment to be valid */
  maxTimeoutSeconds: number;

  /** Asset identifier (e.g., USDC mint address) */
  asset: string;

  /** Optional additional data (scheme-specific) */
  extra?: object | null;
}
```

#### X402Payment
```typescript
export interface X402Payment {
  /** x402 protocol version */
  x402Version: number;

  /** Payment scheme used */
  scheme: string;

  /** Network where payment was made */
  network: string;

  /** Payment-specific data */
  payload: PaymentPayload;
}
```

#### PaymentPayload
```typescript
export interface PaymentPayload {
  /** Transaction signature (backwards compatibility) */
  signature?: string;

  /** Serialized transaction (official x402 format) */
  serializedTransaction?: string;

  /** Optional additional data */
  [key: string]: any;
}
```

---

## Security Considerations

### 1. **Replay Attack Prevention**

**Problem**: Attacker could reuse valid payment signatures

**Solution**: Transaction signature caching with TTL

```typescript
// In-memory or Redis cache
const verifier = new TransactionVerifier({
  rpcUrl: 'https://api.devnet.solana.com',
  cacheConfig: {
    redisUrl: process.env.REDIS_URL, // Optional
    ttlSeconds: 600, // 10 minutes
  },
});

// Signature is checked against cache before verification
// If found, immediately returns replay attack error
```

### 2. **Payment Timing Attacks**

**Problem**: Old transactions could be submitted as payment

**Solution**: Time-window validation

```typescript
// Only accept payments from last 5 minutes
const result = await verifier.verifyPayment(
  signature,
  recipientAccount,
  priceUSD,
  {
    maxAgeMs: 300_000, // 5 minutes
    commitment: 'confirmed',
  }
);
```

### 3. **Amount Verification**

**Problem**: Attacker submits lower-amount transaction

**Solution**: Strict amount matching with tolerance

```typescript
// Verifies exact amount or higher
// Allows small overpayment but never underpayment
const result = await verifier.verifyPayment(
  signature,
  recipientAccount,
  0.001, // Requires >= 0.001 USDC
  options
);
```

### 4. **Network Isolation**

**Problem**: Mainnet payment used on devnet or vice versa

**Solution**: Network validation in payment requirements

```typescript
// Payment requirements specify network
{
  "network": "solana-devnet",
  "asset": "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr" // Devnet USDC
}

// Verification checks network matches
if (payment.network !== requirement.network) {
  return { valid: false, error: 'Network mismatch' };
}
```

### 5. **Signature Validation**

**Problem**: Invalid signature format causes crashes

**Solution**: Format validation before processing

```typescript
// Validates base58 format and length
if (!isValidSignature(signature)) {
  return { valid: false, error: 'Invalid signature format' };
}
```

---

## Testing & Verification

### Compliance Test Suite

We provide comprehensive tests verifying x402 compliance:

```bash
# Run full test suite
npm test

# Test specific compliance areas
npm test -- --testNamePattern="x402 compliance"
```

### Manual Verification Steps

#### 1. **Payment Requirements Format**
```bash
curl -X GET http://localhost:3000/api/premium \
  -H "Accept: application/json"

# Should return 402 with x402-compliant format
```

#### 2. **Payment Processing**
```bash
# Send payment with X-PAYMENT header
curl -X GET http://localhost:3000/api/premium \
  -H "X-PAYMENT: eyJ4NDAyVmVyc2lvbiI6MSwi..." \
  -H "Accept: application/json"

# Should return 200 with content and X-PAYMENT-RESPONSE header
```

#### 3. **Facilitator Endpoints**
```bash
# Verify endpoint
curl -X POST http://localhost:3000/x402/verify \
  -H "Content-Type: application/json" \
  -d '{"x402Version":1,"paymentHeader":{...},"paymentRequirements":{...}}'

# Settle endpoint
curl -X POST http://localhost:3000/x402/settle \
  -H "Content-Type: application/json" \
  -d '{"x402Version":1,"paymentHeader":{...},"paymentRequirements":{...}}'

# Supported endpoint
curl -X GET http://localhost:3000/x402/supported
```

### Integration Testing

```typescript
import { X402Client } from '@x402-solana/client';
import { X402Middleware } from '@x402-solana/server';

describe('x402 Integration', () => {
  it('should complete full payment flow', async () => {
    // Setup server
    const middleware = new X402Middleware({
      solanaRpcUrl: 'https://api.devnet.solana.com',
      recipientWallet: 'recipient-wallet',
      network: 'devnet',
    });

    // Setup client
    const client = new X402Client({
      solanaRpcUrl: 'https://api.devnet.solana.com',
      walletPrivateKey: 'private-key',
      network: 'devnet',
    });

    // Client automatically handles 402 and payment
    const response = await client.fetch('http://localhost:3000/api/premium');

    expect(response.status).toBe(200);
    expect(response.headers.get('X-PAYMENT-RESPONSE')).toBeDefined();
  });
});
```

---

## Changelog

### Version 0.2.0 (Current)
- ✅ Full x402 protocol compliance
- ✅ Changed scheme from 'solana-usdc' to 'exact'
- ✅ Changed network format to 'solana-devnet'/'solana-mainnet'
- ✅ Converted payTo from object to string
- ✅ Renamed timeout to maxTimeoutSeconds
- ✅ Added mimeType, outputSchema, extra fields
- ✅ Implemented X402Facilitator with all 3 endpoints
- ✅ Added support for serializedTransaction format
- ✅ Comprehensive x402-parser utility
- ✅ Updated all frameworks (Express, NestJS, Fastify)

### Version 0.1.0 (Legacy)
- Custom Solana implementation
- Non-standard format
- Limited framework support

---

## References

- **Official x402 Specification**: https://github.com/coinbase/x402
- **Solana Documentation**: https://docs.solana.com
- **USDC on Solana**: https://www.circle.com/en/usdc-multichain/solana
- **SPL Token Program**: https://spl.solana.com/token

---

## Support & Contributing

- **Issues**: https://github.com/BOBER3r/x402-solana-toolkit/issues
- **Discussions**: https://github.com/BOBER3r/x402-solana-toolkit/discussions
- **Documentation**: https://docs.x402-solana.dev

---

**Last Updated**: 2025-01-04
**Protocol Version**: x402 v1
**Toolkit Version**: 0.2.0
