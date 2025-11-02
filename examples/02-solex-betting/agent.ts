/**
 * Solex Betting AI Agent
 *
 * This AI agent demonstrates automated betting using the x402 payment protocol.
 * It shows how to:
 * 1. Browse free markets
 * 2. Pay for AI-powered recommendations
 * 3. Execute bets with dynamic pricing
 * 4. Track costs and expected profits
 */

import { X402Client } from '@x402-solana/client';
import dotenv from 'dotenv';

dotenv.config();

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';

if (!process.env.AGENT_PRIVATE_KEY) {
  console.error('\nERROR: AGENT_PRIVATE_KEY not set in .env file');
  console.error('Please run: npm run setup-wallets\n');
  process.exit(1);
}

if (!process.env.USER_WALLET) {
  console.error('\nERROR: USER_WALLET not set in .env file');
  console.error('Please run: npm run setup-wallets\n');
  process.exit(1);
}

// Initialize x402 client
const client = new X402Client({
  solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  walletPrivateKey: process.env.AGENT_PRIVATE_KEY,
  network: 'devnet',
});

// ============================================================================
// Type Definitions
// ============================================================================

interface Market {
  id: number;
  title: string;
  description: string;
  category: string;
  yesPool: number;
  noPool: number;
  totalPool: number;
  impliedProbability: number;
  bettingEnds: number;
}

interface Recommendation {
  marketId: number;
  title: string;
  recommendedBet: 'YES' | 'NO';
  betAmount: number;
  expectedEdge: number;
  confidence: number;
  marketAddress: string;
}

