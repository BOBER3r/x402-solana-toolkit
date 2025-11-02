# Quick Start Guide for Judges

This is the **main showcase** for the x402-solana-toolkit hackathon submission. Follow these steps to see it in action.

## 5-Minute Demo

### 1. Install Dependencies (1 min)

```bash
# From monorepo root
cd /path/to/x402-solana-toolkit
npm install

# From this example
cd examples/02-solex-betting
npm install
```

### 2. Setup Wallets (1 min)

```bash
npm run setup-wallets
```

This generates wallets and creates `.env` file.

### 3. Fund Agent Wallet (2 min)

**You need devnet USDC to run the demo.**

#### Option A: Use Devnet Faucets

1. Go to https://faucet.solana.com
2. Paste the **Agent Wallet** address (shown in setup output)
3. Request 1 SOL

4. Go to https://spl-token-faucet.com (or use CLI)
5. Get 10 USDC for the same wallet

#### Option B: Skip Funding (Mock Mode)

If you want to see the code without actual blockchain transactions:
- Just review the code structure
- Check `server.ts` for x402 middleware integration
- Check `agent.ts` for X402Client usage
- See `sample-output.txt` for expected behavior

### 4. Run the Demo (1 min)

**Terminal 1 - Start Server:**
```bash
npm run server
```

**Terminal 2 - Run Agent:**
```bash
npm run agent
```

OR run both at once:
```bash
npm run demo
```

## What You'll See

1. Server starts and shows 4 endpoints (1 free, 3 paid)
2. Agent fetches free markets
3. Agent **pays $0.05** for AI recommendations
4. Agent **pays $0.10 + 2%** to execute a bet
5. Summary shows cost breakdown and ROI

## Key Files to Review

### Server Implementation
**File:** `server.ts`

Key sections:
- Line 112-128: X402Middleware initialization
- Line 297-320: $0.01 endpoint with `x402.requirePayment(0.01)`
- Line 364-408: $0.05 endpoint with payment verification
- Line 452-494: Dynamic pricing ($0.10 + 2%)

### Client Implementation
**File:** `agent.ts`

Key sections:
- Line 33-38: X402Client initialization
- Line 118-125: Free API call (no payment)
- Line 137-150: Paid API call with automatic payment
- Line 185-202: Dynamic pricing API call

### Sample Markets
**File:** `server.ts` (lines 31-130)

8 realistic prediction markets with:
- Pool sizes in micro-USDC
- Implied probabilities
- Market addresses
- Multiple categories

## Architecture Highlights

### Why This Matters

Traditional betting platforms would charge:
- **Monthly API fee**: $50-200
- **Per-bet commission**: 2-5%
- **Minimum deposit**: $100+

With x402:
- **Pay per API call**: $0.01-0.25
- **No subscription**: Only pay when you use it
- **No commitment**: Switch providers instantly

### Real Economics

From `sample-output.txt`:
```
Total x402 fees: $0.25
Expected profit: $0.48
Net expected: $0.23
ROI on fees: 92%
```

The micropayment model **enables the use case** - an agent that makes a $5 bet wouldn't want to pay $50/month for API access!

## Code Quality

- **TypeScript** with strict types
- **Error handling** on all endpoints
- **Input validation** for security
- **Dynamic pricing** demonstration
- **Clear documentation** with comments
- **Realistic sample data**

## Production Considerations

The README.md discusses 10 production considerations including:
- Security (multi-sig wallets)
- Rate limiting
- Real AI integration
- On-chain bet execution
- Compliance (KYC/AML)

## Questions?

See the full `README.md` for:
- Detailed API documentation
- Troubleshooting guide
- Customization options
- Production deployment checklist

---

**This is the showcase that demonstrates real-world value of x402-solana-toolkit.**
