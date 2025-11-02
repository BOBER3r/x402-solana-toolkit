/**
 * Solana transaction parsing utilities
 * Extracts SPL token transfers from transactions
 */

import {
  VersionedTransactionResponse,
  PublicKey,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { USDCTransfer, ParsedTransaction } from '../types/solana.types';
import { USDC_MINT_ADDRESSES } from '../types/solana.types';

/**
 * SPL Token instruction discriminators
 */
enum TokenInstruction {
  Transfer = 3,
  TransferChecked = 12,
}

/**
 * Parse a Solana transaction to extract all USDC transfers
 *
 * @param tx - Versioned transaction response from RPC
 * @param network - Network to validate USDC mint (optional)
 * @returns Parsed transaction with all USDC transfers
 *
 * @example
 * ```typescript
 * const connection = new Connection('https://api.devnet.solana.com');
 * const tx = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0 });
 * const parsed = parseTransaction(tx, 'devnet');
 * console.log(parsed.transfers); // Array of USDC transfers
 * ```
 */
export function parseTransaction(
  tx: VersionedTransactionResponse,
  network?: string
): ParsedTransaction {
  const transfers = extractUSDCTransfers(tx, network);

  return {
    transfers,
    signature: tx.transaction.signatures[0],
    blockTime: tx.blockTime || null,
    slot: tx.slot,
    success: !tx.meta?.err,
    error: tx.meta?.err || undefined,
  };
}

/**
 * Extract all USDC transfers from a transaction
 * Handles both outer and inner instructions
 *
 * @param tx - Versioned transaction response
 * @param network - Network to validate USDC mint (optional)
 * @returns Array of USDC transfers found
 */
export function extractUSDCTransfers(
  tx: VersionedTransactionResponse,
  network?: string
): USDCTransfer[] {
  const transfers: USDCTransfer[] = [];

  // Handle both legacy and versioned transaction formats
  const message = tx.transaction.message as any;
  const accountKeys = message.staticAccountKeys || message.accountKeys;
  const instructions = message.compiledInstructions || message.instructions;

  // Parse outer instructions
  for (const ix of instructions) {
    const transfer = parseTokenTransfer(tx, ix, accountKeys);
    if (transfer && isUSDCTransfer(transfer, network)) {
      transfers.push(transfer);
    }
  }

  // Parse inner instructions
  if (tx.meta?.innerInstructions) {
    for (const innerIx of tx.meta.innerInstructions) {
      for (const ix of innerIx.instructions) {
        const transfer = parseTokenTransfer(tx, ix, accountKeys);
        if (transfer && isUSDCTransfer(transfer, network)) {
          transfers.push(transfer);
        }
      }
    }
  }

  return transfers;
}

/**
 * Parse a single token transfer instruction
 *
 * SPL Token Transfer instruction format:
 * - Byte 0: discriminator (3 = Transfer, 12 = TransferChecked)
 * - Bytes 1-8: amount (u64, little-endian)
 * - Bytes 9-10: decimals (u8, only for TransferChecked)
 *
 * Accounts:
 * - [0] source: Source token account
 * - [1] destination: Destination token account
 * - [2] authority: Authority (signer)
 * - [3] mint: Token mint (only for TransferChecked)
 *
 * @param tx - Transaction containing the instruction
 * @param ix - Compiled instruction
 * @param accountKeys - Static account keys from message
 * @returns Parsed transfer or null if not a token transfer
 */
function parseTokenTransfer(
  tx: VersionedTransactionResponse,
  ix: any,
  accountKeys: PublicKey[]
): USDCTransfer | null {
  // Check if this is a Token Program instruction
  const programIdIndex = ix.programIdIndex;
  const programId = accountKeys[programIdIndex];

  if (!programId.equals(TOKEN_PROGRAM_ID)) {
    return null;
  }

  // Decode instruction data
  const data = Buffer.from(ix.data);
  if (data.length < 9) {
    return null; // Not enough data for a transfer
  }

  const discriminator = data[0];

  // Check if this is Transfer or TransferChecked
  if (discriminator !== TokenInstruction.Transfer && discriminator !== TokenInstruction.TransferChecked) {
    return null;
  }

  // Read amount (u64 at offset 1)
  const amount = data.readBigUInt64LE(1);

  // Get account indices (handle both legacy and versioned formats)
  const accountIndexes = ix.accountKeyIndexes || ix.accounts;
  if (!accountIndexes || accountIndexes.length < 3) {
    return null; // Not enough accounts
  }

  const sourceAccount = accountKeys[accountIndexes[0]];
  const destAccount = accountKeys[accountIndexes[1]];
  const authority = accountKeys[accountIndexes[2]];

  // For TransferChecked, account[3] is the mint
  let mint: string | undefined;
  if (discriminator === TokenInstruction.TransferChecked && accountIndexes.length >= 4) {
    mint = accountKeys[accountIndexes[3]].toString();
  } else {
    // For regular Transfer, we need to derive the mint from token account
    // This requires additional RPC calls, so we'll mark it as unknown for now
    mint = getMintFromPreTokenBalances(tx, destAccount.toString());
  }

  return {
    source: sourceAccount.toString(),
    destination: destAccount.toString(),
    authority: authority.toString(),
    amount: Number(amount),
    mint: mint || 'unknown',
  };
}

/**
 * Get mint address from pre-token balances metadata
 * This is a workaround for Transfer instructions that don't include mint
 *
 * @param tx - Transaction response
 * @param tokenAccount - Token account address
 * @returns Mint address or 'unknown'
 */
function getMintFromPreTokenBalances(
  tx: VersionedTransactionResponse,
  tokenAccount: string
): string {
  // Handle both legacy and versioned transaction formats
  const message = tx.transaction.message as any;
  const accountKeys = message.staticAccountKeys || message.accountKeys;

  // Check pre-token balances
  if (tx.meta?.preTokenBalances) {
    for (const balance of tx.meta.preTokenBalances) {
      const accountKey = accountKeys[balance.accountIndex];
      if (accountKey.toString() === tokenAccount) {
        return balance.mint;
      }
    }
  }

  // Check post-token balances
  if (tx.meta?.postTokenBalances) {
    for (const balance of tx.meta.postTokenBalances) {
      const accountKey = accountKeys[balance.accountIndex];
      if (accountKey.toString() === tokenAccount) {
        return balance.mint;
      }
    }
  }

  return 'unknown';
}

/**
 * Check if a transfer is a USDC transfer
 *
 * @param transfer - Parsed transfer
 * @param network - Network to validate against (optional)
 * @returns Whether transfer is USDC
 */
function isUSDCTransfer(transfer: USDCTransfer, network?: string): boolean {
  if (transfer.mint === 'unknown') {
    // If we can't determine the mint, assume it might be USDC
    // The verifier will do stricter checks later
    return true;
  }

  if (network) {
    const expectedMint = USDC_MINT_ADDRESSES[network];
    return transfer.mint === expectedMint;
  }

  // Check against all known USDC mints
  return Object.values(USDC_MINT_ADDRESSES).includes(transfer.mint);
}

/**
 * Find a specific transfer by destination
 *
 * @param transfers - Array of transfers
 * @param destination - Destination address to find
 * @returns Matching transfer or undefined
 *
 * @example
 * ```typescript
 * const transfer = findTransferByDestination(transfers, recipientUSDCAccount);
 * if (transfer) {
 *   console.log(`Found transfer of ${transfer.amount} micro-USDC`);
 * }
 * ```
 */
export function findTransferByDestination(
  transfers: USDCTransfer[],
  destination: string
): USDCTransfer | undefined {
  return transfers.find(t => t.destination === destination);
}

/**
 * Find transfers that match both destination and minimum amount
 *
 * @param transfers - Array of transfers
 * @param destination - Destination address
 * @param minAmount - Minimum amount in micro-USDC
 * @returns Array of matching transfers
 *
 * @example
 * ```typescript
 * const matches = findMatchingTransfers(transfers, recipientAccount, 1000);
 * ```
 */
export function findMatchingTransfers(
  transfers: USDCTransfer[],
  destination: string,
  minAmount: number
): USDCTransfer[] {
  return transfers.filter(t => t.destination === destination && t.amount >= minAmount);
}

/**
 * Sum amounts from multiple transfers
 *
 * @param transfers - Array of transfers
 * @returns Total amount in micro-USDC
 *
 * @example
 * ```typescript
 * const total = sumTransferAmounts(transfers); // Total micro-USDC
 * ```
 */
export function sumTransferAmounts(transfers: USDCTransfer[]): number {
  return transfers.reduce((sum, t) => sum + t.amount, 0);
}
