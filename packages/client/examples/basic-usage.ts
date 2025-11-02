/**
 * Basic usage example for @x402-solana/client
 *
 * This example demonstrates:
 * 1. Creating a wallet
 * 2. Funding it on devnet
 * 3. Making requests that require payment
 * 4. Checking balances
 */

import { X402Client, WalletManager } from '../src';
import { Connection, PublicKey } from '@solana/web3.js';

async function main() {
  console.log('=== @x402-solana/client Example ===\n');

  // 1. Generate a new wallet (or use existing)
  console.log('1. Generating wallet...');
  const wallet = WalletManager.generateWallet();
  console.log(`   Public Key: ${wallet.publicKey}`);
  console.log(`   Private Key: ${wallet.privateKey.substring(0, 20)}...\n`);

  // 2. Fund wallet on devnet (for testing)
  console.log('2. Requesting SOL airdrop on devnet...');
  const connection = new Connection('https://api.devnet.solana.com');

  try {
    const airdropSignature = await WalletManager.airdropSOL(
      connection,
      new PublicKey(wallet.publicKey),
      1.0
    );
    console.log(`   Airdrop successful: ${airdropSignature}\n`);
  } catch (error) {
    console.log(`   Airdrop failed (rate limit?): ${error}\n`);
  }

  // 3. Create X402Client
  console.log('3. Creating X402Client...');
  const client = new X402Client({
    solanaRpcUrl: 'https://api.devnet.solana.com',
    walletPrivateKey: wallet.privateKey,
    network: 'devnet',
    debug: true, // Enable debug logging
  });
  console.log('   Client created\n');

  // 4. Check balances
  console.log('4. Checking balances...');
  const solBalance = await client.getSOLBalance();
  const usdcBalance = await client.getUSDCBalance();
  console.log(`   SOL Balance: ${solBalance} SOL`);
  console.log(`   USDC Balance: ${usdcBalance} USDC\n`);

  // 5. Make a request (will handle 402 automatically)
  console.log('5. Making request to paid API...');
  console.log('   (This example uses a mock endpoint)\n');

  /*
   * In a real scenario:
   *
   * try {
   *   const response = await client.fetch('https://api.example.com/premium-data');
   *
   *   if (response.status === 200) {
   *     const data = await response.json();
   *     console.log('   Data received:', data);
   *   } else {
   *     console.log('   Request failed:', response.status);
   *   }
   * } catch (error) {
   *   console.error('   Error:', error);
   * }
   */

  console.log('=== Example Complete ===');
}

// Run example
if (require.main === module) {
  main().catch(console.error);
}

export { main };
