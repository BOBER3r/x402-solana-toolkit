/**
 * Tests for WalletManager
 */

import { WalletManager } from '../src/wallet-manager';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

// Mock @solana/web3.js
jest.mock('@solana/web3.js', () => {
  const actual = jest.requireActual('@solana/web3.js');
  return {
    ...actual,
    Connection: jest.fn().mockImplementation(() => ({
      requestAirdrop: jest.fn().mockResolvedValue('mock-signature'),
      getLatestBlockhash: jest.fn().mockResolvedValue({
        blockhash: 'mock-blockhash',
        lastValidBlockHeight: 1000000,
      }),
      confirmTransaction: jest.fn().mockResolvedValue({
        value: { err: null },
      }),
      getBalance: jest.fn().mockResolvedValue(1_000_000_000), // 1 SOL
    })),
  };
});

describe('WalletManager', () => {
  describe('generateWallet', () => {
    it('should generate a new wallet', () => {
      const wallet = WalletManager.generateWallet();

      expect(wallet).toHaveProperty('publicKey');
      expect(wallet).toHaveProperty('privateKey');
      expect(wallet).toHaveProperty('keypair');
      expect(wallet.keypair).toBeInstanceOf(Keypair);
    });

    it('should generate unique wallets', () => {
      const wallet1 = WalletManager.generateWallet();
      const wallet2 = WalletManager.generateWallet();

      expect(wallet1.publicKey).not.toBe(wallet2.publicKey);
      expect(wallet1.privateKey).not.toBe(wallet2.privateKey);
    });

    it('should generate valid base58 keys', () => {
      const wallet = WalletManager.generateWallet();

      // Should be able to decode
      const decoded = bs58.decode(wallet.privateKey);
      expect(decoded.length).toBe(64);

      // Public key should be valid Solana address
      expect(() => new PublicKey(wallet.publicKey)).not.toThrow();
    });
  });

  describe('fromPrivateKey', () => {
    it('should create wallet from base58 private key', () => {
      const original = Keypair.generate();
      const privateKey = bs58.encode(original.secretKey);

      const wallet = WalletManager.fromPrivateKey(privateKey);

      expect(wallet.publicKey).toBe(original.publicKey.toString());
      expect(wallet.privateKey).toBe(privateKey);
    });

    it('should create wallet from Uint8Array private key', () => {
      const original = Keypair.generate();
      const wallet = WalletManager.fromPrivateKey(original.secretKey);

      expect(wallet.publicKey).toBe(original.publicKey.toString());
    });

    it('should throw error for invalid private key', () => {
      expect(() => {
        WalletManager.fromPrivateKey('invalid-key');
      }).toThrow('Invalid private key');
    });
  });

  describe('airdropSOL', () => {
    let connection: Connection;
    let publicKey: PublicKey;

    beforeEach(() => {
      connection = new Connection('https://api.devnet.solana.com');
      publicKey = Keypair.generate().publicKey;
    });

    it('should request and confirm airdrop', async () => {
      const signature = await WalletManager.airdropSOL(connection, publicKey, 1.0);

      expect(signature).toBe('mock-signature');
      expect(connection.requestAirdrop).toHaveBeenCalledWith(publicKey, 1e9);
      expect(connection.confirmTransaction).toHaveBeenCalled();
    });

    it('should handle fractional SOL amounts', async () => {
      await WalletManager.airdropSOL(connection, publicKey, 0.5);

      expect(connection.requestAirdrop).toHaveBeenCalledWith(publicKey, 0.5e9);
    });

    it('should throw error on airdrop failure', async () => {
      (connection.requestAirdrop as jest.Mock).mockRejectedValueOnce(
        new Error('Airdrop failed')
      );

      await expect(
        WalletManager.airdropSOL(connection, publicKey, 1.0)
      ).rejects.toThrow('Airdrop failed');
    });
  });

  describe('getSOLBalance', () => {
    it('should return SOL balance', async () => {
      const connection = new Connection('https://api.devnet.solana.com');
      const publicKey = Keypair.generate().publicKey;

      const balance = await WalletManager.getSOLBalance(connection, publicKey);

      expect(balance).toBe(1.0);
      expect(connection.getBalance).toHaveBeenCalledWith(publicKey);
    });
  });

  describe('isValidPublicKey', () => {
    it('should return true for valid public key', () => {
      const wallet = Keypair.generate();
      const isValid = WalletManager.isValidPublicKey(wallet.publicKey.toString());

      expect(isValid).toBe(true);
    });

    it('should return false for invalid public key', () => {
      const isValid = WalletManager.isValidPublicKey('invalid-key');
      expect(isValid).toBe(false);
    });

    it('should return false for empty string', () => {
      const isValid = WalletManager.isValidPublicKey('');
      expect(isValid).toBe(false);
    });
  });

  describe('isValidPrivateKey', () => {
    it('should return true for valid private key', () => {
      const wallet = Keypair.generate();
      const privateKey = bs58.encode(wallet.secretKey);
      const isValid = WalletManager.isValidPrivateKey(privateKey);

      expect(isValid).toBe(true);
    });

    it('should return false for invalid private key', () => {
      const isValid = WalletManager.isValidPrivateKey('invalid-key');
      expect(isValid).toBe(false);
    });

    it('should return false for wrong length', () => {
      const shortKey = bs58.encode(new Uint8Array(32)); // Too short
      const isValid = WalletManager.isValidPrivateKey(shortKey);
      expect(isValid).toBe(false);
    });
  });
});
