# Solex Betting Platform - x402 Showcase

> **The flagship demo for x402-solana-toolkit hackathon submission**

This showcase demonstrates a real-world betting platform API that uses x402 micropayments to monetize AI-powered market analysis and bet execution services on Solana.

## What is This?

Solex Betting Platform is a hypothetical prediction market that charges micropayments for premium API features:

- **FREE**: Browse active betting markets
- **$0.01 USDC**: AI analysis of a single market
- **$0.05 USDC**: Portfolio recommendations based on bankroll
- **$0.10 + 2% USDC**: Execute bets on behalf of users (dynamic pricing)

The AI betting agent demonstrates how to consume these paid APIs automatically using x402 micropayments.

## Why x402 Matters

Traditional API monetization models have significant limitations:

| Traditional Model | x402 Model |
|------------------|-----------|
| Monthly subscription ($50-200) | Pay per use ($0.01-0.25) |
| Minimum commitment required | No commitment |
| Pay even when not using | Only pay for what you use |
| All-or-nothing access | Granular pricing per endpoint |
| Vendor lock-in | Switch providers instantly |

**Real Example from This Demo:**
- Agent spends **$0.25** in micropayments
- Gets AI recommendations + bet execution
- Expected profit: **$0.41** (164% ROI on fees)
- Traditional API would cost **$50-200/month** minimum

## Architecture

```
┌─────────────────┐
│   AI Agent      │
│  (X402Client)   │
└────────┬────────┘
         │ 1. GET /api/markets (FREE)
         │ 2. POST /api/get-recommendations (PAYS $0.05)
         │ 3. POST /api/execute-bet (PAYS $0.10 + 2%)
         │
         ▼
┌─────────────────┐         ┌──────────────────┐
│  Solex API      │────────▶│ Solana Devnet    │
│  (Express +     │  Verify │ USDC Transfers   │
│   X402Middleware)│  Payment│                  │
└─────────────────┘         └──────────────────┘
```

## Project Structure

```
examples/02-solex-betting/
├── server.ts              # Express API with 3 paid endpoints
├── agent.ts               # AI betting agent client
├── scripts/
│   └── setup-wallets.ts   # Generate wallets and instructions
├── package.json
├── .env.example
├── README.md
└── sample-output.txt      # Expected agent output
```

## Setup Instructions

### Prerequisites

- Node.js 18+
- npm or yarn
- (Optional) Solana CLI for manual wallet management

### 1. Install Dependencies

From the **monorepo root**:

```bash
npm install
```

From **this directory** (`examples/02-solex-betting`):

```bash
npm install
```

### 2. Generate Wallets

```bash
npm run setup-wallets
```

This will:
- Generate 3 wallets (Treasury, Agent, User)
- Create `.env` file with wallet addresses
- Show funding instructions

### 3. Fund the Agent Wallet

The agent wallet needs:
- **1 SOL** (for transaction fees)
- **10 USDC** (for x402 payments)

#### Option A: Use Faucets (Easiest)

**Get Devnet SOL:**
```bash
# Visit https://faucet.solana.com and paste your agent wallet address
# OR use CLI:
solana airdrop 1 <YOUR_AGENT_WALLET> --url devnet
```

**Get Devnet USDC:**
```bash
# Visit https://spl-token-faucet.com
# OR if you have SPL Token CLI:
spl-token create-account EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v --url devnet
spl-token mint EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v 10 --url devnet
```

#### Option B: Use Your Existing Wallet

If you have a Phantom or Solflare wallet with devnet tokens:

1. Export your private key
2. Update `AGENT_PRIVATE_KEY` in `.env` file
3. Ensure wallet has devnet SOL and USDC

### 4. Verify Configuration

Check your `.env` file looks like:

```bash
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLEX_TREASURY_WALLET=<generated_treasury_public_key>
AGENT_PRIVATE_KEY=<generated_or_your_agent_private_key>
USER_WALLET=<generated_user_public_key>
BANKROLL=100
```

## Running the Demo

### Option 1: Run Everything at Once

```bash
npm run demo
```

This starts the server and runs the agent automatically.

### Option 2: Run Components Separately

**Terminal 1 - Start API Server:**
```bash
npm run server
```

You should see:
```
================================================================
  Solex Betting Platform - x402 API Server
================================================================

Server running on http://localhost:3000

FREE Endpoints:
  GET  http://localhost:3000/api/markets

PAID Endpoints:
  POST http://localhost:3000/api/analyze-market ($0.01 USDC)
  POST http://localhost:3000/api/get-recommendations ($0.05 USDC)
  POST http://localhost:3000/api/execute-bet ($0.10 + 2% USDC)

Treasury Wallet: ...
Network: devnet

Ready to accept x402 payments!
================================================================
```

**Terminal 2 - Run AI Agent:**
```bash
npm run agent
```

## Expected Output

See `sample-output.txt` for the complete expected output.

Summary of what happens:

1. **Step 1**: Agent fetches 8 active markets (FREE)
2. **Step 2**: Agent pays $0.05 for AI recommendations
3. **Step 3**: Agent pays $0.10 + 2% to execute top bet
4. **Summary**: Shows cost breakdown and expected ROI

```
Cost Analysis & Expected Returns
================================================================

Costs:
  AI Recommendations: $0.05
  Bet Execution: $0.20
  ----------------------------------------
  Total x402 fees: $0.25

Expected Returns:
  Bet amount: $5.00
  Expected edge: 12.3%
  Confidence: 75.0%
  Expected profit: $0.46
  ----------------------------------------
  Net expected profit: $0.21
  ROI on fees: 84.0%
```

