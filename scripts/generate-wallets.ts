/**
 * Generate wallets for Phase 4 testing
 * Creates treasury wallet (server) and agent wallet (client)
 */

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import fs from 'fs';
import path from 'path';

interface WalletInfo {
  publicKey: string;
  privateKey: string;
  role: string;
}

function generateWallet(role: string): WalletInfo {
  const keypair = Keypair.generate();

  return {
    publicKey: keypair.publicKey.toBase58(),
    privateKey: bs58.encode(keypair.secretKey),
    role,
  };
}

function main() {
  console.log('🔐 Generating Wallets for Phase 4 Testing\n');
  console.log('='.repeat(60));

  // Generate treasury wallet (server recipient)
  console.log('\n📥 Generating Treasury Wallet (Server Recipient)...');
  const treasury = generateWallet('treasury');
  console.log(`✅ Public Key:  ${treasury.publicKey}`);
  console.log(`🔑 Private Key: ${treasury.privateKey.substring(0, 20)}...`);

  // Generate agent wallet (client payer)
  console.log('\n📤 Generating Agent Wallet (Client Payer)...');
  const agent = generateWallet('agent');
  console.log(`✅ Public Key:  ${agent.publicKey}`);
  console.log(`🔑 Private Key: ${agent.privateKey.substring(0, 20)}...`);

  // Save to .env format
  console.log('\n📝 Creating .env files...');

  const rootEnv = `# Phase 4 Test Wallets - Generated ${new Date().toISOString()}

# Treasury Wallet (Server Recipient)
TREASURY_PUBKEY=${treasury.publicKey}
TREASURY_PRIVATE_KEY=${treasury.privateKey}

# Agent Wallet (Client Payer)
AGENT_PUBKEY=${agent.publicKey}
AGENT_PRIVATE_KEY=${agent.privateKey}

# Network Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
NETWORK=devnet

# USDC Devnet Mint
USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
`;

  const envPath = path.join(__dirname, '..', '.env.phase4');
  fs.writeFileSync(envPath, rootEnv);
  console.log(`✅ Saved to: .env.phase4`);

  // Save full details to JSON for reference
  const walletsInfo = {
    generated: new Date().toISOString(),
    treasury,
    agent,
    network: 'devnet',
    usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  };

  const jsonPath = path.join(__dirname, 'wallets.json');
  fs.writeFileSync(jsonPath, JSON.stringify(walletsInfo, null, 2));
  console.log(`✅ Saved to: scripts/wallets.json`);

  // Print funding instructions
  console.log('\n' + '='.repeat(60));
  console.log('\n🚀 NEXT STEPS - Fund These Wallets:\n');

  console.log('1️⃣  Fund Treasury with SOL (for transaction fees):');
  console.log(`   solana airdrop 2 ${treasury.publicKey} --url devnet\n`);

  console.log('2️⃣  Fund Agent with SOL (for transaction fees):');
  console.log(`   solana airdrop 2 ${agent.publicKey} --url devnet\n`);

  console.log('3️⃣  Fund Agent with USDC (for payments):');
  console.log(`   Visit: https://spl-token-faucet.com`);
  console.log(`   Wallet: ${agent.publicKey}`);
  console.log(`   Token: USDC (Devnet)`);
  console.log(`   Amount: Request 10 USDC\n`);

  console.log('4️⃣  Verify balances:');
  console.log(`   solana balance ${treasury.publicKey} --url devnet`);
  console.log(`   solana balance ${agent.publicKey} --url devnet`);
  console.log(`   spl-token balance --owner ${agent.publicKey} --url devnet\n`);

  console.log('='.repeat(60));
  console.log('\n✅ Wallet generation complete!');
  console.log('\n💡 Use .env.phase4 for environment variables');
  console.log('💡 Keep wallets.json SECURE (contains private keys)\n');
}

main();
