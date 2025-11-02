# @x402-solana/client

Client SDK for automatic x402 payment handling on Solana.

[![npm version](https://img.shields.io/npm/v/@x402-solana/client.svg)](https://www.npmjs.com/package/@x402-solana/client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

`@x402-solana/client` provides a drop-in replacement for native `fetch()` that automatically handles x402 micropayments on Solana. When your code requests a paid API endpoint, this client:

1. ✅ **Detects 402 Payment Required** responses
2. ✅ **Creates USDC payment** on Solana automatically
3. ✅ **Waits for confirmation** (400-800ms)
4. ✅ **Retries request** with payment proof
5. ✅ **Returns data** seamlessly

**Perfect for AI agents, CLI tools, and automated systems that need to pay for API access.**

## Installation

```bash
npm install @x402-solana/client @solana/web3.js
```

## Quick Start

```typescript
import { X402Client } from '@x402-solana/client';

const client = new X402Client({
  solanaRpcUrl: 'https://api.devnet.solana.com',
  walletPrivateKey: process.env.WALLET_PRIVATE_KEY, // Base58 encoded
  network: 'devnet',
});

// Use exactly like fetch() - payments happen automatically!
const response = await client.fetch('https://api.example.com/premium-data');
const data = await response.json();

console.log('Got data:', data);
// Payment was handled automatically behind the scenes!
```

**That's it!** The client handles all payment complexity for you.

## Features

- ✅ **Drop-in Fetch Replacement** - Same API as native `fetch()`
- ✅ **Automatic Payments** - Detects 402, pays, retries automatically
- ✅ **USDC on Solana** - Fast, cheap micropayments
- ✅ **Error Handling** - Clear error messages for payment issues
- ✅ **Retry Logic** - Exponential backoff for transient failures
- ✅ **TypeScript** - Fully typed with IntelliSense support
- ✅ **Debug Mode** - Optional logging for troubleshooting
- ✅ **MCP Compatible** - Works in Model Context Protocol servers

## Usage Examples

### Basic GET Request

```typescript
const response = await client.fetch('https://api.example.com/data');
const json = await response.json();
```

### POST with Body

```typescript
const response = await client.fetch('https://api.example.com/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'bitcoin price' }),
});
const result = await response.json();
```

### Error Handling

```typescript
try {
  const response = await client.fetch('https://api.example.com/data');

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
} catch (error) {
  if (error.code === 'INSUFFICIENT_BALANCE') {
    console.error('Not enough USDC in wallet!');
  } else if (error.code === 'PAYMENT_TIMEOUT') {
    console.error('Payment took too long to confirm');
  }
}
```

## MCP Integration

This client works perfectly in Model Context Protocol (MCP) servers!

```typescript
import { X402Client } from '@x402-solana/client';

const x402Client = new X402Client({
  solanaRpcUrl: process.env.SOLANA_RPC_URL!,
  walletPrivateKey: process.env.MCP_WALLET_PRIVATE_KEY!,
  network: 'mainnet-beta',
  debug: true, // Safe in v0.1.1+ (logs to stderr, not stdout)
});

// Use in MCP tool handlers
const response = await x402Client.fetch('https://api.example.com/premium');
```

**Note:** v0.1.1+ uses `console.error()` for debug logs (stderr), making it MCP-compatible.

## Changelog

### v0.1.1 (2025-01-02)
- **Fixed:** Debug logs now use `console.error()` instead of `console.log()`
  - Makes client compatible with MCP servers
  - Debug mode can now be safely enabled in MCP environments

### v0.1.0 (2025-01-02)
- Initial release

## Related Packages

- **[@x402-solana/server](https://www.npmjs.com/package/@x402-solana/server)** - Add x402 to your API
- **[@x402-solana/core](https://www.npmjs.com/package/@x402-solana/core)** - Low-level verification

## Documentation

- [Full Documentation](https://github.com/BOBER3r/x402-solana-toolkit)
- [Getting Started Guide](https://github.com/BOBER3r/x402-solana-toolkit/blob/main/GETTING_STARTED.md)

## License

MIT © 2025