## API Endpoints

### FREE Endpoints

#### `GET /api/markets`

Returns list of active betting markets.

**Response:**
```json
{
  "markets": [
    {
      "id": 1,
      "title": "Will Bitcoin reach $100k by EOY?",
      "category": "crypto",
      "yesPool": 150000000,
      "noPool": 100000000,
      "totalPool": 250000000,
      "impliedProbability": 0.6,
      "bettingEnds": 1735689600
    }
  ],
  "total": 8
}
```

### PAID Endpoints

#### `POST /api/analyze-market` - $0.01 USDC

AI analysis of a single market.

**Request:**
```json
{
  "marketId": 1
}
```

**Response:**
```json
{
  "marketId": 1,
  "title": "Will Bitcoin reach $100k by EOY?",
  "impliedProbability": 0.6,
  "fairProbability": 0.52,
  "recommendation": "BUY_NO",
  "confidence": 0.78,
  "reasoning": "Market is overconfident on YES...",
  "currentOdds": 1.5,
  "volume": 250
}
```

#### `POST /api/get-recommendations` - $0.05 USDC

Portfolio recommendations based on bankroll and risk tolerance.

**Request:**
```json
{
  "bankroll": 100,
  "riskTolerance": "moderate",
  "categories": ["crypto", "politics"]
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "marketId": 1,
      "title": "Will Bitcoin reach $100k by EOY?",
      "recommendedBet": "NO",
      "betAmount": 5.0,
      "expectedEdge": 0.123,
      "confidence": 0.78,
      "marketAddress": "BTC100k2025Market..."
    }
  ],
  "portfolioMetrics": {
    "totalBetAmount": 25.0,
    "expectedROI": 0.35,
    "riskScore": 0.5
  }
}
```

#### `POST /api/execute-bet` - $0.10 + 2% USDC (dynamic)

Execute bet on behalf of user.

**Request:**
```json
{
  "marketAddress": "BTC100k2025Market...",
  "outcome": "NO",
  "betAmount": 5.0,
  "userWallet": "User123..."
}
```

**Response:**
```json
{
  "success": true,
  "signature": "BET_xyz123...",
  "betAmount": 5.0,
  "serviceFee": 0.20,
  "estimatedPayout": 8.33
}
```

## How x402 Works Here

1. **Client sends request** without payment
2. **Server responds** with `402 Payment Required` + payment details
3. **Client automatically**:
   - Creates USDC transfer on Solana
   - Signs transaction with agent wallet
   - Submits to blockchain
   - Retries request with payment proof
4. **Server verifies** payment on-chain
5. **Server returns** requested data

All of this happens automatically with `X402Client` - the agent developer doesn't need to manually handle payments!

## Customization

### Adjust Pricing

Edit `server.ts`:

```typescript
// Change endpoint prices
app.post('/api/analyze-market', x402.requirePayment(0.01), ...);
app.post('/api/get-recommendations', x402.requirePayment(0.05), ...);

// Dynamic pricing for execute-bet
const price = 0.10 + (betAmount * 0.02);
```

### Add More Markets

Edit `server.ts` and add to `sampleMarkets` array:

```typescript
const sampleMarkets: Market[] = [
  {
    id: 9,
    title: "Your market question?",
    category: "crypto",
    yesPool: 100000000,
    noPool: 100000000,
    totalPool: 200000000,
    bettingEnds: Math.floor(Date.now() / 1000) + 86400 * 30,
    isResolved: false,
  },
  // ...
];
```

### Modify Agent Strategy

Edit `agent.ts`:

```typescript
// Change risk tolerance
riskTolerance: 'aggressive', // or 'conservative'

// Change bankroll
const bankroll = 500; // $500

// Filter by categories
categories: ['crypto', 'sports'],
```

## Troubleshooting

### "SOLEX_TREASURY_WALLET not set"

Run `npm run setup-wallets` to generate wallets and create `.env` file.

### "Insufficient funds"

Ensure agent wallet has:
- At least 0.1 SOL for transaction fees
- At least 1 USDC for payments

Check balances:
```bash
solana balance <AGENT_WALLET> --url devnet
spl-token balance --owner <AGENT_WALLET> --url devnet
```

### "Payment verification failed"

Common causes:
- Using mainnet RPC with devnet wallets (check SOLANA_RPC_URL)
- Transaction not confirmed yet (wait a few seconds)
- Wrong network in .env file

### Server not responding

Ensure:
1. Server is running (`npm run server`)
2. No other service using port 3000
3. Check server logs for errors

## Production Considerations

For a production deployment, you would need to:

1. **Use mainnet** with real USDC
2. **Secure treasury wallet** with multi-sig or HSM
3. **Add rate limiting** to prevent abuse
4. **Implement caching** with Redis for payment verification
5. **Add real AI models** (currently using mock analysis)
6. **Integrate with Solana betting programs** (currently mock execution)
7. **Add authentication** for user identification
8. **Set up monitoring** and alerting
9. **Implement refund logic** for failed bets
10. **Add compliance** checks (KYC/AML if required)

## Learn More

- [x402-solana-toolkit Documentation](../../README.md)
- [x402 Payment Protocol Spec](https://example.com/x402-spec)
- [Solana Web3.js Docs](https://solana-labs.github.io/solana-web3.js/)
- [USDC on Solana](https://www.circle.com/en/usdc-multichain/solana)

## License

MIT

## Contributing

This is a hackathon showcase. For contributions to the main toolkit, see the monorepo root.

---

**Built with x402-solana-toolkit** - Bringing micropayments to Solana APIs
