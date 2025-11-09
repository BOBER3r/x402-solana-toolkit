# @x402-solana/react

React hooks and components for x402 payment protocol on Solana.

Make any React app accept micropayments with just a few lines of code!

## Features

- 🎣 **React Hooks** - `useX402Payment()`, `useWalletBalance()`, `usePaymentHistory()`
- 🎨 **UI Components** - Pre-built payment buttons, balance badges, transaction history (NEW in v0.3.0)
- 🔌 **Wallet Adapter Integration** - Works with Phantom, Solflare, and all Solana wallets
- 🚀 **Automatic 402 Handling** - Detects 402 responses and automatically creates payments
- 💾 **Payment History** - Built-in localStorage persistence
- 📊 **Balance Monitoring** - Real-time USDC and SOL balance tracking
- 🌙 **Dark Mode** - Built-in theme support with customization
- 📱 **Mobile Responsive** - Works perfectly on all screen sizes
- ♿ **Accessible** - WCAG 2.1 AA compliant
- 🔥 **TypeScript First** - Full type safety and IntelliSense support
- ⚡ **Zero Configuration** - Works out of the box with sensible defaults

## Installation

```bash
npm install @x402-solana/react @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/wallet-adapter-wallets
```

## Quick Start

### 1. Set up providers

Wrap your app with the required providers:

```tsx
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { X402Provider } from '@x402-solana/react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import '@solana/wallet-adapter-react-ui/styles.css';

function App() {
  const wallets = [new PhantomWalletAdapter()];

  return (
    <ConnectionProvider endpoint="https://api.devnet.solana.com">
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <X402Provider config={{ solanaRpcUrl: 'https://api.devnet.solana.com' }}>
            <YourApp />
          </X402Provider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

### 2. Use the hooks

```tsx
import { useX402Payment } from '@x402-solana/react';

function MyComponent() {
  const { fetch, isLoading } = useX402Payment();

  const loadData = async () => {
    // Automatically handles 402 payments!
    const response = await fetch('https://api.example.com/premium');
    const data = await response.json();
  };

  return (
    <button onClick={loadData} disabled={isLoading}>
      Load Premium Data
    </button>
  );
}
```

That's it! Your app now accepts micropayments! 🎉

## Hooks API

### useX402Payment

Main hook for automatic 402 payment handling.

```tsx
import { useX402Payment } from '@x402-solana/react';

function MyComponent() {
  const {
    fetch,                    // Fetch with auto-402 handling
    isLoading,                // Loading state
    error,                    // Error state
    lastPaymentSignature,     // Last payment transaction signature
    lastPaymentAmount,        // Last payment amount in USDC
    paymentHistory,           // Payment history array
  } = useX402Payment({
    autoRetry: true,
    maxRetries: 3,
    onPaymentRequired: (requirements) => {
      console.log('Payment required:', requirements);
    },
    onPaymentSent: (signature, amount) => {
      console.log(`Paid ${amount} USDC, tx: ${signature}`);
    },
    onPaymentConfirmed: (signature) => {
      console.log('Payment confirmed:', signature);
    },
    onError: (error) => {
      console.error('Payment error:', error);
    },
  });

  return (
    <button onClick={() => fetch('/api/premium')}>
      {isLoading ? 'Processing...' : 'Load Data'}
    </button>
  );
}
```

### useWalletBalance

Monitor wallet balances with auto-refresh.

```tsx
import { useWalletBalance } from '@x402-solana/react';

function WalletInfo() {
  const {
    usdcBalance,    // USDC balance in standard units
    solBalance,     // SOL balance in standard units
    isLoading,      // Loading state
    error,          // Error state
    refresh,        // Manual refresh function
  } = useWalletBalance({
    refreshInterval: 10000, // Auto-refresh every 10 seconds
    onBalanceChange: (balance) => {
      console.log('USDC balance:', balance);
    },
  });

  return (
    <div>
      <p>USDC: {usdcBalance}</p>
      <p>SOL: {solBalance}</p>
      <button onClick={refresh}>Refresh</button>
    </div>
  );
}
```

### usePaymentHistory

Track payment history with localStorage persistence.

```tsx
import { usePaymentHistory } from '@x402-solana/react';