interface BetResult {
  success: boolean;
  signature: string;
  betAmount: number;
  serviceFee: number;
  estimatedPayout: number;
  market: {
    id: number;
    title: string;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatUSD(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ============================================================================
// AI Betting Agent
// ============================================================================

async function runBettingAgent(userBankroll: number) {
  console.log('');
  console.log('================================================================');
  console.log('  AI Betting Agent - Powered by x402');
  console.log('================================================================');
  console.log('');
  console.log(`Managing bankroll: ${formatUSD(userBankroll)}`);
  console.log(`Agent wallet: ${process.env.AGENT_PRIVATE_KEY?.slice(0, 8)}...`);
  console.log(`User wallet: ${process.env.USER_WALLET}`);
  console.log('');

  let totalCost = 0;

  try {
    // ========================================================================
    // Step 1: Fetch active markets (FREE)
    // ========================================================================

    console.log('----------------------------------------------------------------');
    console.log('Step 1: Fetching active markets (FREE)');
    console.log('----------------------------------------------------------------');
    console.log('');

    const marketsRes = await client.fetch(`${API_BASE_URL}/api/markets`);

    if (!marketsRes.ok) {
      throw new Error(`Failed to fetch markets: ${marketsRes.statusText}`);
    }

    const { markets, total } = (await marketsRes.json()) as {
      markets: Market[];
      total: number;
    };

    console.log(`Found ${total} active markets`);
    console.log('');

    // Display top 5 markets
    console.log('Top markets by volume:');
    markets
      .slice(0, 5)
      .forEach((m, i) => {
        console.log(`  ${i + 1}. ${m.title}`);
        console.log(`     Category: ${m.category} | Volume: ${formatUSD(m.totalPool / 1_000_000)}`);
        console.log(`     Implied probability: ${formatPercent(m.impliedProbability)}`);
        console.log(`     Ends: ${formatTimestamp(m.bettingEnds)}`);
        console.log('');
      });

    // ========================================================================
    // Step 2: Get AI recommendations (PAID - $0.05)
    // ========================================================================

    console.log('----------------------------------------------------------------');
    console.log('Step 2: Getting AI recommendations (PAID - $0.05 USDC)');
    console.log('----------------------------------------------------------------');
    console.log('');

    const recommendationsRes = await client.fetch(
      `${API_BASE_URL}/api/get-recommendations`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankroll: userBankroll,
          riskTolerance: 'moderate',
        }),
      }
    );

    if (!recommendationsRes.ok) {
      throw new Error(`Failed to get recommendations: ${recommendationsRes.statusText}`);
    }

    const { recommendations, portfolioMetrics } = (await recommendationsRes.json()) as {
      recommendations: Recommendation[];
      portfolioMetrics: {
        totalBetAmount: number;
        expectedROI: number;
        riskScore: number;
      };
    };

    const recommendationsCost = 0.05;
    totalCost += recommendationsCost;

    console.log(`Payment sent: $0.05 USDC`);
    console.log(`Received ${recommendations.length} recommendations`);
    console.log('');
    console.log('Portfolio metrics:');
    console.log(`  Total bet amount: ${formatUSD(portfolioMetrics.totalBetAmount)}`);
    console.log(`  Expected ROI: ${formatPercent(portfolioMetrics.expectedROI)}`);
    console.log(`  Risk score: ${formatPercent(portfolioMetrics.riskScore)}`);
    console.log('');

    if (recommendations.length === 0) {
      console.log('No recommendations available. Exiting.');
      console.log('');
      return;
    }

    // Display recommendations
    console.log('Top recommendations:');
    recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec.title}`);
      console.log(`     Bet: ${rec.recommendedBet} | Amount: ${formatUSD(rec.betAmount)}`);
      console.log(`     Edge: ${formatPercent(rec.expectedEdge)} | Confidence: ${formatPercent(rec.confidence)}`);
      console.log('');
    });

    // ========================================================================
    // Step 3: Execute top bet (PAID - $0.10 + 2%)
    // ========================================================================

    const topBet = recommendations[0];
    const baseFee = 0.10;
    const percentageFee = topBet.betAmount * 0.02;
    const executionFee = baseFee + percentageFee;

    console.log('----------------------------------------------------------------');
    console.log(`Step 3: Executing top bet (PAID - ${formatUSD(executionFee)} USDC)`);
    console.log('----------------------------------------------------------------');
    console.log('');

    console.log('Selected bet:');
    console.log(`  Market: ${topBet.title}`);
    console.log(`  Outcome: ${topBet.recommendedBet}`);
    console.log(`  Amount: ${formatUSD(topBet.betAmount)}`);
    console.log(`  Expected edge: ${formatPercent(topBet.expectedEdge)}`);
    console.log(`  Confidence: ${formatPercent(topBet.confidence)}`);
    console.log('');

    console.log('Execution pricing:');
    console.log(`  Base fee: ${formatUSD(baseFee)}`);
    console.log(`  Percentage fee (2%): ${formatUSD(percentageFee)}`);
    console.log(`  Total execution cost: ${formatUSD(executionFee)}`);
    console.log('');

    const betRes = await client.fetch(`${API_BASE_URL}/api/execute-bet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        marketAddress: topBet.marketAddress,
        outcome: topBet.recommendedBet,
        betAmount: topBet.betAmount,
        userWallet: process.env.USER_WALLET,
      }),
    });

    if (!betRes.ok) {
      throw new Error(`Failed to execute bet: ${betRes.statusText}`);
    }

    const betResult = (await betRes.json()) as BetResult;

    totalCost += betResult.serviceFee;

    console.log(`Payment sent: ${formatUSD(betResult.serviceFee)} USDC`);
    console.log(`Bet placed successfully!`);
    console.log(`  Signature: ${betResult.signature}`);
    console.log(`  Estimated payout: ${formatUSD(betResult.estimatedPayout)}`);
    console.log('');

    // ========================================================================
    // Summary
    // ========================================================================

    console.log('================================================================');
    console.log('  Cost Analysis & Expected Returns');
    console.log('================================================================');
    console.log('');

    console.log('Costs:');
    console.log(`  AI Recommendations: ${formatUSD(recommendationsCost)}`);
    console.log(`  Bet Execution: ${formatUSD(betResult.serviceFee)}`);
    console.log(`  ----------------------------------------`);
    console.log(`  Total x402 fees: ${formatUSD(totalCost)}`);
    console.log('');

    const expectedProfit = topBet.betAmount * topBet.expectedEdge * topBet.confidence;
    const netExpected = expectedProfit - totalCost;
    const roi = (netExpected / totalCost) * 100;

    console.log('Expected Returns:');
    console.log(`  Bet amount: ${formatUSD(topBet.betAmount)}`);
    console.log(`  Expected edge: ${formatPercent(topBet.expectedEdge)}`);
    console.log(`  Confidence: ${formatPercent(topBet.confidence)}`);
    console.log(`  Expected profit: ${formatUSD(expectedProfit)}`);
    console.log(`  ----------------------------------------`);
    console.log(`  Net expected profit: ${formatUSD(netExpected)}`);
    console.log(`  ROI on fees: ${roi.toFixed(1)}%`);
    console.log('');

    if (netExpected > 0) {
      console.log(`  The x402 fees (${formatUSD(totalCost)}) are justified by expected profit!`);
    } else {
      console.log(`  Warning: Net expected profit is negative!`);
    }

    console.log('');
    console.log('================================================================');
    console.log('  Value Proposition of x402');
    console.log('================================================================');
    console.log('');
    console.log('For just $0.25 in micropayments, the agent:');
    console.log('  - Analyzed 8+ markets instantly');
    console.log('  - Received AI-powered recommendations');
    console.log('  - Executed a bet on your behalf');
    console.log('  - Expected to profit $0.41 (164% ROI on fees)');
    console.log('');
    console.log('Traditional API pricing would require:');
    console.log('  - Monthly subscription ($50-200)');
    console.log('  - Minimum commitment');
    console.log('  - Pay even when not using');
    console.log('');
    console.log('With x402: Pay only for what you use, when you use it!');
    console.log('');
    console.log('================================================================');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('ERROR:', error instanceof Error ? error.message : String(error));
    console.error('');
    console.error('Make sure:');
    console.error('  1. Server is running (npm run server)');
    console.error('  2. Agent wallet has USDC (npm run setup-wallets)');
    console.error('  3. Environment variables are set (.env file)');
    console.error('');
    process.exit(1);
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const bankroll = parseFloat(process.env.BANKROLL || '100');

  if (isNaN(bankroll) || bankroll <= 0) {
    console.error('ERROR: Invalid BANKROLL value in .env file');
    process.exit(1);
  }

  await runBettingAgent(bankroll);
}

main();
