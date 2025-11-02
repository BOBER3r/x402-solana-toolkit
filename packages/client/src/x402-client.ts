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
} from '@solana/spl-token';
import bs58 from 'bs58';
import {
  PaymentRequirements,
  PaymentProof,
  PaymentError,
  PaymentErrorCode,
} from './types';

/**
 * Configuration options for X402Client
 */
export interface X402ClientConfig {
  /** Solana RPC endpoint URL */
  solanaRpcUrl: string;

  /** Wallet private key (bs58 string or Uint8Array) */
  walletPrivateKey: string | Uint8Array;

  /** Solana network (devnet or mainnet-beta) */
  network?: 'devnet' | 'mainnet-beta';

  /** Automatically retry requests after payment (default: true) */
  autoRetry?: boolean;

  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;

  /** Commitment level for transactions (default: 'confirmed') */
  commitment?: 'processed' | 'confirmed' | 'finalized';

  /** Enable debug logging (default: false) */
  debug?: boolean;
}

/**
 * Client for automatic x402 payment handling on Solana
 *
 * @example
 * ```typescript
 * const client = new X402Client({
 *   solanaRpcUrl: 'https://api.devnet.solana.com',
 *   walletPrivateKey: 'your-base58-private-key',
 *   network: 'devnet',
 * });
 *
 * // Automatically handles 402 payment requirements
 * const response = await client.fetch('https://api.example.com/data');
 * const data = await response.json();
 * ```
 */
export class X402Client {
  private connection: Connection;
  private wallet: Keypair;
  private network: 'devnet' | 'mainnet-beta';
  private autoRetry: boolean;
  private maxRetries: number;
  private commitment: 'processed' | 'confirmed' | 'finalized';
  private debug: boolean;

  // USDC mint addresses
  private static readonly USDC_MINTS = {
    devnet: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr', // Devnet USDC mint being used for testing
    'mainnet-beta': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  };

  /**
   * Create a new X402Client instance
   *
   * @param config - Client configuration options
   * @throws {Error} If private key is invalid
   */
  constructor(config: X402ClientConfig) {
    this.connection = new Connection(config.solanaRpcUrl, config.commitment || 'confirmed');

    // Handle both bs58 and Uint8Array private keys
    try {
      const secretKey =
        typeof config.walletPrivateKey === 'string'
          ? bs58.decode(config.walletPrivateKey)
          : config.walletPrivateKey;

      this.wallet = Keypair.fromSecretKey(secretKey);
    } catch (error) {
      throw new Error(`Invalid wallet private key: ${error}`);
    }

    this.network = config.network || 'mainnet-beta';
    this.autoRetry = config.autoRetry ?? true;
    this.maxRetries = config.maxRetries || 3;
    this.commitment = config.commitment || 'confirmed';
    this.debug = config.debug || false;
  }

  /**
   * Fetch with automatic x402 payment handling
   *
   * This method wraps the standard fetch API and automatically handles
   * 402 Payment Required responses by creating a Solana USDC payment
   * and retrying the request with payment proof.
   *
   * @param url - URL to fetch
   * @param options - Fetch options (headers, method, body, etc.)
   * @returns Response from the server
   * @throws {PaymentError} If payment creation or confirmation fails
   *
   * @example
   * ```typescript
   * const response = await client.fetch('https://api.example.com/data', {
   *   method: 'POST',
   *   headers: { 'Content-Type': 'application/json' },
   *   body: JSON.stringify({ query: 'data' }),
   * });
   * ```
   */
  async fetch(url: string, options?: RequestInit): Promise<Response> {
    let retries = 0;

    while (retries < this.maxRetries) {
      try {
        // 1. Try request without payment
        let response = await fetch(url, options);

        // 2. If 402, handle payment
        if (response.status === 402 && this.autoRetry) {
          this.log(`Received 402 Payment Required from ${url}`);

          let paymentReq: PaymentRequirements;
          try {
            paymentReq = await response.json();
          } catch (error) {
            throw new PaymentError(
              'Failed to parse payment requirements',
              PaymentErrorCode.INVALID_PAYMENT_REQUIREMENTS,
              { error }
            );
          }

          // Validate payment requirements
          this.validatePaymentRequirements(paymentReq);

          const requirement = paymentReq.accepts[0];
          const amountMicroUSDC = parseInt(requirement.maxAmountRequired);
          const amountUSDC = amountMicroUSDC / 1_000_000;

          this.log(
            `Payment required: ${amountUSDC} USDC (${amountMicroUSDC} micro-USDC)`
          );
          this.log(`Description: ${requirement.description}`);

          // 3. Create payment transaction
          const signature = await this.createPayment(paymentReq);

          this.log(`Payment sent: ${signature}`);
          this.log(`Waiting for confirmation...`);

          // 4. Retry with payment proof
          response = await fetch(url, {
            ...options,
            headers: {
              ...options?.headers,
              'X-PAYMENT': this.encodePayment(signature, paymentReq),
            },
          });

          this.log(`Request retried with payment proof, status: ${response.status}`);
        }

        return response;
      } catch (error) {
        retries++;

        if (error instanceof PaymentError) {
          throw error;
        }

        if (retries >= this.maxRetries) {
          throw new PaymentError(
            `Failed after ${this.maxRetries} retries: ${error}`,
            PaymentErrorCode.NETWORK_ERROR,
            { error }
          );
        }

        this.log(`Retry ${retries}/${this.maxRetries} after error: ${error}`);
        await this.sleep(1000 * retries); // Exponential backoff
      }
    }

    throw new PaymentError(
      'Max retries exceeded',
      PaymentErrorCode.NETWORK_ERROR
    );
  }

