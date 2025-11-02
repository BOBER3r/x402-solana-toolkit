# Solex Betting Platform Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Solex Betting Platform                  │
│                  (x402 Micropayment Showcase)               │
└─────────────────────────────────────────────────────────────┘

         Client Side                Server Side               Blockchain
    ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
    │              │          │              │          │              │
    │  AI Agent    │          │ Express API  │          │   Solana     │
    │              │          │              │          │   Devnet     │
    │ X402Client   │◀────────▶│ X402         │◀────────▶│              │
    │              │   HTTP   │ Middleware   │  Verify  │ USDC Token   │
    │              │          │              │          │              │
    └──────────────┘          └──────────────┘          └──────────────┘
```

## Request Flow

### Free Endpoint (GET /api/markets)

```
Agent                           Server
  │                               │
  │  GET /api/markets            │
  ├──────────────────────────────▶│
  │                               │ No payment required
  │  200 OK + markets data        │
  │◀──────────────────────────────┤
  │                               │
```

### Paid Endpoint (POST /api/get-recommendations)

```
Agent                    Server                    Solana Blockchain
  │                        │                              │
  │ POST /recommendations  │                              │
  ├───────────────────────▶│                              │
  │                        │ Check payment header         │
  │                        │ (not present)                │
  │ 402 Payment Required   │                              │
  │ + payment details      │                              │
  │◀───────────────────────┤                              │
  │                        │                              │
  │ X402Client creates     │                              │
  │ USDC transfer          │                              │
  │                        │                              │
  │ Sign + submit tx       │                              │
  ├────────────────────────┼─────────────────────────────▶│
  │                        │                              │
  │                        │                              │ Transaction
  │ Transaction signature  │                              │ confirmed
  │◀───────────────────────┼──────────────────────────────┤
  │                        │                              │
  │ POST /recommendations  │                              │
  │ + X-Payment header     │                              │
  ├───────────────────────▶│                              │
  │                        │ Verify payment               │
  │                        ├─────────────────────────────▶│
  │                        │                              │
  │                        │ Payment confirmed            │
  │                        │◀─────────────────────────────┤
  │                        │ Process request              │
  │ 200 OK + data          │                              │
  │◀───────────────────────┤                              │
  │                        │                              │
```

## Component Breakdown

### 1. Agent (agent.ts)

**Purpose:** AI betting client that consumes paid APIs

**Key Components:**
```typescript
// Initialize x402 client
const client = new X402Client({
  solanaRpcUrl: 'https://api.devnet.solana.com',
  walletPrivateKey: process.env.AGENT_PRIVATE_KEY,
  network: 'devnet',
});

// Automatic payment handling
const response = await client.fetch(url, options);
```

**Workflow:**
1. Fetch free markets
2. Pay $0.05 for recommendations
3. Pay $0.10 + 2% for bet execution
4. Calculate ROI and display results

### 2. Server (server.ts)

**Purpose:** Express API with paid endpoints

**Key Components:**
```typescript
// Initialize middleware
const x402 = new X402Middleware({
  solanaRpcUrl: process.env.SOLANA_RPC_URL,
  recipientWallet: process.env.SOLEX_TREASURY_WALLET,
  network: 'devnet',
});

// Protected endpoint
app.post('/api/analyze',
  x402.requirePayment(0.01),  // $0.01 USDC
  handler
);
```

**Endpoints:**

| Endpoint | Price | Description |
|----------|-------|-------------|
| GET /api/markets | FREE | List active markets |
| POST /api/analyze-market | $0.01 | AI analysis |
| POST /api/get-recommendations | $0.05 | Portfolio advice |
| POST /api/execute-bet | $0.10 + 2% | Execute bet |

### 3. Payment Flow (x402 Protocol)

**Step 1: Initial Request**
```http
POST /api/get-recommendations
Content-Type: application/json

{
  "bankroll": 100,
  "riskTolerance": "moderate"
}
```

**Step 2: Payment Required Response**
```http
HTTP/1.1 402 Payment Required
X-Payment-Required: amount=0.05 currency=USDC
X-Payment-Accept: solana
X-Payment-Destination: 7kH9Zx2mPqL4wVnR8sT6uY3fD1cB5aJ9eG8
```

**Step 3: Create Payment**
```typescript
// X402Client handles this automatically
const tx = await createUSDCTransfer({
  from: agentWallet,
  to: recipientWallet,
  amount: 0.05 * 1_000_000, // micro-USDC
});
const signature = await sendAndConfirm(tx);
```

**Step 4: Retry with Proof**
```http
POST /api/get-recommendations
Content-Type: application/json
X-Payment: signature=3kZ8mPqL4wVnR8sT6uY3fD1cB... network=devnet

