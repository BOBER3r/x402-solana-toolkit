# Weather API with Tiered Pricing

A realistic example showing how to build a **Weather API with tiered pricing** using x402 micropayments on Solana.

## Features

- **3 Pricing Tiers** - Free, Basic ($0.001), Premium ($0.01)
- **Real-world use case** - Weather data API
- **Query parameters** - Dynamic city selection
- **Automatic payments** - Client handles all tiers seamlessly
- **Simple integration** - Same x402 pattern for all paid tiers

## Pricing Tiers

| Tier | Price | Endpoint | Description |
|------|-------|----------|-------------|
| **FREE** | $0 | `/api/weather/current` | Current weather for any city |
| **BASIC** | $0.001 | `/api/weather/forecast` | 7-day forecast |
| **PREMIUM** | $0.01 | `/api/weather/historical` | 30-day historical data with analytics |

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

Edit `.env` with your wallet addresses:
- `RECIPIENT_WALLET` - Server wallet (receives payments)
- `WALLET_PRIVATE_KEY` - Client wallet private key (pays for requests)

### 3. Run the Demo

Option A - Run complete demo:
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

## API Documentation

### Free Tier

**Current Weather** (No payment required)

```bash
GET /api/weather/current?city=London
```

Response:
```json
{
  "tier": "free",
  "data": {
    "location": "London",
    "temperature": 18,
    "condition": "Partly Cloudy",
    "humidity": 65,
    "windSpeed": 12
  },
  "timestamp": "2025-11-02T10:30:00.000Z"
}
```

### Basic Tier ($0.001)

**7-Day Forecast**

```bash
GET /api/weather/forecast?city=Paris
```

Payment: $0.001 (0.1 cents)

Response includes:
- 7-day forecast with high/low temps
- Precipitation probability
- Weather conditions
- Payment receipt

### Premium Tier ($0.01)

**Historical Data**

```bash
GET /api/weather/historical?city=Tokyo&days=30
```

Payment: $0.01 (1 cent)

Response includes:
- Up to 365 days of historical data
- Temperature trends
- Precipitation totals
- Statistical summary
- Payment receipt

## Code Examples

### Server - Adding Tiered Pricing

```typescript
import { X402Middleware } from '@x402-solana/server';

const x402 = new X402Middleware({
  solanaRpcUrl: 'https://api.devnet.solana.com',
  recipientWallet: process.env.RECIPIENT_WALLET,
  network: 'devnet',
});

// FREE tier
app.get('/api/weather/current', (req, res) => {
  const weather = getCurrentWeather(req.query.city);
  res.json({ tier: 'free', data: weather });
});

// BASIC tier - $0.001
app.get('/api/weather/forecast',
  x402.requirePayment(0.001, {
    description: '7-day weather forecast',
  }),
  (req, res) => {
    const forecast = get7DayForecast(req.query.city);
    res.json({
      tier: 'basic',
      price: '$0.001',
      data: forecast,
      payment: req.payment,
    });
  }
);

// PREMIUM tier - $0.01
app.get('/api/weather/historical',
  x402.requirePayment(0.01, {
    description: 'Historical weather data',
  }),
  (req, res) => {
    const history = getHistoricalData(req.query.city);
    res.json({
      tier: 'premium',
      price: '$0.01',
      data: history,
      payment: req.payment,
    });
  }
);
```

### Client - Calling All Tiers

```typescript
import { X402Client } from '@x402-solana/client';

const client = new X402Client({
  solanaRpcUrl: 'https://api.devnet.solana.com',
  walletPrivateKey: process.env.WALLET_PRIVATE_KEY,
  network: 'devnet',
});

// Free tier - no payment
const current = await client.fetch(
  'http://localhost:3000/api/weather/current?city=London'
);
const currentData = await current.json();

// Basic tier - automatic $0.001 payment
const forecast = await client.fetch(
  'http://localhost:3000/api/weather/forecast?city=Paris'
);
const forecastData = await forecast.json();

// Premium tier - automatic $0.01 payment
const historical = await client.fetch(
  'http://localhost:3000/api/weather/historical?city=Tokyo&days=30'
);
const historicalData = await historical.json();
```

