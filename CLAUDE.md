# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

x402-solana-toolkit is a production-grade TypeScript library that enables HTTP APIs on Solana to implement x402 payment protocol. The toolkit is framework-agnostic and handles the complete payment lifecycle: requirement generation, USDC verification on-chain, payment receipt creation, and error recovery.

**Target:** Best x402 Dev Tool (Hackathon)

## Monorepo Structure

This is a monorepo with multiple packages:

- `packages/core/` - Core payment verification and x402 protocol implementation
- `packages/server/` - Server-side integrations (Express, NestJS, Fastify)
- `packages/client/` - Client-side SDK for automatic payment handling
- `packages/mcp/` - Model Context Protocol integration with x402 payments
- `packages/kora/` - Kora gasless transaction integration (optional)
- `examples/` - Example implementations and use cases
- `docs/` - Comprehensive documentation

## Development Commands

```bash
# Install dependencies (from root)
npm install

# Build all packages
npm run build

# Run tests
npm test

# Run tests for specific package
npm test -- --filter=@x402-solana/core

# Lint code
npm run lint

# Run single test file
npm test packages/core/tests/unit/transaction-verifier.test.ts

# Development mode with watch
npm run dev

# Publish to npm
npm run publish
```

## Architecture

### Package Dependencies

```
@x402-solana/core (no dependencies on other packages)
    ↓
@x402-solana/server (depends on core)
@x402-solana/client (depends on core)
@x402-solana/mcp (depends on core + server + client)
@x402-solana/kora (standalone)
```

### Critical Architectural Points

#### 1. Transaction Verification Flow

The core challenge is parsing Solana transactions to extract SPL token transfers:

- Transactions can have multiple instructions (outer + inner)
- Token transfers use Associated Token Accounts (ATAs), not wallet addresses
- Must support both legacy and versioned transactions
- Payment destination MUST be the recipient's USDC token account (not wallet pubkey)

Key file: `packages/core/src/verifier/transaction-verifier.ts`

#### 2. Payment Requirements Generation

When returning 402 responses, the `payTo.address` field MUST contain the recipient's USDC token account address (derived ATA), not their wallet address. This is a common mistake that will cause client payments to fail.

Key file: `packages/core/src/generator/payment-requirements.ts`

#### 3. Replay Attack Prevention

Payment signatures are cached (Redis or in-memory) with TTL to prevent reuse. The cache TTL must be at least as long as `maxAgeMs` (default 5 minutes).

Key file: `packages/core/src/verifier/payment-cache.ts`

#### 4. USDC Mint Addresses

- Devnet: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
- Mainnet: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`

#### 5. Amount Conversion

USD amounts must be converted to micro-USDC (6 decimals):
- 1 USD = 1,000,000 micro-USDC
- Always use `Math.floor()` to avoid floating-point issues
- Allow `>=` comparison (not exact match) for amount verification to handle rounding

### Error Handling Patterns

1. **No Payment** (client hasn't paid yet): Return 402 with payment requirements
2. **Invalid Payment** (wrong amount, expired, etc.): Return 402 with error message explaining what's wrong
3. **Internal Error** (RPC failure, verification error): Return 500 with error details
4. **Replay Attack** (signature already used): Return 402 with "Payment already used" error

### Testing Requirements

- All core verification logic must have unit tests with mocked Solana RPC
- Integration tests must use Solana devnet with real USDC transfers
- Performance tests should verify 1000+ concurrent payment verifications
- Security tests must verify replay attack prevention and timing validation

## Key Implementation Notes

### Transaction Parsing

SPL Token Transfer instruction format:
- Byte 0: discriminator (3 = Transfer, 12 = TransferChecked)
- Bytes 1-8: amount (u64, little-endian)
- Account 0: source token account
- Account 1: destination token account
- Account 2: authority

### Associated Token Accounts

Always derive ATAs using:
```typescript
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

const usdcAccount = getAssociatedTokenAddressSync(
  usdcMint,
  walletPublicKey
);
```

### Transaction Confirmation

Always wait for transaction confirmation before considering payment complete:

```typescript
await connection.confirmTransaction({
  signature,
  blockhash,
  lastValidBlockHeight,
}, 'confirmed');
```

Using `'confirmed'` commitment level provides a good balance between speed and finality.

### RPC Reliability

Implement exponential backoff for RPC calls (100ms, 200ms, 400ms). Solana RPC can be unreliable, especially on devnet.

### Reverse Payments (Server Pays Client)

When creating ATAs for recipients, check if the account exists first:
```typescript
const accountInfo = await connection.getAccountInfo(destAccount);
if (!accountInfo) {
  // Create ATA (costs ~0.002 SOL rent)
  transaction.add(createAssociatedTokenAccountInstruction(...));
}
```

## Security Considerations

1. **Signature Validation**: Always verify transaction signature exists on-chain
2. **Amount Verification**: Ensure paid amount is >= expected (allow overpayment)
3. **Recipient Verification**: Verify destination matches expected USDC token account
4. **Timing Validation**: Reject transactions older than `maxAgeMs` (default 5 min)
5. **Mint Verification**: Verify token mint is actually USDC
6. **Replay Prevention**: Cache used signatures with appropriate TTL

## Code Style

- Use TypeScript strict mode
- Export types from dedicated `types/` files
- Use async/await (no callbacks)
- Include JSDoc comments on all public APIs
- Prefix internal methods with `private`
- Use descriptive error messages that help developers debug

## Common Pitfalls to Avoid

1. **Wrong Address Type**: Using wallet address instead of token account address in payment requirements
2. **No Confirmation Wait**: Sending payment and immediately retrying without waiting for confirmation
3. **Exact Amount Match**: Requiring exact amount match instead of >= comparison
4. **Missing Replay Check**: Not checking payment cache before verification
5. **Float Precision**: Using floating-point arithmetic for currency conversion
6. **RPC Errors**: Not implementing retry logic for RPC failures
7. **ATA Existence**: Assuming recipient's token account exists when sending reverse payments

## Framework Integration Patterns

### Express
Use middleware function: `requirePayment(priceUSD)`

### NestJS
Use guard: `@RequirePayment(priceUSD)` decorator on routes

### Fastify
Use plugin: `fastify.register(x402Plugin, config)`

All integrations delegate to `@x402-solana/core` for actual verification.

## NPM Publishing

Packages should be published with scope `@x402-solana/`:
- `@x402-solana/core`
- `@x402-solana/server`
- `@x402-solana/client`
- `@x402-solana/mcp`
- `@x402-solana/kora`

Use Lerna or Turborepo for monorepo publishing.

## Environment Variables

```bash
# Required for server packages
SOLANA_RPC_URL=https://api.devnet.solana.com
RECIPIENT_WALLET=<base58-public-key>
NETWORK=devnet

# Optional
REDIS_URL=redis://localhost:6379
MAX_PAYMENT_AGE_MS=300000
```

## Reference Specification

See `REPO_1_X402_SOLANA_TOOLKIT.md` for complete specification including:
- Detailed transaction verification implementation
- Payment requirements generation
- All package interfaces
- Security considerations
- Production readiness checklist