{
  "bankroll": 100,
  "riskTolerance": "moderate"
}
```

**Step 5: Verify & Respond**
```typescript
// X402Middleware verifies on-chain
const payment = await verifyPayment(signature);
if (payment.valid) {
  // Process request
  return recommendations;
}
```

## Data Models

### Market
```typescript
interface Market {
  id: number;
  title: string;
  description: string;
  category: 'crypto' | 'sports' | 'politics' | 'entertainment' | 'weather';
  yesPool: number;        // micro-USDC
  noPool: number;         // micro-USDC
  totalPool: number;      // micro-USDC
  bettingEnds: number;    // Unix timestamp
  isResolved: boolean;
  marketAddress?: string; // Solana program address
}
```

### Recommendation
```typescript
interface Recommendation {
  marketId: number;
  title: string;
  recommendedBet: 'YES' | 'NO';
  betAmount: number;
  expectedEdge: number;   // 0.0 - 1.0
  confidence: number;     // 0.0 - 1.0
  marketAddress: string;
}
```

### Bet Result
```typescript
interface BetResult {
  success: boolean;
  signature: string;      // Transaction signature
  betAmount: number;
  serviceFee: number;
  estimatedPayout: number;
  market: {
    id: number;
    title: string;
  };
}
```

## Economics Model

### Pricing Strategy

| Service | Base Price | Variable | Total Example |
|---------|-----------|----------|---------------|
| Market Analysis | $0.01 | - | $0.01 |
| Recommendations | $0.05 | - | $0.05 |
| Bet Execution | $0.10 | +2% of bet | $0.20 ($10 bet) |

### Cost Breakdown (Example Session)

```
Agent Budget: $100 bankroll

API Costs:
  Recommendations:  $0.05
  Bet Execution:    $0.20  ($0.10 + 2% of $5.00)
  ─────────────────────────
  Total API fees:   $0.25

Bet Amount:         $5.00
Expected Edge:      12.3%
Confidence:         78.5%
Expected Profit:    $0.48

Net Expected:       $0.23  (profit - API fees)
ROI on API fees:    92%    ($0.23 / $0.25)
```

### Value Proposition

**Traditional Model:**
- Monthly subscription: $50-200
- Must commit upfront
- Pay regardless of usage
- All-or-nothing access

**x402 Model:**
- Pay per use: $0.01-0.25
- No commitment
- Only pay when active
- Granular pricing

**Breakeven Analysis:**
```
Traditional: $50/month
x402: $0.25/session

Number of sessions to breakeven: 200 sessions/month
Daily usage required: 6.7 sessions/day

Conclusion: x402 is better for:
- Occasional users
- Testing/development
- Variable workloads
- Price-sensitive users
```

## Security Considerations

### Payment Verification

```typescript
// Server-side verification
const verification = await verifier.verifyTransaction(signature);

Checks:
✓ Transaction exists on blockchain
✓ Transaction is confirmed
✓ Amount matches requirement
✓ Recipient matches treasury wallet
✓ Token is USDC
✓ Network matches (devnet/mainnet)
✓ Not already used (replay protection)
```

### Wallet Security

**Treasury Wallet (Server):**
- Only public key stored
- Receives payments
- No signing required
- Can use cold wallet

**Agent Wallet (Client):**
- Private key required for signing
- Should be rotated regularly
- Use environment variables
- Never commit to git

## Scaling Considerations

### Current Limitations

- **In-memory storage**: Markets stored in array
- **No caching**: Each verification hits blockchain
- **No rate limiting**: Could be abused
- **Mock betting**: Not executing real on-chain bets

### Production Enhancements

```
┌────────────────────────────────────────────────────┐
│                  Production Stack                   │
├────────────────────────────────────────────────────┤
│                                                     │
│  Load Balancer (nginx)                             │
│         │                                           │
│         ▼                                           │
│  Express Servers (3+ instances)                    │
│         │                                           │
│         ├──────▶ PostgreSQL (markets, users)       │
│         │                                           │
│         ├──────▶ Redis (payment cache, sessions)   │
│         │                                           │
│         ├──────▶ Solana RPC (Triton, QuickNode)    │
│         │                                           │
│         └──────▶ AI Service (OpenAI, Anthropic)    │
│                                                     │
└────────────────────────────────────────────────────┘
```

**Database Schema:**
```sql
-- Markets table
CREATE TABLE markets (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  yes_pool BIGINT NOT NULL,
  no_pool BIGINT NOT NULL,
  betting_ends TIMESTAMP NOT NULL,
  is_resolved BOOLEAN DEFAULT false
);

-- Payments table (for audit trail)
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  signature TEXT UNIQUE NOT NULL,
  amount BIGINT NOT NULL,
  payer TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  verified_at TIMESTAMP DEFAULT NOW()
);
```

**Redis Caching:**
```typescript
// Cache verified payments for 1 hour
await redis.setex(
  `payment:${signature}`,
  3600,
  JSON.stringify(paymentData)
);
```

**Rate Limiting:**
```typescript
// Per wallet per hour
const limit = await redis.incr(`rate:${wallet}:${hour}`);
if (limit > 100) {
  throw new Error('Rate limit exceeded');
}
```

## Testing Strategy

### Unit Tests
- Payment verification logic
- Market analysis algorithms
- Pricing calculations

### Integration Tests
- End-to-end payment flow
- Server endpoint responses
- Database operations

### Load Tests
- Concurrent payment verification
- High-volume API requests
- Database query performance

### Security Tests
- Replay attack prevention
- Payment amount manipulation
- Unauthorized access attempts

## Monitoring & Observability

**Key Metrics:**
```
Business Metrics:
- Total payments received
- Average payment amount
- Revenue per endpoint
- User acquisition cost

Technical Metrics:
- Request latency (p50, p95, p99)
- Payment verification time
- Error rate by endpoint
- Database query performance

Blockchain Metrics:
- Transaction confirmation time
- Failed transactions
- Gas/fee costs
- Network congestion
```

---

**This architecture demonstrates production-grade design while keeping the showcase simple and understandable.**
