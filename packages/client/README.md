# @x402-solana/client

Client SDK for automatic x402 payment handling on Solana. This package provides a drop-in replacement for the standard `fetch` API that automatically handles HTTP 402 Payment Required responses by creating USDC payments on Solana.

## Features

- **Automatic Payment Handling**: Transparently handles 402 responses with USDC payments
- **Simple API**: Drop-in replacement for standard `fetch`
- **Solana Native**: Built on @solana/web3.js and SPL Token
- **TypeScript Support**: Full type definitions included
- **Comprehensive Testing**: Extensive test coverage with mocks
- **Developer Friendly**: Clear error messages and debug logging

## Installation

```bash
npm install @x402-solana/client @solana/web3.js @solana/spl-token
```

## Quick Start

```typescript
import { X402Client } from '@x402-solana/client';

// Initialize client
const client = new X402Client({
  solanaRpcUrl: 'https://api.devnet.solana.com',
  walletPrivateKey: 'your-base58-private-key',
  network: 'devnet',
  debug: true, // Enable logging
});

// Use like regular fetch - payments are automatic
const response = await client.fetch('https://api.example.com/premium-data');
const data = await response.json();

console.log(data);
```

## Configuration

### X402ClientConfig

```typescript
interface X402ClientConfig {
  // Required
  solanaRpcUrl: string;           // Solana RPC endpoint
  walletPrivateKey: string | Uint8Array; // Wallet private key

  // Optional
  network?: 'devnet' | 'mainnet-beta';  // Default: 'mainnet-beta'
  autoRetry?: boolean;                   // Default: true
  maxRetries?: number;                   // Default: 3
  commitment?: 'processed' | 'confirmed' | 'finalized'; // Default: 'confirmed'
  debug?: boolean;                       // Default: false
}
```

## API Reference

### X402Client

Main client class for handling x402 payments.

#### Methods

##### `fetch(url: string, options?: RequestInit): Promise<Response>`

Fetch with automatic x402 payment handling.

```typescript
const response = await client.fetch('https://api.example.com/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'search term' }),
});
```

##### `getUSDCBalance(): Promise<number>`

Get wallet's USDC balance.

```typescript
const balance = await client.getUSDCBalance();
console.log(`Balance: ${balance} USDC`);
```

##### `getSOLBalance(): Promise<number>`

Get wallet's SOL balance.

```typescript
const balance = await client.getSOLBalance();
console.log(`Balance: ${balance} SOL`);
```

##### `getPublicKey(): PublicKey`

Get wallet's public key.

```typescript
const publicKey = client.getPublicKey();
console.log(`Wallet: ${publicKey.toString()}`);
```

##### `getUSDCMint(): PublicKey`

Get USDC mint address for current network.

```typescript
const mint = client.getUSDCMint();
```

##### `getUSDCTokenAccount(): PublicKey`

Get wallet's USDC token account address.

```typescript
const tokenAccount = client.getUSDCTokenAccount();
```

### WalletManager

Utility for managing Solana wallets (for testing/development).

#### Methods

##### `static generateWallet(): WalletInfo`

Generate a new random wallet.

```typescript
const wallet = WalletManager.generateWallet();
console.log(`Public key: ${wallet.publicKey}`);
console.log(`Private key: ${wallet.privateKey}`);
```

##### `static fromPrivateKey(privateKey: string | Uint8Array): WalletInfo`

Create wallet from existing private key.

```typescript
const wallet = WalletManager.fromPrivateKey('your-base58-key');
```

##### `static airdropSOL(connection: Connection, publicKey: PublicKey, amountSOL: number): Promise<string>`

Request SOL airdrop (devnet/testnet only).

```typescript
const connection = new Connection('https://api.devnet.solana.com');
const signature = await WalletManager.airdropSOL(
  connection,
  publicKey,
  1.0
);
```

### PaymentSender

Low-level payment utilities for advanced use cases.

#### Methods

##### `sendUSDC(recipientWallet: string, amountUSDC: number, usdcMint: string, options?: SendUSDCOptions): Promise<string>`

Send USDC payment to a recipient.

```typescript
const sender = new PaymentSender(connection, wallet);
const signature = await sender.sendUSDC(
  'recipient-address',
  0.5,
  usdcMint,
  { createTokenAccount: true }
);
```

##### `estimatePaymentCost(amountUSDC: number, usdcMint: string): Promise<PaymentCostEstimate>`

