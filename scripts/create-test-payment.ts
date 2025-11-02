/**
 * Step 3: Create a real USDC transfer on devnet
 * This will generate a transaction signature we can use to test our parser
 */

import { Connection, Keypair, Transaction, PublicKey } from '@solana/web3.js';
import { createTransferInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import bs58 from 'bs58';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('💸 Creating Test USDC Payment on Devnet\n');
  console.log('='.repeat(60));

  // Load wallets
  const walletsPath = path.join(__dirname, 'wallets.json');
  const wallets = JSON.parse(fs.readFileSync(walletsPath, 'utf-8'));

  // USDC mint (the one you sent)
  const usdcMint = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');

  // Connect to devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  // Load agent wallet (payer)
  const agentKeypair = Keypair.fromSecretKey(bs58.decode(wallets.agent.privateKey));
  console.log(`\n📤 Agent (Payer): ${wallets.agent.publicKey}`);

  // Load treasury wallet (recipient)
  const treasuryPubkey = new PublicKey(wallets.treasury.publicKey);
  console.log(`📥 Treasury (Recipient): ${wallets.treasury.publicKey}`);

  // Get associated token accounts
  console.log('\n🔍 Deriving token accounts...');
  const agentTokenAccount = getAssociatedTokenAddressSync(usdcMint, agentKeypair.publicKey);
  const treasuryTokenAccount = getAssociatedTokenAddressSync(usdcMint, treasuryPubkey);

  console.log(`   Agent USDC Account: ${agentTokenAccount.toBase58()}`);
  console.log(`   Treasury USDC Account: ${treasuryTokenAccount.toBase58()}`);

  // Check if treasury token account exists
  console.log('\n🔍 Checking if treasury token account exists...');
  const treasuryAccountInfo = await connection.getAccountInfo(treasuryTokenAccount);

  // Amount: 0.01 USDC = 10,000 micro-USDC (6 decimals)
  const amountUSD = 0.01;
  const amountMicroUSDC = Math.floor(amountUSD * 1_000_000);
  console.log(`\n💰 Amount: ${amountUSD} USDC (${amountMicroUSDC} micro-USDC)`);

  // Check agent balance
  const agentBalance = await connection.getTokenAccountBalance(agentTokenAccount);
  console.log(`\n✅ Agent USDC Balance: ${agentBalance.value.uiAmount} USDC`);

  if (agentBalance.value.uiAmount! < amountUSD) {
    throw new Error(`Insufficient balance! Need ${amountUSD} USDC, have ${agentBalance.value.uiAmount}`);
  }

  // Build transaction
  console.log('\n🔨 Building transaction...');
  const transaction = new Transaction();

  // If treasury token account doesn't exist, create it first
  if (!treasuryAccountInfo) {
    console.log('⚠️  Treasury token account does not exist. Creating it...');
    const { createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');

    const createAccountIx = createAssociatedTokenAccountInstruction(
      agentKeypair.publicKey, // payer
      treasuryTokenAccount,    // ata
      treasuryPubkey,          // owner
      usdcMint                 // mint
    );

    transaction.add(createAccountIx);
    console.log('   ✅ Added create account instruction');
  } else {
    console.log('   ✅ Treasury token account already exists');
  }

  // Add transfer instruction
  const transferIx = createTransferInstruction(
    agentTokenAccount,       // source
    treasuryTokenAccount,    // destination
    agentKeypair.publicKey,  // owner
    amountMicroUSDC          // amount
  );

  transaction.add(transferIx);
  console.log('   ✅ Added transfer instruction');

  // Get recent blockhash
  console.log('\n⏳ Getting recent blockhash...');
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = agentKeypair.publicKey;

  // Sign transaction
  console.log('🔏 Signing transaction...');
  transaction.sign(agentKeypair);

  // Send transaction
  console.log('📡 Sending transaction to devnet...');
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  console.log(`\n✅ Transaction sent!`);
  console.log(`   Signature: ${signature}`);
  console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

  // Wait for confirmation
  console.log('\n⏳ Waiting for confirmation...');
  const confirmation = await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  }, 'confirmed');

  if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }

  console.log('✅ Transaction confirmed!');

  // Save transaction info
  const txInfo = {
    signature,
    timestamp: new Date().toISOString(),
    amount: amountUSD,
    amountMicroUSDC,
    from: wallets.agent.publicKey,
    to: wallets.treasury.publicKey,
    fromTokenAccount: agentTokenAccount.toBase58(),
    toTokenAccount: treasuryTokenAccount.toBase58(),
    usdcMint: usdcMint.toBase58(),
    explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
  };

  const txPath = path.join(__dirname, 'test-transaction.json');
  fs.writeFileSync(txPath, JSON.stringify(txInfo, null, 2));
  console.log(`\n💾 Transaction info saved to: scripts/test-transaction.json`);

  // Verify balances after
  console.log('\n📊 Final balances:');
  const agentFinalBalance = await connection.getTokenAccountBalance(agentTokenAccount);
  console.log(`   Agent: ${agentFinalBalance.value.uiAmount} USDC`);

  try {
    const treasuryFinalBalance = await connection.getTokenAccountBalance(treasuryTokenAccount);
    console.log(`   Treasury: ${treasuryFinalBalance.value.uiAmount} USDC`);
  } catch (e) {
    console.log(`   Treasury: Account may be creating...`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ TEST PAYMENT CREATED SUCCESSFULLY!');
  console.log('\n🎯 NEXT STEP: Fetch and parse this transaction');
  console.log(`   Run: npx ts-node scripts/fetch-transaction.ts ${signature}\n`);
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