  /**
   * Create a USDC payment transaction
   *
   * @param paymentReq - Payment requirements from 402 response
   * @returns Transaction signature
   * @throws {PaymentError} If payment creation or confirmation fails
   */
  private async createPayment(paymentReq: PaymentRequirements): Promise<string> {
    const requirement = paymentReq.accepts[0];
    const amountMicroUSDC = parseInt(requirement.maxAmountRequired);
    const recipientTokenAccount = new PublicKey(requirement.payTo.address);
    const usdcMint = new PublicKey(requirement.payTo.asset);

    try {
      // Get sender's USDC token account
      const senderTokenAccount = getAssociatedTokenAddressSync(
        usdcMint,
        this.wallet.publicKey
      );

      this.log(`Sender token account: ${senderTokenAccount.toString()}`);
      this.log(`Recipient token account: ${recipientTokenAccount.toString()}`);

      // Check balance
      try {
        const balance = await this.connection.getTokenAccountBalance(
          senderTokenAccount
        );
        const balanceMicroUSDC = parseInt(balance.value.amount);

        if (balanceMicroUSDC < amountMicroUSDC) {
          throw new PaymentError(
            `Insufficient USDC balance: have ${balanceMicroUSDC}, need ${amountMicroUSDC}`,
            PaymentErrorCode.INSUFFICIENT_BALANCE,
            {
              balance: balanceMicroUSDC,
              required: amountMicroUSDC,
            }
          );
        }

        this.log(`USDC balance: ${balanceMicroUSDC} micro-USDC`);
      } catch (error) {
        if (error instanceof PaymentError) throw error;

        throw new PaymentError(
          'Token account does not exist or has zero balance',
          PaymentErrorCode.INSUFFICIENT_BALANCE,
          { error }
        );
      }

      // Create transfer instruction
      const transferIx = createTransferInstruction(
        senderTokenAccount,
        recipientTokenAccount,
        this.wallet.publicKey,
        amountMicroUSDC
      );

      // Build transaction
      const transaction = new Transaction().add(transferIx);

      const { blockhash, lastValidBlockHeight } =
        await this.connection.getLatestBlockhash(this.commitment);

      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.wallet.publicKey;

      // Sign transaction
      transaction.sign(this.wallet);

      // Send transaction
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: this.commitment,
        }
      );

      this.log(`Transaction sent: ${signature}`);

      // Wait for confirmation
      const confirmStrategy: TransactionConfirmationStrategy = {
        signature,
        blockhash,
        lastValidBlockHeight,
      };

      const confirmation = await this.connection.confirmTransaction(
        confirmStrategy,
        this.commitment
      );

      if (confirmation.value.err) {
        throw new PaymentError(
          'Transaction failed',
          PaymentErrorCode.TRANSACTION_FAILED,
          { error: confirmation.value.err }
        );
      }

      this.log(`Transaction confirmed: ${signature}`);

