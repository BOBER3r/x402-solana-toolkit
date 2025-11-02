/**
 * Solex Betting Platform - x402 API Server
 *
 * This showcase demonstrates a real-world betting platform API that uses x402
 * micropayments to monetize AI-powered market analysis and bet execution.
 *
 * The server provides:
 * - FREE endpoint: List active markets
 * - PAID endpoints: Market analysis ($0.01), recommendations ($0.05), bet execution ($0.10 + 2%)
 */

import express, { Request, Response, NextFunction } from 'express';
import { X402Middleware } from '@x402-solana/server';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// ============================================================================
// Sample Markets Database (In-Memory)
// ============================================================================

interface Market {
  id: number;
  title: string;
  description: string;
  category: 'crypto' | 'sports' | 'politics' | 'entertainment' | 'weather';
  yesPool: number; // micro-USDC (1 USDC = 1,000,000 micro-USDC)
  noPool: number; // micro-USDC
  totalPool: number; // micro-USDC
  bettingEnds: number; // Unix timestamp
  isResolved: boolean;
  marketAddress?: string; // Solana program address
}

const sampleMarkets: Market[] = [
  {
    id: 1,
    title: 'Will Bitcoin reach $100k by EOY 2025?',
    description: 'Bitcoin must close above $100,000 USD on any exchange by December 31, 2025 23:59 UTC',
    category: 'crypto',
    yesPool: 150000000, // $150 USDC
    noPool: 100000000, // $100 USDC
    totalPool: 250000000, // $250 USDC
    bettingEnds: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
    isResolved: false,
    marketAddress: 'BTC100k2025Market1111111111111111111111111',
  },
  {
    id: 2,
    title: 'Will Ethereum flip Bitcoin by market cap in 2025?',
    description: 'Ethereum market cap must exceed Bitcoin market cap for 7 consecutive days',
    category: 'crypto',
    yesPool: 80000000, // $80 USDC
    noPool: 220000000, // $220 USDC
    totalPool: 300000000, // $300 USDC
    bettingEnds: Math.floor(Date.now() / 1000) + 86400 * 45,
    isResolved: false,
    marketAddress: 'ETHFlipBTC2025Market1111111111111111111111',
  },
  {
    id: 3,
    title: 'Will Solana TVL exceed $10B in 2025?',
    description: 'Total Value Locked in Solana DeFi must exceed $10 billion according to DefiLlama',
    category: 'crypto',
    yesPool: 180000000, // $180 USDC
    noPool: 120000000, // $120 USDC
    totalPool: 300000000, // $300 USDC
    bettingEnds: Math.floor(Date.now() / 1000) + 86400 * 60,
    isResolved: false,
    marketAddress: 'SolanaTVL10BMarket11111111111111111111111',
  },
  {
    id: 4,
    title: 'Will the S&P 500 reach 7000 in 2025?',
    description: 'S&P 500 index must close at or above 7000 points on any trading day in 2025',
    category: 'politics',
    yesPool: 200000000, // $200 USDC
    noPool: 150000000, // $150 USDC
    totalPool: 350000000, // $350 USDC
    bettingEnds: Math.floor(Date.now() / 1000) + 86400 * 90,
    isResolved: false,
    marketAddress: 'SP5007000Market111111111111111111111111111',
  },
  {
    id: 5,
    title: 'Will a major tech company announce AI chip by Q2 2025?',
    description: 'Apple, Google, Microsoft, or Meta must announce dedicated AI chip by June 30, 2025',
    category: 'entertainment',
    yesPool: 90000000, // $90 USDC
    noPool: 110000000, // $110 USDC
    totalPool: 200000000, // $200 USDC
    bettingEnds: Math.floor(Date.now() / 1000) + 86400 * 20,
    isResolved: false,
    marketAddress: 'TechAIChipQ2Market111111111111111111111111',
  },
  {
    id: 6,
    title: 'Will global average temperature be warmest on record in 2025?',
    description: 'NOAA must declare 2025 as warmest year globally in their annual report',
    category: 'weather',
    yesPool: 130000000, // $130 USDC
    noPool: 70000000, // $70 USDC
    totalPool: 200000000, // $200 USDC
    bettingEnds: Math.floor(Date.now() / 1000) + 86400 * 120,
    isResolved: false,
    marketAddress: 'GlobalTempRecord2025Market1111111111111111',
  },
  {
    id: 7,
    title: 'Will XRP win SEC lawsuit appeal in 2025?',
    description: 'Ripple must win final SEC appeal decision in 2025 calendar year',
    category: 'crypto',
    yesPool: 160000000, // $160 USDC
    noPool: 140000000, // $140 USDC
    totalPool: 300000000, // $300 USDC
    bettingEnds: Math.floor(Date.now() / 1000) + 86400 * 75,
    isResolved: false,
    marketAddress: 'XRPSECAppeal2025Market111111111111111111111',
  },
  {
    id: 8,
    title: 'Will a new COVID variant cause global lockdowns in 2025?',
    description: 'At least 3 G20 countries must implement nationwide lockdown measures',
    category: 'politics',
    yesPool: 40000000, // $40 USDC
    noPool: 160000000, // $160 USDC
    totalPool: 200000000, // $200 USDC
    bettingEnds: Math.floor(Date.now() / 1000) + 86400 * 100,
    isResolved: false,
    marketAddress: 'COVIDLockdown2025Market1111111111111111111',
  },
];

