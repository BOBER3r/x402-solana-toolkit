import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

/**
 * Wallet information containing public and private keys
 */
export interface WalletInfo {
  /** Public key as base58 string */
  publicKey: string;

  /** Private key as base58 string */
  privateKey: string;

  /** Keypair instance */
  keypair: Keypair;
}

/**
 * Helper class for creating and managing Solana wallets
 *
 * This utility is primarily for testing and development purposes.
 * In production, wallets should be managed securely by the user.
 *
 * @example
 * ```typescript
 * // Generate a new wallet
 * const wallet = WalletManager.generateWallet();
 * console.log(`Public key: ${wallet.publicKey}`);
 * console.log(`Private key: ${wallet.privateKey}`);
 *
 * // Fund wallet on devnet
 * const connection = new Connection('https://api.devnet.solana.com');
 * await WalletManager.airdropSOL(
 *   connection,
 *   new PublicKey(wallet.publicKey),
 *   1.0
 * );
 * ```
 */
export class WalletManager {
  /**
   * Generate a new random Solana wallet
   *
   * @returns Wallet information with public/private keys
   *
   * @example
   * ```typescript
   * const wallet = WalletManager.generateWallet();
   * console.log(`Address: ${wallet.publicKey}`);
   * ```
   */
  static generateWallet(): WalletInfo {
    const keypair = Keypair.generate();
    return {
      publicKey: keypair.publicKey.toString(),
      privateKey: bs58.encode(keypair.secretKey),
      keypair,
    };
  }

  /**
   * Create wallet from existing private key
   *
   * @param privateKey - Private key as base58 string or Uint8Array
   * @returns Wallet information
   * @throws {Error} If private key is invalid
   *
   * @example
   * ```typescript
   * const wallet = WalletManager.fromPrivateKey('your-base58-key');
   * ```
   */
  static fromPrivateKey(privateKey: string | Uint8Array): WalletInfo {
    try {
      const secretKey =
        typeof privateKey === 'string' ? bs58.decode(privateKey) : privateKey;

      const keypair = Keypair.fromSecretKey(secretKey);

      return {
        publicKey: keypair.publicKey.toString(),
        privateKey: bs58.encode(keypair.secretKey),
        keypair,
      };
    } catch (error) {
      throw new Error(`Invalid private key: ${error}`);
    }
  }

  /**
   * Request SOL airdrop from devnet/testnet faucet
   *
   * Note: This only works on devnet and testnet, not mainnet.
   * Rate limits apply - typically 1 SOL per request.
   *
   * @param connection - Solana connection instance
   * @param publicKey - Public key to receive airdrop
   * @param amountSOL - Amount of SOL to request (in standard units)
   * @returns Transaction signature
   * @throws {Error} If airdrop fails or times out
   *
   * @example
   * ```typescript
   * const connection = new Connection('https://api.devnet.solana.com');
   * const wallet = WalletManager.generateWallet();
   *
   * // Request 1 SOL
   * const signature = await WalletManager.airdropSOL(
   *   connection,
   *   new PublicKey(wallet.publicKey),
   *   1.0
   * );
   * console.log(`Airdrop successful: ${signature}`);
   * ```
   */
  static async airdropSOL(
    connection: Connection,
    publicKey: PublicKey,
    amountSOL: number
  ): Promise<string> {
    try {
      const lamports = amountSOL * 1e9;

      const signature = await connection.requestAirdrop(publicKey, lamports);

      // Wait for confirmation
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash('confirmed');

      await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        'confirmed'
      );

      return signature;
    } catch (error) {
      throw new Error(`Airdrop failed: ${error}`);
    }
  }

  /**
   * Get SOL balance for a wallet
   *
   * @param connection - Solana connection instance
   * @param publicKey - Public key to check balance
   * @returns SOL balance in standard units
   *
   * @example
   * ```typescript
   * const balance = await WalletManager.getSOLBalance(
   *   connection,
   *   publicKey
   * );
   * console.log(`Balance: ${balance} SOL`);
   * ```
   */
  static async getSOLBalance(
    connection: Connection,
    publicKey: PublicKey
  ): Promise<number> {
    const balance = await connection.getBalance(publicKey);
    return balance / 1e9;
  }

  /**
   * Validate a Solana public key
   *
   * @param address - Address string to validate
   * @returns true if valid, false otherwise
   *
   * @example
   * ```typescript
   * if (WalletManager.isValidPublicKey(address)) {
   *   console.log('Valid Solana address');
   * }
   * ```
   */
  static isValidPublicKey(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate a base58 private key
   *
   * @param privateKey - Private key string to validate
   * @returns true if valid, false otherwise
   *
   * @example
   * ```typescript
   * if (WalletManager.isValidPrivateKey(key)) {
   *   console.log('Valid private key');
   * }
   * ```
   */
  static isValidPrivateKey(privateKey: string): boolean {
    try {
      const decoded = bs58.decode(privateKey);
      return decoded.length === 64;
    } catch {
      return false;
    }
  }
}