function PaymentHistory() {
  const {
    history,              // Array of payment entries
    totalSpent,           // Total USDC spent
    successfulPayments,   // Number of successful payments
    addPayment,           // Add payment to history
    updatePayment,        // Update payment entry
    clear,                // Clear all history
    getPayment,           // Get payment by ID
    getPaymentsForUrl,    // Get payments for specific URL
  } = usePaymentHistory({
    maxSize: 100,
    persist: true,
    storageKey: 'x402-payment-history',
  });

  return (
    <div>
      <h2>Total Spent: ${totalSpent} USDC</h2>
      <p>Successful Payments: {successfulPayments}</p>
      <button onClick={clear}>Clear History</button>
      {history.map((payment) => (
        <div key={payment.id}>
          {payment.amount} USDC - {payment.url}
        </div>
      ))}
    </div>
  );
}
```

### useX402 (Context Hook)

Access the global X402 context.

```tsx
import { useX402 } from '@x402-solana/react';

function MyComponent() {
  const {
    config,             // Provider configuration
    connection,         // Solana connection
    wallet,             // Connected wallet adapter
    publicKey,          // Wallet public key
    connected,          // Wallet connection status
    fetch,              // Global fetch function
    getBalance,         // Get USDC balance
    paymentHistory,     // Global payment history
    clearHistory,       // Clear payment history
    isLoading,          // Global loading state
    error,              // Global error state
  } = useX402();

  return <div>Connected: {connected ? 'Yes' : 'No'}</div>;
}
```

## Components

### X402Provider

Main provider component that wraps your app.

```tsx
<X402Provider
  config={{
    solanaRpcUrl: 'https://api.devnet.solana.com',
    network: 'devnet',          // 'devnet' | 'mainnet-beta'
    autoRetry: true,            // Auto-retry on 402
    maxRetries: 3,              // Max retry attempts
    commitment: 'confirmed',    // Transaction commitment
    debug: false,               // Enable debug logging
    enableHistory: true,        // Enable payment history
    maxHistorySize: 100,        // Max history entries
  }}
>
  <YourApp />
</X402Provider>
```

## UI Components (NEW in v0.3.0)

Pre-built, production-ready components that reduce integration time from hours to minutes!

### PaymentButton

Primary CTA for paid actions with built-in payment handling.

```tsx
import { PaymentButton } from '@x402-solana/react';

<PaymentButton
  priceUSD={0.001}
  description="Get BTC price data"
  onSuccess={(data) => console.log('Payment successful!', data)}
  onError={(error) => console.error('Payment failed:', error)}
  variant="primary"  // 'primary' | 'secondary' | 'outline'
  size="md"          // 'sm' | 'md' | 'lg'
>
  Get Premium Data
</PaymentButton>
```

**Features:**
- Auto-detects wallet connection
- Loading states with spinner
- Success/error animations
- Customizable variants and sizes

### BalanceBadge

Real-time wallet balance display with low balance warnings.

```tsx
import { BalanceBadge } from '@x402-solana/react';

<BalanceBadge
  showUSDC={true}
  showSOL={true}
  refreshInterval={10000}      // Auto-refresh every 10s
  lowBalanceThreshold={0.01}   // Warn when USDC < 0.01
/>
```

**Output:**
```
💰 Balance
SOL: 0.5
USDC: 10.50
```

### PaymentStatus

Transaction confirmation tracking with progress indicator.

```tsx
import { PaymentStatus } from '@x402-solana/react';

<PaymentStatus
  signature="5xyz...abc"
  network="devnet"
  showDetails={true}
  onConfirmed={() => console.log('Payment confirmed!')}
/>
```

**Shows:**
- Confirmation progress (1/32 confirmations)
- Link to block explorer
- Estimated completion time

### PaymentHistory

Paginated transaction history table with export functionality.

```tsx
import { PaymentHistory } from '@x402-solana/react';

<PaymentHistory
  maxItems={10}
  showFilters={true}
  exportable={true}
  onTransactionClick={(signature) => viewDetails(signature)}
/>
```

**Features:**
- Mobile responsive (cards on mobile, table on desktop)
- Filter by date/amount
- Export to CSV
- Links to Solscan

### PriceTag

Display USDC price with USD conversion.

```tsx
import { PriceTag } from '@x402-solana/react';