// ============================================================================
// Initialize x402 Middleware
// ============================================================================

const x402 = new X402Middleware({
  solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  recipientWallet: process.env.SOLEX_TREASURY_WALLET!,
  network: 'devnet',
});

if (!process.env.SOLEX_TREASURY_WALLET) {
  console.error('\nERROR: SOLEX_TREASURY_WALLET not set in .env file');
  console.error('Please run: npm run setup-wallets\n');
  process.exit(1);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate implied probability from pool sizes
 */
function calculateImpliedProbability(yesPool: number, noPool: number): number {
  return yesPool / (yesPool + noPool);
}

/**
 * Simple AI analysis (placeholder for actual AI model)
 */
function analyzeMarket(market: Market): {
  recommendation: 'BUY_YES' | 'BUY_NO' | 'HOLD';
  confidence: number;
  reasoning: string;
  fairProbability: number;
} {
  const impliedProb = calculateImpliedProbability(market.yesPool, market.noPool);

  // Simple heuristic: if market is heavily weighted, bet against it
  let fairProbability: number;
  let recommendation: 'BUY_YES' | 'BUY_NO' | 'HOLD';
  let reasoning: string;

  if (impliedProb > 0.65) {
    fairProbability = impliedProb - 0.15;
    recommendation = 'BUY_NO';
    reasoning = 'Market is overconfident on YES. Historical data suggests mean reversion.';
  } else if (impliedProb < 0.35) {
    fairProbability = impliedProb + 0.15;
    recommendation = 'BUY_YES';
    reasoning = 'Market is underpricing YES outcome. Strong fundamentals support upside.';
  } else {
    fairProbability = impliedProb + (Math.random() * 0.1 - 0.05);
    recommendation = 'HOLD';
    reasoning = 'Market appears fairly priced. Wait for better entry point.';
  }

  const confidence = 0.6 + Math.random() * 0.3; // 60-90% confidence

  return { recommendation, confidence, reasoning, fairProbability };
}

/**
 * Generate portfolio recommendations
 */
function generateRecommendations(
  markets: Market[],
  bankroll: number,
  riskTolerance: 'conservative' | 'moderate' | 'aggressive'
): Array<{
  marketId: number;
  title: string;
  recommendedBet: 'YES' | 'NO';
  betAmount: number;
  expectedEdge: number;
  confidence: number;
  marketAddress: string;
}> {
  const betSizeMultiplier = {
    conservative: 0.03, // 3% per bet
    moderate: 0.05, // 5% per bet
    aggressive: 0.10, // 10% per bet
  }[riskTolerance];

  const recommendations = markets
    .slice(0, 8)
    .map(market => {
      const analysis = analyzeMarket(market);
      const impliedProb = calculateImpliedProbability(market.yesPool, market.noPool);
      const edge = Math.abs(analysis.fairProbability - impliedProb);

      return {
        marketId: market.id,
        title: market.title,
        recommendedBet: analysis.recommendation === 'BUY_YES' ? 'YES' as const : 'NO' as const,
        betAmount: bankroll * betSizeMultiplier,
        expectedEdge: edge,
        confidence: analysis.confidence,
        marketAddress: market.marketAddress || '',
      };
    })
    .filter(rec => rec.expectedEdge > 0.05) // Only recommend if edge > 5%
    .sort((a, b) => (b.expectedEdge * b.confidence) - (a.expectedEdge * a.confidence))
    .slice(0, 5);

  return recommendations;
}

// ============================================================================
// FREE ENDPOINTS
// ============================================================================

/**
 * GET /api/markets
 *
 * Returns list of active betting markets.
 * This is a FREE endpoint to allow users to browse markets.
 */
app.get('/api/markets', async (req: Request, res: Response) => {
  console.log('[FREE] GET /api/markets');

  const activeMarkets = sampleMarkets.filter(m =>
    !m.isResolved && m.bettingEnds > Math.floor(Date.now() / 1000)
  );

  res.json({
    markets: activeMarkets.map(m => ({
      id: m.id,
      title: m.title,
      description: m.description,
      category: m.category,
      yesPool: m.yesPool,
      noPool: m.noPool,
      totalPool: m.totalPool,
      impliedProbability: calculateImpliedProbability(m.yesPool, m.noPool),
      bettingEnds: m.bettingEnds,
    })),
    total: activeMarkets.length,
  });
});

// ============================================================================
// PAID ENDPOINTS
// ============================================================================

/**
 * POST /api/analyze-market
 *
 * AI analysis of a single market.
 * Price: $0.01 USDC
 *
 * Request body:
 * {
 *   "marketId": number
 * }
 *
 * Response:
 * {
 *   "marketId": number,
 *   "title": string,
 *   "impliedProbability": number,
 *   "fairProbability": number,
 *   "recommendation": "BUY_YES" | "BUY_NO" | "HOLD",
 *   "confidence": number,
 *   "reasoning": string,
 *   "currentOdds": number,
 *   "volume": number
 * }
 */
app.post(
  '/api/analyze-market',
  x402.requirePayment(0.01),
  async (req: Request, res: Response) => {
    const { marketId } = req.body;

    console.log(`[PAID $0.01] POST /api/analyze-market - Market ${marketId}`);

    if (!marketId) {
      return res.status(400).json({ error: 'marketId is required' });
    }

    const market = sampleMarkets.find(m => m.id === marketId);

    if (!market) {
      return res.status(404).json({ error: 'Market not found' });
    }

    const analysis = analyzeMarket(market);
    const impliedProbability = calculateImpliedProbability(market.yesPool, market.noPool);

    res.json({
      marketId: market.id,
      title: market.title,
      impliedProbability,
      fairProbability: analysis.fairProbability,
      recommendation: analysis.recommendation,
      confidence: analysis.confidence,
      reasoning: analysis.reasoning,
      currentOdds: market.yesPool / market.noPool,
      volume: market.totalPool / 1_000_000, // Convert to USDC
    });
  }
);

/**
 * POST /api/get-recommendations
 *
 * Get AI-powered portfolio recommendations based on bankroll and risk tolerance.
 * Price: $0.05 USDC
 *
 * Request body:
 * {
 *   "bankroll": number,
 *   "riskTolerance": "conservative" | "moderate" | "aggressive",
 *   "categories"?: string[]
 * }
 *
 * Response:
 * {
 *   "recommendations": Array<{
 *     "marketId": number,
 *     "title": string,
 *     "recommendedBet": "YES" | "NO",
 *     "betAmount": number,
 *     "expectedEdge": number,
 *     "confidence": number
 *   }>,
 *   "portfolioMetrics": {
 *     "totalBetAmount": number,
 *     "expectedROI": number,
 *     "riskScore": number
 *   }
 * }
 */
app.post(
  '/api/get-recommendations',
  x402.requirePayment(0.05),
  async (req: Request, res: Response) => {
    const { bankroll, riskTolerance = 'moderate', categories } = req.body;

    console.log(`[PAID $0.05] POST /api/get-recommendations - Bankroll: $${bankroll}`);

    if (!bankroll || bankroll <= 0) {
      return res.status(400).json({ error: 'Valid bankroll is required' });
    }

    if (!['conservative', 'moderate', 'aggressive'].includes(riskTolerance)) {
      return res.status(400).json({
        error: 'riskTolerance must be conservative, moderate, or aggressive'
      });
    }

    let markets = sampleMarkets.filter(m =>
      !m.isResolved && m.bettingEnds > Math.floor(Date.now() / 1000)
    );

    if (categories && categories.length > 0) {
      markets = markets.filter(m => categories.includes(m.category));
    }

    const recommendations = generateRecommendations(markets, bankroll, riskTolerance);

    const totalBetAmount = recommendations.reduce((sum, r) => sum + r.betAmount, 0);
    const expectedROI = recommendations.reduce(
      (sum, r) => sum + (r.betAmount * r.expectedEdge * r.confidence),
      0
    ) / totalBetAmount;

    const riskScore = {
      conservative: 0.3,
      moderate: 0.5,
      aggressive: 0.8,
    }[riskTolerance];

    res.json({
      recommendations,
      portfolioMetrics: {
        totalBetAmount,
        expectedROI,
        riskScore,
      },
    });
  }
);

/**
 * POST /api/execute-bet
 *
 * Execute a bet on behalf of the user.
 * Price: $0.10 + 2% of bet amount (dynamic pricing)
 *
 * Request body:
 * {
 *   "marketAddress": string,
 *   "outcome": "YES" | "NO",
 *   "betAmount": number,
 *   "userWallet": string
 * }
 *
 * Response:
 * {
 *   "success": boolean,
 *   "signature": string,
 *   "betAmount": number,
 *   "serviceFee": number,
 *   "estimatedPayout": number
 * }
 */
app.post(
  '/api/execute-bet',
  async (req: Request, res: Response, next: NextFunction) => {
    const { betAmount } = req.body;

    if (!betAmount || betAmount <= 0) {
      return res.status(400).json({ error: 'Valid betAmount is required' });
    }

    // Dynamic pricing: $0.10 base + 2% of bet amount
    const price = 0.10 + (betAmount * 0.02);

    console.log(`[PAID $${price.toFixed(4)}] POST /api/execute-bet - Bet: $${betAmount}`);

    // Apply payment requirement
    return x402.requirePayment(price)(req, res, next);
  },
  async (req: Request, res: Response) => {
    const { marketAddress, outcome, betAmount, userWallet } = req.body;

    if (!marketAddress || !outcome || !userWallet) {
      return res.status(400).json({
        error: 'marketAddress, outcome, and userWallet are required'
      });
    }

    if (!['YES', 'NO'].includes(outcome)) {
      return res.status(400).json({ error: 'outcome must be YES or NO' });
    }

    // Find market
    const market = sampleMarkets.find(m => m.marketAddress === marketAddress);
    if (!market) {
      return res.status(404).json({ error: 'Market not found' });
    }

    // Calculate estimated payout based on current pool odds
    const currentPool = outcome === 'YES' ? market.yesPool : market.noPool;
    const oppositePool = outcome === 'YES' ? market.noPool : market.yesPool;
    const estimatedPayout = betAmount * (oppositePool / currentPool);

    // In a real implementation, this would:
    // 1. Create Solana transaction to interact with betting program
    // 2. Sign with server's hot wallet
    // 3. Submit to blockchain
    // For demo purposes, we return a mock response

    const mockSignature = `BET_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;

    res.json({
      success: true,
      signature: mockSignature,
      betAmount,
      serviceFee: (req as any).payment?.amount || (0.10 + betAmount * 0.02),
      estimatedPayout,
      market: {
        id: market.id,
        title: market.title,
      },
    });
  }
);

// ============================================================================
// Error Handling
// ============================================================================

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// ============================================================================
// Start Server
// ============================================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('');
  console.log('================================================================');
  console.log('  Solex Betting Platform - x402 API Server');
  console.log('================================================================');
  console.log('');
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('');
  console.log('FREE Endpoints:');
  console.log(`  GET  http://localhost:${PORT}/api/markets`);
  console.log('');
  console.log('PAID Endpoints:');
  console.log(`  POST http://localhost:${PORT}/api/analyze-market ($0.01 USDC)`);
  console.log(`  POST http://localhost:${PORT}/api/get-recommendations ($0.05 USDC)`);
  console.log(`  POST http://localhost:${PORT}/api/execute-bet ($0.10 + 2% USDC)`);
  console.log('');
  console.log('Treasury Wallet:', process.env.SOLEX_TREASURY_WALLET);
  console.log('Network:', 'devnet');
  console.log('');
  console.log('Ready to accept x402 payments!');
  console.log('================================================================');
  console.log('');
});
