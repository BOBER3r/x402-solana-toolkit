/**
 * Advanced usage example for @x402-solana/client
 *
 * This example demonstrates:
 * 1. Using PaymentSender for manual payments
 * 2. Estimating payment costs
 * 3. Error handling
 * 4. Custom retry logic
 */

import {
  X402Client,
  PaymentSender,
  PaymentError,
  PaymentErrorCode,
} from '../src';
import { Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

async function manualPaymentExample() {
  console.log('=== Manual Payment Example ===\n');

  const connection = new Connection('https://api.devnet.solana.com');
  const wallet = Keypair.generate();
  const sender = new PaymentSender(connection, wallet);

  const usdcMint = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; // devnet

  // 1. Estimate payment cost
  console.log('1. Estimating payment cost...');
  const estimate = await sender.estimatePaymentCost(0.5, usdcMint);

  console.log(`   USDC Amount: ${estimate.usdcAmount} USDC`);
  console.log(`   SOL Fee: ${estimate.solFee} SOL`);
  console.log(`   Total (USD): $${estimate.totalUSD}`);
  console.log(`   Current USDC Balance: ${estimate.currentUSDCBalance} USDC`);
  console.log(`   Current SOL Balance: ${estimate.currentSOLBalance} SOL`);
  console.log(`   Has Sufficient Balance: ${estimate.hasSufficientBalance}\n`);

  // 2. Send payment (would fail without balance)
  console.log('2. Sending USDC payment...');
  if (estimate.hasSufficientBalance) {
    try {
      const signature = await sender.sendUSDC(
        'recipient-address',
        0.5,
        usdcMint
      );
      console.log(`   Payment sent: ${signature}\n`);
    } catch (error) {
      console.log(`   Payment failed: ${error}\n`);
    }
  } else {
    console.log('   Skipping - insufficient balance\n');
  }
}

async function errorHandlingExample() {
  console.log('=== Error Handling Example ===\n');

  const wallet = Keypair.generate();

  const client = new X402Client({
    solanaRpcUrl: 'https://api.devnet.solana.com',
    walletPrivateKey: bs58.encode(wallet.secretKey),
    network: 'devnet',
  });

  try {
    // This would normally make a request
    console.log('Making request...');

    // Simulated error handling
    throw new PaymentError(
      'Insufficient balance',
      PaymentErrorCode.INSUFFICIENT_BALANCE,
      { balance: 0, required: 500000 }
    );
  } catch (error) {
    if (error instanceof PaymentError) {
      console.log(`\nPayment Error Caught:`);
      console.log(`  Code: ${error.code}`);
      console.log(`  Message: ${error.message}`);
      console.log(`  Details:`, error.details);

      switch (error.code) {
        case PaymentErrorCode.INSUFFICIENT_BALANCE:
          console.log('\n  Action: Please fund your wallet with USDC');
          break;
        case PaymentErrorCode.TRANSACTION_FAILED:
          console.log('\n  Action: Check transaction details and retry');
          break;
        case PaymentErrorCode.NETWORK_ERROR:
          console.log('\n  Action: Check network connection and RPC endpoint');
          break;
        default:
          console.log('\n  Action: Unknown error, please investigate');
      }
    }
  }

  console.log();
}

async function customRetryExample() {
  console.log('=== Custom Retry Logic Example ===\n');

  const wallet = Keypair.generate();

  // Disable auto-retry
  const client = new X402Client({
    solanaRpcUrl: 'https://api.devnet.solana.com',
    walletPrivateKey: bs58.encode(wallet.secretKey),
    network: 'devnet',
    autoRetry: false,
  });

  console.log('Making request with manual retry logic...');

  /*
   * In a real scenario:
   *
   * let response = await client.fetch('https://api.example.com/data');
   *
   * if (response.status === 402) {
   *   const paymentReq = await response.json();
   *
   *   // Custom logic here - e.g., ask user for confirmation
   *   console.log('Payment required:', paymentReq);
   *
   *   const userConfirmed = await askUser(
   *     `Pay ${paymentReq.accepts[0].maxAmountRequired} micro-USDC?`
   *   );
   *
   *   if (userConfirmed) {
   *     // Create payment manually using PaymentSender
   *     // Then retry request with payment proof
   *   }
   * }
   */

  console.log('Custom retry logic would be implemented here\n');
}

async function batchRequestsExample() {
  console.log('=== Batch Requests Example ===\n');

  const wallet = Keypair.generate();

  const client = new X402Client({
    solanaRpcUrl: 'https://api.devnet.solana.com',
    walletPrivateKey: bs58.encode(wallet.secretKey),
    network: 'devnet',
    debug: true,
  });

  console.log('Making multiple requests...');

  const urls = [
    'https://api.example.com/data1',
    'https://api.example.com/data2',
    'https://api.example.com/data3',
  ];

  /*
   * In a real scenario:
   *
   * const results = await Promise.all(
   *   urls.map(async (url) => {
   *     try {
   *       const response = await client.fetch(url);
   *       return { url, data: await response.json() };
   *     } catch (error) {
   *       return { url, error: error.message };
   *     }
   *   })
   * );
   *
   * results.forEach((result) => {
   *   if (result.error) {
   *     console.log(`${result.url}: Error - ${result.error}`);
   *   } else {
   *     console.log(`${result.url}: Success`, result.data);
   *   }
   * });
   */

  console.log(`Would make ${urls.length} requests in parallel\n`);
}

async function main() {
  await manualPaymentExample();
  await errorHandlingExample();
  await customRetryExample();
  await batchRequestsExample();

  console.log('=== All Examples Complete ===');
}

// Run examples
if (require.main === module) {
  main().catch(console.error);
}

export { main };