## Use Cases

This pattern works for many APIs:

- **Weather Data** - Current, forecast, historical (this example)
- **Financial Data** - Real-time quotes (free), historical data (paid)
- **AI APIs** - Basic models (cheap), advanced models (expensive)
- **Analytics** - Summary data (free), detailed reports (paid)
- **Media APIs** - Thumbnails (free), full resolution (paid)
- **Translation** - Common languages (cheap), rare languages (expensive)

## Understanding the Flow

1. **Client makes request** to any tier
2. **Server checks for payment** (if required)
3. **If no payment** → Server returns 402 with payment requirements
4. **Client auto-pays** via USDC on Solana
5. **Client retries** with payment proof
6. **Server verifies** payment on-chain
7. **Server returns data** with payment receipt

All automatic with x402!

## Expected Output

```
╔════════════════════════════════════════════════════════════════╗
║        Weather API Client - Tiered Pricing Demo               ║
╚════════════════════════════════════════════════════════════════╝

1. FREE TIER - Current Weather (no payment required)
   ================================================

   Fetching current weather for London...
   Tier: FREE
   Location: London
   Temperature: 22°C
   Condition: Sunny
   Humidity: 58%
   Wind: 8 km/h

2. BASIC TIER - 7-Day Forecast ($0.001)
   ======================================
   Making payment automatically...

   Fetching 7-day forecast for Paris...
   Tier: BASIC
   Location: Paris
   Forecast (next 7 days):
     2025-11-02: 24°/12°C - Partly Cloudy
     2025-11-03: 21°/14°C - Rainy
     ... and 5 more days

   Payment Info:
   - Amount: $0.001
   - Paid by: 8xK7m...
   - Signature: 4nH9pQ...

3. PREMIUM TIER - 30-Day Historical Data ($0.01)
   ===============================================
   Making payment automatically...

   Fetching 30-day history for Tokyo...
   Tier: PREMIUM
   Location: Tokyo
   Period: 30 days
   Average Temperature: 19.4°C
   Total Precipitation: 245mm
   Record Count: 30

   Payment Info:
   - Amount: $0.01
   - Paid by: 8xK7m...
   - Signature: 5jM2wR...

╔════════════════════════════════════════════════════════════════╗
║                       Demo Complete!                           ║
╚════════════════════════════════════════════════════════════════╝

Summary:
  - Called FREE tier endpoints (no payment)
  - Paid $0.001 for forecast data
  - Paid $0.01 for historical data
  - Total spent: $0.011 (1.1 cents)

All payments were handled automatically by x402!
```

## Testing with cURL

You can also test the API directly:

```bash
# Free tier - works immediately
curl "http://localhost:3000/api/weather/current?city=London"

# Paid tier - will return 402 Payment Required
curl "http://localhost:3000/api/weather/forecast?city=Paris"

# Returns payment requirements:
{
  "error": "Payment required",
  "code": "PAYMENT_REQUIRED",
  "payment": {
    "amount": 1000,
    "currency": "USDC",
    "network": "solana-devnet",
    "recipient": "...",
    "description": "7-day weather forecast"
  }
}
```

## Next Steps

- See `examples/01-basic-api/` for the simplest x402 example
- See `examples/02-solex-betting/` for a complete application
- Build your own tiered pricing API
- Deploy to production on Solana mainnet

## Troubleshooting

**"Insufficient funds"**
- Get devnet SOL: https://faucet.solana.com
- Get devnet USDC: https://spl-token-faucet.com

**"Payment verification failed"**
- Ensure server and client use the same network (devnet)
- Check recipient wallet address is correct

**"Rate limiting"**
- Free tier has no limits
- Paid tiers = pay per request (no rate limits!)

## Learn More

- [x402 Protocol](https://github.com/Anthropic/x402)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [x402 Toolkit Documentation](../../README.md)
