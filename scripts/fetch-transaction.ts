/**
 * Step 4: Fetch real transaction from devnet and examine its structure
 * This will show us the ACTUAL format we need to parse
 */

import { Connection } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

async function main() {
  const signature = process.argv[2];

  if (!signature) {
    console.error('Usage: npx ts-node fetch-transaction.ts <SIGNATURE>');
    process.exit(1);
  }

  console.log('🔍 Fetching Transaction from Devnet\n');
  console.log('='.repeat(60));
  console.log(`\nSignature: ${signature}`);

  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  console.log('\n📡 Fetching transaction...');
  const tx = await connection.getTransaction(signature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error('Transaction not found');
  }

  console.log('✅ Transaction fetched!');

  // Log high-level info
  console.log('\n📊 Transaction Overview:');
  console.log(`   Slot: ${tx.slot}`);
  console.log(`   Block Time: ${tx.blockTime} (${new Date((tx.blockTime || 0) * 1000).toISOString()})`);
  console.log(`   Success: ${!tx.meta?.err}`);
  console.log(`   Fee: ${tx.meta?.fee} lamports`);

  // Log instructions
  console.log('\n📜 Instructions:');
  console.log(`   Outer instructions: ${tx.transaction.message.compiledInstructions.length}`);
  console.log(`   Inner instructions: ${tx.meta?.innerInstructions?.length || 0}`);

  if (tx.meta?.innerInstructions) {
    for (const inner of tx.meta.innerInstructions) {
      console.log(`      Index ${inner.index}: ${inner.instructions.length} inner instructions`);
    }
  }

  // Log account keys
  console.log('\n🔑 Account Keys:');
  const accountKeys = tx.transaction.message.staticAccountKeys;
  accountKeys.forEach((key, index) => {
    console.log(`   [${index}] ${key.toBase58()}`);
  });

  // Log programs used
  console.log('\n🔧 Programs Used:');
  const programs = new Set<string>();
  tx.transaction.message.compiledInstructions.forEach(ix => {
    const programId = accountKeys[ix.programIdIndex];
    programs.add(programId.toBase58());
  });
  programs.forEach(p => console.log(`   ${p}`));

  // Save full transaction to file
  const outputPath = path.join(__dirname, 'transaction-structure.json');
  fs.writeFileSync(outputPath, JSON.stringify(tx, null, 2));
  console.log(`\n💾 Full transaction saved to: scripts/transaction-structure.json`);

  // Also save a human-readable analysis
  const analysis = {
    signature,
    slot: tx.slot,
    blockTime: tx.blockTime,
    blockTimeISO: new Date((tx.blockTime || 0) * 1000).toISOString(),
    success: !tx.meta?.err,
    fee: tx.meta?.fee,
    outerInstructions: tx.transaction.message.compiledInstructions.length,
    innerInstructions: tx.meta?.innerInstructions?.length || 0,
    accountKeys: accountKeys.map((k, i) => ({ index: i, pubkey: k.toBase58() })),
    programs: Array.from(programs),
  };

  const analysisPath = path.join(__dirname, 'transaction-analysis.json');
  fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
  console.log(`💾 Analysis saved to: scripts/transaction-analysis.json`);

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ TRANSACTION FETCHED SUCCESSFULLY!');
  console.log('\n🎯 NEXT STEP: Test parser with this transaction');
  console.log(`   Run: npx ts-node scripts/test-parser.ts\n`);
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  console.error(err);
  process.exit(1);
});