Estimate payment cost including fees.

```typescript
const estimate = await sender.estimatePaymentCost(0.5, usdcMint);
console.log(`Total cost: ${estimate.totalUSD} USD`);
console.log(`SOL fee: ${estimate.solFee} SOL`);
```

## Usage Examples

### Basic Payment Flow

```typescript
import { X402Client } from '@x402-solana/client';

const client = new X402Client({
  solanaRpcUrl: 'https://api.devnet.solana.com',
  walletPrivateKey: process.env.WALLET_PRIVATE_KEY,
  network: 'devnet',
});

// 1. Request will receive 402 Payment Required
// 2. Client automatically creates USDC payment
// 3. Request is retried with payment proof
// 4. Response is returned
const response = await client.fetch('https://api.example.com/premium');
const data = await response.json();
```

### Check Balance Before Request

```typescript
const balance = await client.getUSDCBalance();
console.log(`Current balance: ${balance} USDC`);

if (balance < 1.0) {
  console.log('Insufficient balance for request');
} else {
  const response = await client.fetch('https://api.example.com/data');
}
```

### Disable Auto-Retry

```typescript
const client = new X402Client({
  solanaRpcUrl: 'https://api.devnet.solana.com',
  walletPrivateKey: process.env.WALLET_PRIVATE_KEY,
  network: 'devnet',
  autoRetry: false, // Don't automatically pay
});

const response = await client.fetch('https://api.example.com/data');

if (response.status === 402) {
  const paymentReq = await response.json();
  console.log('Payment required:', paymentReq);
  // Handle manually
}
```

### Generate Test Wallet

```typescript
import { WalletManager } from '@x402-solana/client';
import { Connection } from '@solana/web3.js';

// Generate new wallet
const wallet = WalletManager.generateWallet();
console.log(`Wallet created: ${wallet.publicKey}`);

// Fund with devnet SOL
const connection = new Connection('https://api.devnet.solana.com');
await WalletManager.airdropSOL(
  connection,
  new PublicKey(wallet.publicKey),
  1.0
);

// Use with client
const client = new X402Client({
  solanaRpcUrl: 'https://api.devnet.solana.com',
  walletPrivateKey: wallet.privateKey,
  network: 'devnet',
});
```

### Error Handling

```typescript
import { X402Client, PaymentError, PaymentErrorCode } from '@x402-solana/client';

try {
  const response = await client.fetch('https://api.example.com/data');
  const data = await response.json();
} catch (error) {
  if (error instanceof PaymentError) {
    switch (error.code) {
      case PaymentErrorCode.INSUFFICIENT_BALANCE:
        console.error('Not enough USDC:', error.details);
        break;
      case PaymentErrorCode.TRANSACTION_FAILED:
        console.error('Payment transaction failed:', error.details);
        break;
      case PaymentErrorCode.NETWORK_ERROR:
        console.error('Network error:', error.message);
        break;
      default:
        console.error('Payment error:', error.message);
    }
  } else {
    console.error('Unknown error:', error);
  }
}
```

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Clean build artifacts
npm run clean
```

## Error Codes

- `INSUFFICIENT_BALANCE`: Wallet doesn't have enough USDC or SOL
- `TRANSACTION_FAILED`: Payment transaction failed on-chain
- `CONFIRMATION_TIMEOUT`: Transaction confirmation timed out
- `INVALID_PAYMENT_REQUIREMENTS`: Server's payment requirements are malformed
- `NETWORK_ERROR`: Network or RPC error occurred
- `UNSUPPORTED_PAYMENT_METHOD`: Server requires unsupported payment method

## Network Support

### Devnet
- USDC Mint: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
- RPC: `https://api.devnet.solana.com`

### Mainnet
- USDC Mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- RPC: `https://api.mainnet-beta.solana.com`

## Security Considerations

1. **Private Key Storage**: Never commit private keys to version control
2. **Environment Variables**: Store keys in environment variables or secure vaults
3. **Balance Checks**: Monitor wallet balance to prevent failed transactions
4. **Transaction Simulation**: Client uses preflight checks to validate transactions
5. **Confirmation**: Waits for transaction confirmation before retrying requests

## License

MIT

## Related Packages

- [@x402-solana/core](../core) - Core x402 protocol types and utilities
- [@x402-solana/server](../server) - Server SDK for accepting x402 payments
