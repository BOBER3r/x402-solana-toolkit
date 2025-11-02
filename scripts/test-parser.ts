/**
 * Step 5: THE CRITICAL TEST
 * Test if our transaction parser correctly extracts USDC transfers from the real transaction
 */

import fs from 'fs';
import path from 'path';
import { TransactionVerifier } from '../packages/core/dist/verifier/transaction-verifier';

async function main() {
  console.log('🧪 Testing Transaction Parser with Real Data\n');
  console.log('='.repeat(60));

  // Load transaction info
  const txInfoPath = path.join(__dirname, 'test-transaction.json');
  const txInfo = JSON.parse(fs.readFileSync(txInfoPath, 'utf-8'));

  console.log('\n📋 Test Transaction:');
  console.log(`   Signature: ${txInfo.signature}`);
  console.log(`   Amount: ${txInfo.amount} USDC (${txInfo.amountMicroUSDC} micro-USDC)`);
  console.log(`   From: ${txInfo.fromTokenAccount}`);
  console.log(`   To: ${txInfo.toTokenAccount}`);
  console.log(`   USDC Mint: ${txInfo.usdcMint}`);

  // Initialize verifier
  console.log('\n🔧 Initializing TransactionVerifier...');
  const verifier = new TransactionVerifier({
    rpcUrl: 'https://api.devnet.solana.com',
    commitment: 'confirmed',
  });

  // Test verification
  console.log('\n🔍 Running verification...');
  console.log(`   Expected recipient: ${txInfo.toTokenAccount}`);
  console.log(`   Expected amount: ${txInfo.amount} USD`);

  try {
    const result = await verifier.verifyPayment(
      txInfo.signature,
      txInfo.toTokenAccount, // Treasury USDC token account
      txInfo.amount,         // 0.01 USD
      {
        maxAgeMs: 3600000,   // 1 hour (since we just created it)
      }
    );

    console.log('\n📊 Verification Result:');
    console.log('   Valid:', result.valid);

    if (result.valid) {
      console.log('\n✅ SUCCESS! Parser extracted transfer correctly!');
      console.log('\n📦 Extracted Transfer:');
      console.log(`   Source: ${result.transfer?.source}`);
      console.log(`   Destination: ${result.transfer?.destination}`);
      console.log(`   Authority: ${result.transfer?.authority}`);
      console.log(`   Amount: ${result.transfer?.amount} micro-USDC (${(result.transfer?.amount || 0) / 1_000_000} USD)`);
      console.log(`   Mint: ${result.transfer?.mint}`);
      console.log(`   Block Time: ${result.blockTime}`);
      console.log(`   Slot: ${result.slot}`);

      // Validate extracted data matches expected
      console.log('\n🔍 Validating extracted data...');
      const errors: string[] = [];

      if (result.transfer?.destination !== txInfo.toTokenAccount) {
        errors.push(`❌ Destination mismatch: got ${result.transfer?.destination}, expected ${txInfo.toTokenAccount}`);
      } else {
        console.log('   ✅ Destination correct');
      }

      if (result.transfer?.source !== txInfo.fromTokenAccount) {
        errors.push(`❌ Source mismatch: got ${result.transfer?.source}, expected ${txInfo.fromTokenAccount}`);
      } else {
        console.log('   ✅ Source correct');
      }

      if (result.transfer?.amount !== txInfo.amountMicroUSDC) {
        errors.push(`❌ Amount mismatch: got ${result.transfer?.amount}, expected ${txInfo.amountMicroUSDC}`);
      } else {
        console.log('   ✅ Amount correct');
      }

      if (result.transfer?.mint !== txInfo.usdcMint) {
        errors.push(`❌ Mint mismatch: got ${result.transfer?.mint}, expected ${txInfo.usdcMint}`);
      } else {
        console.log('   ✅ Mint correct');
      }

      if (errors.length > 0) {
        console.log('\n⚠️  VALIDATION ERRORS:');
        errors.forEach(e => console.log(e));
        throw new Error('Extracted data does not match expected values');
      }

      console.log('\n' + '='.repeat(60));
      console.log('\n🎉 PARSER TEST PASSED!');
      console.log('\n✅ Transaction parsing works correctly!');
      console.log('✅ All fields extracted accurately!');
      console.log('✅ Core verification logic is functional!');

      console.log('\n🎯 PHASE 4 SUCCESS!');
      console.log('\n💡 What this means:');
      console.log('   • Our SPL token transfer parsing works');
      console.log('   • Inner instruction handling is correct');
      console.log('   • Account indexing is accurate');
      console.log('   • USDC verification logic is sound');
      console.log('\n🚀 Ready to proceed to Phase 5: Integration testing!\n');

    } else {
      console.log('\n❌ VERIFICATION FAILED!');
      console.log(`   Error: ${result.error}`);
      console.log(`   Code: ${result.code}`);

      if (result.debug) {
        console.log('\n🐛 Debug Info:');
        console.log(JSON.stringify(result.debug, null, 2));
      }

      throw new Error('Verification failed - parser did not extract transfer correctly');
    }

  } catch (error: any) {
    console.log('\n❌ ERROR DURING VERIFICATION:');
    console.log(`   ${error.message}`);

    if (error.stack) {
      console.log('\n📚 Stack Trace:');
      console.log(error.stack);
    }

    console.log('\n🐛 DEBUGGING NEEDED:');
    console.log('   1. Check transaction structure in transaction-structure.json');
    console.log('   2. Verify instruction parsing logic');
    console.log('   3. Check account indexing');
    console.log('   4. Verify inner instruction handling');

    throw error;
  }
}

main().catch(err => {
  console.error('\n💥 Test failed:', err.message);
  process.exit(1);
});
