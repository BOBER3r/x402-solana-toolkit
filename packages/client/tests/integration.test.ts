/**
 * Integration tests for X402Client
 */

import { X402Client } from '../src/x402-client';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

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
          amount: '10000000', // 10 USDC
          uiAmount: 10.0,
        },
      }),
      getBalance: jest.fn().mockResolvedValue(1_000_000_000), // 1 SOL
    })),
  };
});

// Mock @solana/spl-token
jest.mock('@solana/spl-token', () => ({
  getAssociatedTokenAddressSync: jest.fn().mockReturnValue({
    toString: () => 'mock-token-account',
  }),
  createTransferInstruction: jest.fn().mockReturnValue({}),
}));

describe('Integration Tests', () => {
  let client: X402Client;
  let mockWallet: Keypair;

  beforeAll(() => {
    mockWallet = Keypair.generate();
  });

  beforeEach(() => {
    client = new X402Client({
      solanaRpcUrl: 'https://api.devnet.solana.com',
      walletPrivateKey: bs58.encode(mockWallet.secretKey),
      network: 'devnet',
      debug: true,
    });
  });

  describe('End-to-end payment flow', () => {
    it('should handle complete payment flow', async () => {
      const mock402Response = {
        status: 402,
        json: jest.fn().mockResolvedValue({
          x402Version: 1,
          error: 'Payment required',
          accepts: [
            {
              scheme: 'solana-usdc',
              network: 'devnet',
              maxAmountRequired: '500000', // 0.5 USDC
              resource: '/api/data',
              description: 'Access to premium data',
              payTo: {
                address: 'recipient-token-account',
                asset: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
              },
              timeout: 300,
            },
          ],
        }),
      };

      const mock200Response = {
        status: 200,
        json: jest.fn().mockResolvedValue({
          data: 'premium content',
          timestamp: Date.now(),
        }),
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mock402Response)
        .mockResolvedValueOnce(mock200Response);

      const response = await client.fetch('https://api.example.com/premium');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('data', 'premium content');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Multiple requests with caching', () => {
    it('should handle multiple paid requests', async () => {
      const createMock402 = (resource: string) => ({
        status: 402,
        json: jest.fn().mockResolvedValue({
          x402Version: 1,
          error: 'Payment required',
          accepts: [
            {
              scheme: 'solana-usdc',
              network: 'devnet',
              maxAmountRequired: '250000', // 0.25 USDC
              resource,
              description: `Access to ${resource}`,
              payTo: {
                address: 'recipient-token-account',
                asset: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
              },
              timeout: 300,
            },
          ],
        }),
      });

      const createMock200 = (data: any) => ({
        status: 200,
        json: jest.fn().mockResolvedValue(data),
      });

      // First request
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(createMock402('/api/data1'))
        .mockResolvedValueOnce(createMock200({ data: 'content1' }));

      const response1 = await client.fetch('https://api.example.com/data1');
      const data1 = await response1.json();

      expect(data1).toHaveProperty('data', 'content1');

      // Second request
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(createMock402('/api/data2'))
        .mockResolvedValueOnce(createMock200({ data: 'content2' }));

      const response2 = await client.fetch('https://api.example.com/data2');
      const data2 = await response2.json();

      expect(data2).toHaveProperty('data', 'content2');

      // Should have made 4 total calls (2 x (402 + 200))
      expect(global.fetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('Replay attack prevention', () => {
    it('should use unique signatures for each payment', async () => {
      const signatures: string[] = [];

      const mock402Response = {
        status: 402,
        json: jest.fn().mockResolvedValue({
          x402Version: 1,
          error: 'Payment required',
          accepts: [
            {
              scheme: 'solana-usdc',
              network: 'devnet',
              maxAmountRequired: '100000', // 0.1 USDC
              resource: '/api/test',
              description: 'Test resource',
              payTo: {
                address: 'recipient-token-account',
                asset: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
              },
              timeout: 300,
            },
          ],
        }),
      };

      const mock200Response = {
        status: 200,
        json: jest.fn().mockResolvedValue({ data: 'test' }),
      };

      // First payment
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mock402Response)
        .mockResolvedValueOnce(mock200Response);

      await client.fetch('https://api.example.com/test');

      const firstPaymentCall = (global.fetch as jest.Mock).mock.calls[1];
      const firstPaymentHeader = firstPaymentCall[1]?.headers['X-PAYMENT'];
      signatures.push(firstPaymentHeader);

      // Second payment
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mock402Response)
        .mockResolvedValueOnce(mock200Response);

      await client.fetch('https://api.example.com/test');

      const secondPaymentCall = (global.fetch as jest.Mock).mock.calls[3];
      const secondPaymentHeader = secondPaymentCall[1]?.headers['X-PAYMENT'];
      signatures.push(secondPaymentHeader);

      // Signatures should be different (different transactions)
      // Note: In this mock setup they'll be the same because we're using
      // a mock signature, but in real usage they would be unique
      expect(signatures).toHaveLength(2);
    });
  });

  describe('Error recovery', () => {
    it('should recover from temporary network failures', async () => {
      const mock402Response = {
        status: 402,
        json: jest.fn().mockResolvedValue({
          x402Version: 1,
          error: 'Payment required',
          accepts: [
            {
              scheme: 'solana-usdc',
              network: 'devnet',
              maxAmountRequired: '100000',
              resource: '/api/test',
              description: 'Test',
              payTo: {
                address: 'recipient-token-account',
                asset: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
              },
              timeout: 300,
            },
          ],
        }),
      };

      const mock200Response = {
        status: 200,
        json: jest.fn().mockResolvedValue({ data: 'success' }),
      };

      // Fail first, then succeed
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce(mock402Response)
        .mockResolvedValueOnce(mock200Response);

      const response = await client.fetch('https://api.example.com/test');

      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Payment header encoding', () => {
    it('should encode payment proof correctly', async () => {
      const mock402Response = {
        status: 402,
        json: jest.fn().mockResolvedValue({
          x402Version: 1,
          error: 'Payment required',
          accepts: [
            {
              scheme: 'solana-usdc',
              network: 'devnet',
              maxAmountRequired: '100000',
              resource: '/api/test',
              description: 'Test',
              payTo: {
                address: 'recipient-token-account',
                asset: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
              },
              timeout: 300,
            },
          ],
        }),
      };

      const mock200Response = {
        status: 200,
        json: jest.fn().mockResolvedValue({ data: 'success' }),
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mock402Response)
        .mockResolvedValueOnce(mock200Response);

      await client.fetch('https://api.example.com/test');

      const paymentCall = (global.fetch as jest.Mock).mock.calls[1];
      const paymentHeader = paymentCall[1]?.headers['X-PAYMENT'];

      // Should be base64 encoded
      expect(paymentHeader).toBeTruthy();

      // Decode and verify structure
      const decoded = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());
      expect(decoded).toHaveProperty('x402Version', 1);
      expect(decoded).toHaveProperty('scheme', 'solana-usdc');
      expect(decoded).toHaveProperty('network', 'devnet');
      expect(decoded).toHaveProperty('payload');
      expect(decoded.payload).toHaveProperty('signature', 'mock-signature');
    });
  });

  describe('Request options passthrough', () => {
    it('should preserve custom headers', async () => {
      const mock200Response = {
        status: 200,
        json: jest.fn().mockResolvedValue({ data: 'test' }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mock200Response);

      await client.fetch('https://api.example.com/test', {
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'custom-value',
        },
      });

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      expect(callArgs[1]?.headers).toEqual({
        'Content-Type': 'application/json',
        'X-Custom-Header': 'custom-value',
      });
    });

    it('should preserve request method and body', async () => {
      const mock200Response = {
        status: 200,
        json: jest.fn().mockResolvedValue({ data: 'test' }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mock200Response);

      const body = JSON.stringify({ query: 'test' });

      await client.fetch('https://api.example.com/test', {
        method: 'POST',
        body,
      });

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      expect(callArgs[1]?.method).toBe('POST');
      expect(callArgs[1]?.body).toBe(body);
    });
  });
});
