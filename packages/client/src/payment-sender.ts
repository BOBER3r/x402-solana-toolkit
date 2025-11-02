import {
  Connection,
  Keypair,
  Transaction,
  PublicKey,
  TransactionConfirmationStrategy,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';
import { PaymentError, PaymentErrorCode } from './types';

/**
 * Payment cost estimation
 */
export interface PaymentCostEstimate {
  /** USDC amount in standard units */
  usdcAmount: number;

  /** SOL fee in standard units */
  solFee: number;

  /** Total cost in USD (USDC + SOL fee in USD) */
  totalUSD: number;

  /** Whether sender has sufficient balance */
  hasSufficientBalance: boolean;

  /** Current USDC balance */
  currentUSDCBalance: number;

  /** Current SOL balance */
  currentSOLBalance: number;
}

/**
 * Options for sending USDC payments
 */
export interface SendUSDCOptions {
  /** Skip balance check before sending (default: false) */
  skipBalanceCheck?: boolean;

  /** Create recipient token account if it doesn't exist (default: false) */
  createTokenAccount?: boolean;

  /** Commitment level for transaction (default: 'confirmed') */
  commitment?: 'processed' | 'confirmed' | 'finalized';
}

/**
 * Low-level payment creation utilities
 *
 * This class provides granular control over USDC payment transactions.
 * For most use cases, X402Client's automatic payment handling is simpler.
 *
 * @example
 * ```typescript
 * const sender = new PaymentSender(connection, wallet);
 *
 * // Send USDC payment
 * const signature = await sender.sendUSDC(
 *   'recipient-wallet-address',
 *   0.5,
 *   'USDC-mint-address'
 * );
 *
 * // Estimate payment cost
 * const estimate = await sender.estimatePaymentCost(
 *   0.5,
 *   'USDC-mint-address'
 * );
 * console.log(`Total cost: ${estimate.totalUSD} USD`);
 * ```
 */
export class PaymentSender {
  private connection: Connection;
  private wallet: Keypair;

  /**
   * Create a new PaymentSender instance
   *
   * @param connection - Solana connection instance
   * @param wallet - Wallet keypair for signing transactions
   */
  constructor(connection: Connection, wallet: Keypair) {
    this.connection = connection;
    this.wallet = wallet;
  }

  /**
   * Send USDC payment to a recipient
   *
   * @param recipientWallet - Recipient's wallet address (base58 string)
   * @param amountUSDC - Amount in standard USDC units (e.g., 1.5 = 1.5 USDC)
   * @param usdcMint - USDC mint address
   * @param options - Additional options
   * @returns Transaction signature
   * @throws {PaymentError} If payment fails
   *
   * @example
   * ```typescript
   * // Send 0.5 USDC
   * const signature = await sender.sendUSDC(
   *   'recipient-address',
   *   0.5,
   *   'USDC-mint-address',
   *   { createTokenAccount: true }
   * );
   * ```
   */
  async sendUSDC(
    recipientWallet: string,
    amountUSDC: number,
    usdcMint: string,
    options: SendUSDCOptions = {}
  ): Promise<string> {
    const {
      skipBalanceCheck = false,
      createTokenAccount = false,
      commitment = 'confirmed',
    } = options;

    try {
      const recipientPubkey = new PublicKey(recipientWallet);
      const mintPubkey = new PublicKey(usdcMint);
      const amountMicroUSDC = Math.floor(amountUSDC * 1_000_000);

      // Get token accounts
      const senderTokenAccount = getAssociatedTokenAddressSync(
        mintPubkey,
        this.wallet.publicKey
      );

      const recipientTokenAccount = getAssociatedTokenAddressSync(
        mintPubkey,
        recipientPubkey
      );

      // Check sender balance
      if (!skipBalanceCheck) {
        const balance = await this.connection.getTokenAccountBalance(
          senderTokenAccount
        );
        const balanceMicroUSDC = parseInt(balance.value.amount);

        if (balanceMicroUSDC < amountMicroUSDC) {
          throw new PaymentError(
            `Insufficient USDC balance: have ${balanceMicroUSDC / 1_000_000} USDC, need ${amountUSDC} USDC`,
            PaymentErrorCode.INSUFFICIENT_BALANCE,
            {
              balance: balanceMicroUSDC,
              required: amountMicroUSDC,
            }
          );
        }
      }

      // Build transaction
      const transaction = new Transaction();

      // Check if recipient token account exists
      if (createTokenAccount) {
        try {
          await getAccount(this.connection, recipientTokenAccount);
        } catch {
          // Token account doesn't exist, create it
          const createAccountIx = createAssociatedTokenAccountInstruction(
            this.wallet.publicKey, // payer
            recipientTokenAccount, // ata
            recipientPubkey, // owner
            mintPubkey // mint
          );
          transaction.add(createAccountIx);
        }
      }

      // Add transfer instruction
      const transferIx = createTransferInstruction(
        senderTokenAccount,
        recipientTokenAccount,
        this.wallet.publicKey,
        amountMicroUSDC
      );
      transaction.add(transferIx);

      // Get blockhash and set fee payer
      const { blockhash, lastValidBlockHeight } =
        await this.connection.getLatestBlockhash(commitment);

      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.wallet.publicKey;

      // Sign transaction
      transaction.sign(this.wallet);

      // Send transaction
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: commitment,
        }
      );

      // Wait for confirmation
      const confirmStrategy: TransactionConfirmationStrategy = {
        signature,
        blockhash,
        lastValidBlockHeight,
      };

      const confirmation = await this.connection.confirmTransaction(
        confirmStrategy,
        commitment
      );

      if (confirmation.value.err) {
        throw new PaymentError(
          'Transaction failed',
          PaymentErrorCode.TRANSACTION_FAILED,
          { error: confirmation.value.err }
        );
      }

      return signature;
    } catch (error) {
      if (error instanceof PaymentError) {
        throw error;
      }

      throw new PaymentError(
        `Payment failed: ${error}`,
        PaymentErrorCode.TRANSACTION_FAILED,
        { error }
      );
    }
  }

  /**
   * Estimate the cost of a USDC payment
   *
   * This calculates the total cost including USDC amount and SOL transaction fee.
   * It also checks if the wallet has sufficient balance.
   *
   * @param amountUSDC - Amount in standard USDC units
   * @param usdcMint - USDC mint address
   * @returns Payment cost estimate
   *
   * @example
   * ```typescript
   * const estimate = await sender.estimatePaymentCost(0.5, usdcMint);
   * if (estimate.hasSufficientBalance) {
   *   console.log(`Total cost: ${estimate.totalUSD} USD`);
   *   console.log(`SOL fee: ${estimate.solFee} SOL`);
   * }
   * ```
   */
  async estimatePaymentCost(
    amountUSDC: number,
    usdcMint: string
  ): Promise<PaymentCostEstimate> {
    const mintPubkey = new PublicKey(usdcMint);
    const amountMicroUSDC = Math.floor(amountUSDC * 1_000_000);

    // Get USDC balance
    const senderTokenAccount = getAssociatedTokenAddressSync(
      mintPubkey,
      this.wallet.publicKey
    );

    let currentUSDCBalance = 0;
    try {
      const balance = await this.connection.getTokenAccountBalance(
        senderTokenAccount
      );
      currentUSDCBalance = parseFloat(balance.value.uiAmount?.toString() || '0');
    } catch {
      // Token account doesn't exist
      currentUSDCBalance = 0;
    }

    // Get SOL balance
    const lamports = await this.connection.getBalance(this.wallet.publicKey);
    const currentSOLBalance = lamports / 1e9;

    // Estimate transaction fee
    // Typical SPL token transfer costs ~5000 lamports (0.000005 SOL)
    // We add a buffer for safety
    const estimatedFeeLamports = 10_000;
    const solFee = estimatedFeeLamports / 1e9;

    // Estimate SOL value in USD (rough approximation)
    // In production, you would fetch this from a price oracle
    const solPriceUSD = 50; // Placeholder - should be fetched from oracle
    const solFeeUSD = solFee * solPriceUSD;

    const totalUSD = amountUSDC + solFeeUSD;

    const hasSufficientBalance =
      currentUSDCBalance >= amountUSDC &&
      currentSOLBalance >= solFee;

    return {
      usdcAmount: amountUSDC,
      solFee,
      totalUSD,
      hasSufficientBalance,
      currentUSDCBalance,
      currentSOLBalance,
    };
  }

  /**
   * Check if wallet has sufficient USDC balance
   *
   * @param amountUSDC - Amount to check in standard USDC units
   * @param usdcMint - USDC mint address
   * @returns true if balance is sufficient
   */
  async hasSufficientBalance(
    amountUSDC: number,
    usdcMint: string
  ): Promise<boolean> {
    const estimate = await this.estimatePaymentCost(amountUSDC, usdcMint);
    return estimate.hasSufficientBalance;
  }

  /**
   * Get USDC balance for wallet
   *
   * @param usdcMint - USDC mint address
   * @returns USDC balance in standard units
   */
  async getUSDCBalance(usdcMint: string): Promise<number> {
    const mintPubkey = new PublicKey(usdcMint);
    const tokenAccount = getAssociatedTokenAddressSync(
      mintPubkey,
      this.wallet.publicKey
    );

    try {
      const balance = await this.connection.getTokenAccountBalance(tokenAccount);
      return parseFloat(balance.value.uiAmount?.toString() || '0');
    } catch {
      return 0;
    }
  }

  /**
   * Get wallet public key
   *
   * @returns Wallet's public key
   */
  getPublicKey(): PublicKey {
    return this.wallet.publicKey;
  }

  /**
   * Check if a token account exists
   *
   * @param usdcMint - USDC mint address
   * @param owner - Token account owner (defaults to wallet)
   * @returns true if token account exists
   */
  async tokenAccountExists(
    usdcMint: string,
    owner?: PublicKey
  ): Promise<boolean> {
    const mintPubkey = new PublicKey(usdcMint);
    const ownerPubkey = owner || this.wallet.publicKey;

    const tokenAccount = getAssociatedTokenAddressSync(mintPubkey, ownerPubkey);

    try {
      await getAccount(this.connection, tokenAccount);
      return true;
    } catch {
      return false;
    }
  }
}