      return signature;
    } catch (error) {
      if (error instanceof PaymentError) {
        throw error;
      }

      throw new PaymentError(
        `Payment creation failed: ${error}`,
        PaymentErrorCode.TRANSACTION_FAILED,
        { error }
      );
    }
  }

  /**
   * Encode payment proof for X-PAYMENT header
   *
   * @param signature - Transaction signature
   * @param paymentReq - Original payment requirements
   * @returns Base64-encoded payment proof
   */
  private encodePayment(
    signature: string,
    paymentReq: PaymentRequirements
  ): string {
    const requirement = paymentReq.accepts[0];

    const payment: PaymentProof = {
      x402Version: paymentReq.x402Version,
      scheme: requirement.scheme,
      network: requirement.network,
      payload: { signature },
    };

    return Buffer.from(JSON.stringify(payment)).toString('base64');
  }

  /**
   * Validate payment requirements from 402 response
   *
   * @param paymentReq - Payment requirements to validate
   * @throws {PaymentError} If requirements are invalid or unsupported
   */
  private validatePaymentRequirements(paymentReq: PaymentRequirements): void {
    if (!paymentReq.accepts || paymentReq.accepts.length === 0) {
      throw new PaymentError(
        'No payment methods accepted',
        PaymentErrorCode.INVALID_PAYMENT_REQUIREMENTS
      );
    }

    const requirement = paymentReq.accepts[0];

    // Check if we support this payment method
    if (requirement.scheme !== 'solana-usdc') {
      throw new PaymentError(
        `Unsupported payment scheme: ${requirement.scheme}`,
        PaymentErrorCode.UNSUPPORTED_PAYMENT_METHOD,
        { scheme: requirement.scheme }
      );
    }

    // Check if network matches (normalize both to x402 format for comparison)
    const clientNetwork = `solana-${this.network}`;
    if (requirement.network !== clientNetwork) {
      throw new PaymentError(
        `Network mismatch: client is on ${clientNetwork}, server requires ${requirement.network}`,
        PaymentErrorCode.UNSUPPORTED_PAYMENT_METHOD,
        { clientNetwork, serverNetwork: requirement.network }
      );
    }

    // Validate USDC mint address
    const expectedMint = X402Client.USDC_MINTS[this.network];
    if (requirement.payTo.asset !== expectedMint) {
      throw new PaymentError(
        `Invalid USDC mint: expected ${expectedMint}, got ${requirement.payTo.asset}`,
        PaymentErrorCode.INVALID_PAYMENT_REQUIREMENTS,
        { expected: expectedMint, received: requirement.payTo.asset }
      );
    }
  }

  /**
   * Get wallet's USDC balance
   *
   * @returns USDC balance in standard units (not micro-USDC)
   *
   * @example
   * ```typescript
   * const balance = await client.getUSDCBalance();
   * console.log(`Balance: ${balance} USDC`);
   * ```
   */
  async getUSDCBalance(): Promise<number> {
    const usdcMint = new PublicKey(X402Client.USDC_MINTS[this.network]);

    const tokenAccount = getAssociatedTokenAddressSync(
      usdcMint,
      this.wallet.publicKey
    );

    try {
      const balance = await this.connection.getTokenAccountBalance(tokenAccount);
      return parseFloat(balance.value.uiAmount?.toString() || '0');
    } catch (error) {
      // Token account doesn't exist
      return 0;
    }
  }

  /**
   * Get wallet's SOL balance
   *
   * @returns SOL balance in standard units
   *
   * @example
   * ```typescript
   * const balance = await client.getSOLBalance();
   * console.log(`Balance: ${balance} SOL`);
   * ```
   */
  async getSOLBalance(): Promise<number> {
    const balance = await this.connection.getBalance(this.wallet.publicKey);
    return balance / 1e9;
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
   * Get USDC mint address for current network
   *
   * @returns USDC mint public key
   */
  getUSDCMint(): PublicKey {
    return new PublicKey(X402Client.USDC_MINTS[this.network]);
  }

  /**
   * Get wallet's USDC token account address
   *
   * @returns Associated token account public key
   */
  getUSDCTokenAccount(): PublicKey {
    return getAssociatedTokenAddressSync(
      this.getUSDCMint(),
      this.wallet.publicKey
    );
  }

  /**
   * Log debug messages if debug mode is enabled
   *
   * Note: Uses console.error() instead of console.log() for MCP compatibility.
   * MCP protocol requires stdout for JSON-RPC only, so debug logs go to stderr.
   */
  private log(message: string): void {
    if (this.debug) {
      console.error(`[X402Client] ${message}`);
    }
  }

  /**
   * Sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
