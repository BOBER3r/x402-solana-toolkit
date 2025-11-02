/**
 * Fastify plugin tests
 */

import Fastify, { FastifyInstance } from 'fastify';
import x402Plugin, { registerX402 } from '../src/middleware/fastify';
import {
  TransactionVerifier,
  PaymentRequirementsGenerator,
  createSuccessResult,
  createReplayAttackError,
  createTransactionNotFoundError,
} from '@x402-solana/core';

// Mock core package
jest.mock('@x402-solana/core', () => ({
  ...jest.requireActual('@x402-solana/core'),
  TransactionVerifier: jest.fn(),
  PaymentRequirementsGenerator: jest.fn(),
}));

describe('Fastify Plugin', () => {
  let app: FastifyInstance;
  let mockVerifier: any;
  let mockGenerator: any;

  const mockConfig = {
    solanaRpcUrl: 'https://api.devnet.solana.com',
    recipientWallet: 'TestWallet1111111111111111111111111111111',
    network: 'devnet' as const,
  };

  const mockPaymentHeader = Buffer.from(
    JSON.stringify({
      x402Version: 1,
      scheme: 'exact',
      network: 'solana-devnet',
      payload: {
        signature: 'TestSignature111111111111111111111111111111111111111111111111111',
      },
    })
  ).toString('base64');

  beforeEach(async () => {
    // Setup mocks
    mockVerifier = {
      verifyPayment: jest.fn(),
      close: jest.fn(),
    };

    mockGenerator = {
      generate: jest.fn().mockReturnValue({
        x402Version: 1,
        accepts: [
          {
            scheme: 'exact',
            network: 'solana-devnet',
            maxAmountRequired: '1000',
            description: 'Payment required',
            payTo: {
              address: 'TokenAccount1111111111111111111111111111111',
              asset: 'USDC11111111111111111111111111111111111111',
            },
            timeout: 300,
          },
        ],
        error: 'Payment Required',
      }),
      getRecipientUSDCAccount: jest
        .fn()
        .mockReturnValue('TokenAccount1111111111111111111111111111111'),
      getRecipientWallet: jest
        .fn()
        .mockReturnValue('TestWallet1111111111111111111111111111111'),
      getNetwork: jest.fn().mockReturnValue('devnet'),
    };

    (TransactionVerifier as jest.Mock).mockImplementation(() => mockVerifier);
    (PaymentRequirementsGenerator as jest.Mock).mockImplementation(() => mockGenerator);

    // Create Fastify app
    app = Fastify();

    // Register plugin
    await app.register(x402Plugin, mockConfig);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('Plugin Registration', () => {
    it('should register plugin successfully', async () => {
      const testApp = Fastify();
      await expect(testApp.register(x402Plugin, mockConfig)).resolves.not.toThrow();
      await testApp.close();
    });

    it('should decorate app with x402 helper methods', async () => {
      expect(app.requirePayment).toBeDefined();
      expect(app.x402).toBeDefined();
      expect(app.x402.verifier).toBeDefined();
      expect(app.x402.generator).toBeDefined();
    });

    it('should expose recipient account methods', () => {
      expect(app.x402.getRecipientUSDCAccount()).toBe(
        'TokenAccount1111111111111111111111111111111'
      );
      expect(app.x402.getRecipientWallet()).toBe(
        'TestWallet1111111111111111111111111111111'
      );
    });
  });

  describe('Route with x402 Config', () => {
    it('should return 402 when no payment header', async () => {
      app.get(
        '/test',
        {
          x402: {
            priceUSD: 0.001,
            description: 'Premium data',
          },
        },
        async (request, reply) => {
          return { success: true };
        }
      );

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(402);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('x402Version', 1);
      expect(body).toHaveProperty('accepts');
      expect(mockVerifier.verifyPayment).not.toHaveBeenCalled();
    });

    it('should allow request through with valid payment', async () => {
      mockVerifier.verifyPayment.mockResolvedValue(
        createSuccessResult(
          'TestSignature111111111111111111111111111111111111111111111111111',
          {
            amount: 1000,
            destination: 'TokenAccount1111111111111111111111111111111',
            authority: 'PayerWallet111111111111111111111111111111111',
            mint: 'USDC11111111111111111111111111111111111111',
            source: 'SourceAccount11111111111111111111111111111',
          },
          1234567890,
          123456
        )
      );

      app.get(
        '/test',
        {
          x402: {
            priceUSD: 0.001,
            description: 'Premium data',
          },
        },
        async (request, reply) => {
          return { success: true, payment: request.payment };
        }
      );

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-payment': mockPaymentHeader,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.payment).toBeDefined();
      expect(body.payment.signature).toBe(
        'TestSignature111111111111111111111111111111111111111111111111111'
      );
      expect(body.payment.amountUSD).toBe(0.001);
    });

    it('should attach payment info to request', async () => {
      mockVerifier.verifyPayment.mockResolvedValue(
        createSuccessResult(
          'TestSignature111111111111111111111111111111111111111111111111111',
          {
            amount: 1000,
            destination: 'TokenAccount1111111111111111111111111111111',
            authority: 'PayerWallet111111111111111111111111111111111',
            mint: 'USDC11111111111111111111111111111111111111',
            source: 'SourceAccount11111111111111111111111111111',
          },
          1234567890,
          123456
        )
      );

      let capturedPayment: any;

      app.get(
        '/test',
        {
          x402: {
            priceUSD: 0.001,
          },
        },
        async (request, reply) => {
          capturedPayment = request.payment;
          return { success: true };
        }
      );

      await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-payment': mockPaymentHeader,
        },
      });

      expect(capturedPayment).toBeDefined();
      expect(capturedPayment.signature).toBeDefined();
      expect(capturedPayment.amountUSD).toBe(0.001);
      expect(capturedPayment.payer).toBe('PayerWallet111111111111111111111111111111111');
      expect(capturedPayment.blockTime).toBe(1234567890);
      expect(capturedPayment.slot).toBe(123456);
    });

    it('should add X-PAYMENT-RESPONSE header', async () => {
      mockVerifier.verifyPayment.mockResolvedValue(
        createSuccessResult(
          'TestSignature111111111111111111111111111111111111111111111111111',
          {
            amount: 1000,
            destination: 'TokenAccount1111111111111111111111111111111',
            authority: 'PayerWallet111111111111111111111111111111111',
            mint: 'USDC11111111111111111111111111111111111111',
            source: 'SourceAccount11111111111111111111111111111',
          }
        )
      );

      app.get(
        '/test',
        {
          x402: {
            priceUSD: 0.001,
          },
        },
        async (request, reply) => {
          return { success: true };
        }
      );

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-payment': mockPaymentHeader,
        },
      });

      expect(response.headers['x-payment-response']).toBeDefined();
      const receipt = JSON.parse(
        Buffer.from(response.headers['x-payment-response'], 'base64').toString('utf-8')
      );
      expect(receipt.signature).toBe(
        'TestSignature111111111111111111111111111111111111111111111111111'
      );
      expect(receipt.status).toBe('verified');
    });
  });

  describe('Invalid Payment', () => {
    it('should return 402 when transaction not found', async () => {
      mockVerifier.verifyPayment.mockResolvedValue(
        createTransactionNotFoundError(
          'TestSignature111111111111111111111111111111111111111111111111111'
        )
      );

      app.get(
        '/test',
        {
          x402: {
            priceUSD: 0.001,
          },
        },
        async (request, reply) => {
          return { success: true };
        }
      );

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-payment': mockPaymentHeader,
        },
      });

      expect(response.statusCode).toBe(402);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('verificationError');
      expect(body.verificationError.message).toContain('not found');
    });

    it('should return 402 when replay attack detected', async () => {
      mockVerifier.verifyPayment.mockResolvedValue(
        createReplayAttackError(
          'TestSignature111111111111111111111111111111111111111111111111111'
        )
      );

      app.get(
        '/test',
        {
          x402: {
            priceUSD: 0.001,
          },
        },
        async (request, reply) => {
          return { success: true };
        }
      );

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-payment': mockPaymentHeader,
        },
      });

      expect(response.statusCode).toBe(402);
      const body = JSON.parse(response.body);
      expect(body.verificationError.code).toBe('REPLAY_ATTACK');
    });

    it('should return 402 with error when header is invalid', async () => {
      app.get(
        '/test',
        {
          x402: {
            priceUSD: 0.001,
          },
        },
        async (request, reply) => {
          return { success: true };
        }
      );

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-payment': 'invalid-base64!!!',
        },
      });

      expect(response.statusCode).toBe(402);
    });
  });

  describe('Routes without x402', () => {
    it('should not require payment for routes without x402 config', async () => {
      app.get('/public', async (request, reply) => {
        return { success: true, public: true };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/public',
      });

      expect(response.statusCode).toBe(200);
      expect(mockVerifier.verifyPayment).not.toHaveBeenCalled();
    });
  });

  describe('Factory Function', () => {
    it('should register plugin using factory function', async () => {
      const testApp = Fastify();
      await registerX402(testApp, mockConfig);
      expect(testApp.x402).toBeDefined();
      await testApp.close();
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when verification throws error', async () => {
      mockVerifier.verifyPayment.mockRejectedValue(new Error('RPC connection failed'));

      app.get(
        '/test',
        {
          x402: {
            priceUSD: 0.001,
          },
        },
        async (request, reply) => {
          return { success: true };
        }
      );

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-payment': mockPaymentHeader,
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Payment verification failed');
    });
  });
});
