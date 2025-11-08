/**
 * Fastify x402 API Example - Client
 * Tests all endpoints (free and paid)
 */

import { X402Client } from '@x402-solana/client';
import dotenv from 'dotenv';

dotenv.config();

const client = new X402Client({
  solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  walletPrivateKey: process.env.WALLET_PRIVATE_KEY!,
  network: 'devnet',
});

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function demo() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║            Fastify x402 Client Demo                          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Call free endpoint
    console.log('1. FREE TIER - Hello Endpoint');
    console.log('   ===========================\n');
    const freeResponse = await client.fetch(`${API_URL}/api/hello`);
    const freeData = await freeResponse.json();
    console.log('   Response:', JSON.stringify(freeData, null, 2));

    // 2. Call premium endpoint ($0.001)
    console.log('\n2. PREMIUM TIER - $0.001');
    console.log('   =====================\n');
    console.log('   Making payment automatically...\n');
    const premiumResponse = await client.fetch(`${API_URL}/api/premium`);
    const premiumData = await premiumResponse.json();
    console.log('   Response:', JSON.stringify(premiumData, null, 2));
    console.log(`\n   ✓ Payment verified! Paid by: ${premiumData.paidBy}`);

    // 3. Call analytics endpoint ($0.005)
    console.log('\n3. ANALYTICS TIER - $0.005');
    console.log('   =======================\n');
    console.log('   Making payment automatically...\n');
    const analyticsResponse = await client.fetch(`${API_URL}/api/analytics`);
    const analyticsData = await analyticsResponse.json();
    console.log('   Response:', JSON.stringify(analyticsData, null, 2));
    console.log(`\n   ✓ Payment verified! Paid by: ${analyticsData.paidBy}`);

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    Demo Complete!                             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('Summary:');
    console.log('  - Called FREE endpoint (no payment)');
    console.log('  - Paid $0.001 for premium data');
    console.log('  - Paid $0.005 for analytics data');
    console.log('  - Total spent: $0.006 (0.6 cents)\n');
    console.log('All payments were handled automatically by x402!\n');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', await error.response.text());
    }
    process.exit(1);
  }
}

demo();