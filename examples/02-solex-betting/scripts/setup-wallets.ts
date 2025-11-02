/**
 * Setup Wallets Script
 *
 * Generates necessary wallets for the Solex Betting demo and provides
 * instructions for funding them with devnet SOL and USDC.
 */

import { Keypair } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Helper Functions
// ============================================================================

function generateWallet(name: string): {
  publicKey: string;
  privateKey: string;
} {
  const keypair = Keypair.generate();
  const privateKey = Buffer.from(keypair.secretKey).toString('base64');
  const publicKey = keypair.publicKey.toBase58();

  console.log(`\n${name}:`);
  console.log(`  Public Key: ${publicKey}`);
  console.log(`  Private Key: ${privateKey.substring(0, 20)}...`);

  return { publicKey, privateKey };
}

function updateEnvFile(
  treasuryPublicKey: string,
  agentPrivateKey: string,
  userPublicKey: string
): void {
  const envPath = path.join(__dirname, '..', '.env');
  const envExamplePath = path.join(__dirname, '..', '.env.example');

  // Read .env.example
  let envContent = fs.readFileSync(envExamplePath, 'utf-8');

  // Update wallet values
  envContent = envContent.replace(
    /SOLEX_TREASURY_WALLET=.*/,
    `SOLEX_TREASURY_WALLET=${treasuryPublicKey}`
  );
  envContent = envContent.replace(
    /AGENT_PRIVATE_KEY=.*/,
    `AGENT_PRIVATE_KEY=${agentPrivateKey}`
  );
  envContent = envContent.replace(
    /USER_WALLET=.*/,
    `USER_WALLET=${userPublicKey}`
  );

  // Write to .env
  fs.writeFileSync(envPath, envContent);

  console.log(`\n.env file created at: ${envPath}`);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('');
  console.log('================================================================');
  console.log('  Solex Betting Platform - Wallet Setup');
  console.log('================================================================');
  console.log('');
  console.log('Generating wallets for the demo...');
  console.log('');

  // Generate wallets
  const treasury = generateWallet('Treasury Wallet (receives x402 payments)');
  const agent = generateWallet('Agent Wallet (pays for API calls)');
  const user = generateWallet('User Wallet (places bets)');

  // Update .env file
  updateEnvFile(treasury.publicKey, agent.privateKey, user.publicKey);

  console.log('');
  console.log('================================================================');
  console.log('  Next Steps: Fund Wallets with Devnet Tokens');
  console.log('================================================================');
  console.log('');
  console.log('1. Get Devnet SOL (for transaction fees)');
  console.log('   Visit: https://faucet.solana.com');
  console.log('');
  console.log('   Fund AGENT wallet with 1 SOL:');
  console.log(`   ${agent.publicKey}`);
  console.log('');

  console.log('2. Get Devnet USDC (for payments)');
  console.log('   Visit: https://spl-token-faucet.com');
  console.log('   OR use CLI: spl-token create-account USDC');
  console.log('');
  console.log('   Fund AGENT wallet with 10 USDC:');
  console.log(`   ${agent.publicKey}`);
  console.log('');

  console.log('3. Verify balances');
  console.log('   Agent should have:');
  console.log('     - ~1 SOL (for tx fees)');
  console.log('     - ~10 USDC (for x402 payments)');
  console.log('');

  console.log('================================================================');
  console.log('  Quick Commands');
  console.log('================================================================');
  console.log('');
  console.log('Get SOL from faucet (replace with agent public key):');
  console.log(`  solana airdrop 1 ${agent.publicKey} --url devnet`);
  console.log('');
  console.log('Check SOL balance:');
  console.log(`  solana balance ${agent.publicKey} --url devnet`);
  console.log('');
  console.log('Check USDC balance (after getting USDC from faucet):');
  console.log(`  spl-token balance --owner ${agent.publicKey} --url devnet`);
  console.log('');

  console.log('================================================================');
  console.log('  Alternative: Use Existing Wallet');
  console.log('================================================================');
  console.log('');
  console.log('If you prefer to use an existing wallet:');
  console.log('  1. Export your private key from Phantom/Solflare');
  console.log('  2. Update AGENT_PRIVATE_KEY in .env file');
  console.log('  3. Ensure wallet has devnet SOL and USDC');
  console.log('');

  console.log('================================================================');
  console.log('  After Funding');
  console.log('================================================================');
  console.log('');
  console.log('Start the demo:');
  console.log('  npm run server   # Start API server');
  console.log('  npm run agent    # Run AI betting agent');
  console.log('');
  console.log('Or run both at once:');
  console.log('  npm run demo');
  console.log('');
  console.log('================================================================');
  console.log('');
}

main().catch(console.error);
