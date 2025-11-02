/**
 * Tests for PaymentSender
 */

import { PaymentSender } from '../src/payment-sender';
import { PaymentError, PaymentErrorCode } from '../src/types';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';

// Mock @solana/web3.js
jest.mock('@solana/web3.js', () => {
  const actual = jest.requireActual('@solana/web3.js');
  return {
    ...actual,
    Connection: jest.fn().mockImplementation(() => ({
      getLatestBlockhash: jest.fn().mockResolvedValue({
        blockhash: 'mock-blockhash',
        lastValidBlockHeight: 1000000,
      }),
      sendRawTransaction: jest.fn().mockResolvedValue('mock-signature'),
      confirmTransaction: jest.fn().mockResolvedValue({
        value: { err: null },
      }),
      getTokenAccountBalance: jest.fn().mockResolvedValue({
        value: {
          amount: '5000000', // 5 USDC
          uiAmount: 5.0,
        },
      }),
      getBalance: jest.fn().mockResolvedValue(1_000_000_000), // 1 SOL
    })),
  };
});

// Mock @solana/spl-token
jest.mock('@solana/spl-token', () => ({
  getAssociatedTokenAddressSync: jest.fn().mockReturnValue(
    new (jest.requireActual('@solana/web3.js').PublicKey)(
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
    )
  ),
  createTransferInstruction: jest.fn().mockReturnValue({}),
  createAssociatedTokenAccountInstruction: jest.fn().mockReturnValue({}),
  getAccount: jest.fn().mockResolvedValue({
    address: 'mock-address',
    mint: 'mock-mint',
    owner: 'mock-owner',
    amount: BigInt(5000000),
  }),
}));

describe('PaymentSender', () => {
  let sender: PaymentSender;
  let connection: Connection;
  let wallet: Keypair;
  const usdcMint = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

  beforeEach(() => {
    connection = new Connection('https://api.devnet.solana.com');
    wallet = Keypair.generate();
    sender = new PaymentSender(connection, wallet);
  });

  describe('constructor', () => {
    it('should create PaymentSender instance', () => {
      expect(sender).toBeInstanceOf(PaymentSender);
    });
  });

  describe('sendUSDC', () => {
    it('should send USDC payment', async () => {
      const recipientWallet = Keypair.generate().publicKey.toString();
      const signature = await sender.sendUSDC(recipientWallet, 0.5, usdcMint);

      expect(signature).toBe('mock-signature');
      expect(connection.sendRawTransaction).toHaveBeenCalled();
      expect(connection.confirmTransaction).toHaveBeenCalled();
    });

    it('should throw error for insufficient balance', async () => {
      (connection.getTokenAccountBalance as jest.Mock).mockResolvedValueOnce({
        value: {
          amount: '100000', // Only 0.1 USDC
          uiAmount: 0.1,
        },
      });

      const recipientWallet = Keypair.generate().publicKey.toString();

      await expect(sender.sendUSDC(recipientWallet, 0.5, usdcMint)).rejects.toThrow(
        PaymentError
      );
    });

    it('should skip balance check when requested', async () => {
      const recipientWallet = Keypair.generate().publicKey.toString();
      const signature = await sender.sendUSDC(recipientWallet, 0.5, usdcMint, {
        skipBalanceCheck: true,
      });

      expect(signature).toBe('mock-signature');
    });

    it('should create token account if requested', async () => {
      const { getAccount } = require('@solana/spl-token');
      getAccount.mockRejectedValueOnce(new Error('Account not found'));

      const recipientWallet = Keypair.generate().publicKey.toString();
      const signature = await sender.sendUSDC(recipientWallet, 0.5, usdcMint, {
        createTokenAccount: true,
      });

      expect(signature).toBe('mock-signature');
    });

    it('should handle transaction failure', async () => {
      (connection.confirmTransaction as jest.Mock).mockResolvedValueOnce({
        value: { err: 'Transaction failed' },
      });

      const recipientWallet = Keypair.generate().publicKey.toString();

      await expect(sender.sendUSDC(recipientWallet, 0.5, usdcMint)).rejects.toThrow(
        PaymentError
      );
    });
  });

  describe('estimatePaymentCost', () => {
    it('should estimate payment cost', async () => {
      const estimate = await sender.estimatePaymentCost(0.5, usdcMint);

      expect(estimate).toHaveProperty('usdcAmount', 0.5);
      expect(estimate).toHaveProperty('solFee');
      expect(estimate).toHaveProperty('totalUSD');
      expect(estimate).toHaveProperty('hasSufficientBalance');
      expect(estimate).toHaveProperty('currentUSDCBalance', 5.0);
      expect(estimate).toHaveProperty('currentSOLBalance', 1.0);
    });

    it('should detect insufficient balance', async () => {
      (connection.getTokenAccountBalance as jest.Mock).mockResolvedValueOnce({
        value: {
          amount: '100000', // Only 0.1 USDC
          uiAmount: 0.1,
        },
      });

      const estimate = await sender.estimatePaymentCost(0.5, usdcMint);

      expect(estimate.hasSufficientBalance).toBe(false);
    });

    it('should handle non-existent token account', async () => {
      (connection.getTokenAccountBalance as jest.Mock).mockRejectedValueOnce(
        new Error('Account not found')
      );

      const estimate = await sender.estimatePaymentCost(0.5, usdcMint);

      expect(estimate.currentUSDCBalance).toBe(0);
      expect(estimate.hasSufficientBalance).toBe(false);
    });
  });

  describe('hasSufficientBalance', () => {
    it('should return true for sufficient balance', async () => {
      const hasSufficient = await sender.hasSufficientBalance(0.5, usdcMint);
      expect(hasSufficient).toBe(true);
    });

    it('should return false for insufficient balance', async () => {
      (connection.getTokenAccountBalance as jest.Mock).mockResolvedValueOnce({
        value: {
          amount: '100000', // Only 0.1 USDC
          uiAmount: 0.1,
        },
      });

      const hasSufficient = await sender.hasSufficientBalance(0.5, usdcMint);
      expect(hasSufficient).toBe(false);
    });
  });

  describe('getUSDCBalance', () => {
    it('should return USDC balance', async () => {
      const balance = await sender.getUSDCBalance(usdcMint);
      expect(balance).toBe(5.0);
    });

    it('should return 0 for non-existent account', async () => {
      (connection.getTokenAccountBalance as jest.Mock).mockRejectedValueOnce(
        new Error('Account not found')
      );

      const balance = await sender.getUSDCBalance(usdcMint);
      expect(balance).toBe(0);
    });
  });

  describe('getPublicKey', () => {
    it('should return wallet public key', () => {
      const publicKey = sender.getPublicKey();
      expect(publicKey.toString()).toBe(wallet.publicKey.toString());
    });
  });

  describe('tokenAccountExists', () => {
    it('should return true if token account exists', async () => {
      const exists = await sender.tokenAccountExists(usdcMint);
      expect(exists).toBe(true);
    });

    it('should return false if token account does not exist', async () => {
      const { getAccount } = require('@solana/spl-token');
      getAccount.mockRejectedValueOnce(new Error('Account not found'));

      const exists = await sender.tokenAccountExists(usdcMint);
      expect(exists).toBe(false);
    });

    it('should check token account for specific owner', async () => {
      const otherOwner = Keypair.generate().publicKey;
      const exists = await sender.tokenAccountExists(usdcMint, otherOwner);
      expect(exists).toBe(true);
    });
  });
});