<PriceTag
  priceUSD={0.001}
  variant="badge"   // 'badge' | 'inline'
  showUSD={true}
/>
```

**Output:** `💳 0.001 USDC ($0.001)`

### WalletConnect

Standard wallet connection button with network indicator.

```tsx
import { WalletConnect } from '@x402-solana/react';

<WalletConnect
  onConnect={(wallet) => console.log('Connected:', wallet)}
  requiredNetwork="devnet"
/>
```

**States:**
- Disconnected: "Connect Wallet"
- Connected: "9xQe...7yL (Devnet) ▼"
- Wrong network: "Switch to Devnet"

### Theming

Customize component appearance with themes:

```tsx
import { defaultTheme, darkTheme, createTheme } from '@x402-solana/react';

// Use default theme
<PaymentButton theme={defaultTheme} />

// Use dark theme
<PaymentButton theme={darkTheme} />

// Create custom theme
const customTheme = createTheme({
  colors: {
    primary: '#FF6B35',
    secondary: '#004E89',
    success: '#06D6A0',
    error: '#EF476F',
    background: '#FFFFFF',
    text: '#2B2D42',
  },
  borderRadius: '8px',
  fontFamily: 'Inter, sans-serif',
});

<PaymentButton theme={customTheme} />
```

### Optional Styling

Import optional CSS for animations and dark mode:

```tsx
import '@x402-solana/react/styles/base.css';
```

📚 **[Full Component Documentation](./src/components/COMPONENTS.md)**

## Advanced Usage

### Manual Payment Creation

```tsx
import { createPaymentWithWallet } from '@x402-solana/react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

function ManualPayment() {
  const wallet = useWallet();
  const { connection } = useConnection();

  const makePayment = async (paymentRequirements) => {
    const signature = await createPaymentWithWallet(
      wallet,
      connection,
      paymentRequirements
    );
    console.log('Payment signature:', signature);
  };

  return <button onClick={makePayment}>Pay Manually</button>;
}
```

### Custom Balance Checks

```tsx
import { getUSDCBalance, getUSDCMint } from '@x402-solana/react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

function CustomBalance() {
  const wallet = useWallet();
  const { connection } = useConnection();

  const checkBalance = async () => {
    const usdcMint = getUSDCMint('devnet');
    const balance = await getUSDCBalance(wallet, connection, usdcMint);
    console.log('USDC balance:', balance);
  };

  return <button onClick={checkBalance}>Check Balance</button>;
}
```

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```tsx
import type {
  X402ProviderConfig,
  UseX402PaymentOptions,
  PaymentHistoryEntry,
  X402ContextValue,
} from '@x402-solana/react';
```

## Examples

See the [examples/react-app](../../examples/react-app) directory for a complete React application demonstrating all features.

## Browser Compatibility

- Modern browsers with ES2020 support
- React 18+
- Solana wallet extensions (Phantom, Solflare, etc.)

## Security Notes

- **Never expose private keys** - This package uses wallet adapters, not private keys
- **HTTPS only** - Always use HTTPS in production
- **Validate amounts** - Always verify payment amounts match expectations
- **Rate limiting** - Implement rate limiting on your API endpoints

## Troubleshooting

### Wallet not connecting

Make sure you have:
1. Installed a Solana wallet extension (Phantom, Solflare, etc.)
2. Correctly set up WalletProvider with wallet adapters
3. Imported wallet adapter CSS: `import '@solana/wallet-adapter-react-ui/styles.css'`

### 402 payments not working

Check:
1. Wallet is connected and has USDC balance
2. RPC endpoint is correct for your network (devnet/mainnet)
3. API endpoint returns proper x402-compliant 402 responses
4. Network matches between client and server (both devnet or both mainnet)

### Balance showing as 0

Ensure:
1. Wallet is connected
2. USDC token account exists for the wallet
3. Network configuration is correct
4. RPC endpoint is responding

## License

MIT

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Support

- Documentation: https://docs.x402-solana.dev
- Issues: https://github.com/BOBER3r/x402-solana-toolkit/issues
- Discord: https://discord.gg/x402-solana

---

Built with ❤️ by the x402-solana-toolkit team