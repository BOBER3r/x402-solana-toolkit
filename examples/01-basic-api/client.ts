/**
 * Basic x402 API Example - Client
 *
 * This example shows how simple it is to call paid APIs:
 * - Same interface as fetch()
 * - Automatic payment handling
 * - Less than 30 lines of code
 */

import { X402Client } from '@x402-solana/client';
import dotenv from 'dotenv';

dotenv.config();

// Initialize x402 client
const client = new X402Client({
  solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  walletPrivateKey: process.env.WALLET_PRIVATE_KEY!,
  network: 'devnet',
});

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function demo() {
  console.log('\n=== Basic x402 Client Demo ===\n');

  // 1. Call free endpoint (no payment)
  console.log('1. Calling FREE endpoint...');
  const freeResponse = await client.fetch(`${API_URL}/api/hello`);
  const freeData = await freeResponse.json();
  console.log('   Response:', freeData);

  // 2. Call paid endpoint (automatic payment!)
  console.log('\n2. Calling PAID endpoint ($0.001)...');
  const paidResponse = await client.fetch(`${API_URL}/api/premium-hello`);
  const paidData = await paidResponse.json();
  console.log('   Response:', paidData);
  console.log('   Payment verified! Paid by:', paidData.paidBy);

  console.log('\n=== Demo complete! ===\n');
}

demo().catch(console.error);
