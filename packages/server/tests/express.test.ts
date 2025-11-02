/**
 * Express middleware tests
 */

import express, { Request, Response } from 'express';
import request from 'supertest';
import { X402Middleware } from '../src/middleware/express';
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

describe('Express Middleware', () => {
  let app: express.Application;
  let middleware: X402Middleware;
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

  beforeEach(() => {
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

    // Create middleware instance
    middleware = new X402Middleware(mockConfig);

    // Create Express app
    app = express();
    app.use(express.json());
  });

  afterEach(async () => {
    await middleware.close();
    jest.clearAllMocks();
  });

  describe('No Payment Header', () => {
    it('should return 402 with payment requirements when no X-PAYMENT header', async () => {
      app.get('/test', middleware.requirePayment(0.001), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(402);
      expect(response.body).toHaveProperty('x402Version', 1);
      expect(response.body).toHaveProperty('accepts');
      expect(response.body.accepts).toHaveLength(1);
      expect(response.body.accepts[0]).toHaveProperty('maxAmountRequired', '1000');
      expect(mockVerifier.verifyPayment).not.toHaveBeenCalled();
    });

    it('should include custom description in payment requirements', async () => {
      app.get(
        '/test',
        middleware.requirePayment(0.001, {
          description: 'Premium API access',
        }),
        (req, res) => {
          res.json({ success: true });
        }
      );

      await request(app).get('/test');

      expect(mockGenerator.generate).toHaveBeenCalledWith(
        0.001,
        expect.objectContaining({
          description: 'Premium API access',
        })
      );
    });

    it('should include resource in payment requirements', async () => {
      app.get(
        '/test',
        middleware.requirePayment(0.001, {
          resource: '/api/premium',
        }),
        (req, res) => {
          res.json({ success: true });
        }
      );

      await request(app).get('/test');

      expect(mockGenerator.generate).toHaveBeenCalledWith(
        0.001,
        expect.objectContaining({
          resource: '/api/premium',
        })
      );
    });
  });

  describe('Valid Payment', () => {
    beforeEach(() => {
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
    });

    it('should allow request through when payment is valid', async () => {
      app.get('/test', middleware.requirePayment(0.001), (req, res) => {
        res.json({ success: true, payment: req.payment });
      });

      const response = await request(app)
        .get('/test')
        .set('X-PAYMENT', mockPaymentHeader);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.payment).toBeDefined();
      expect(response.body.payment.signature).toBe(
        'TestSignature111111111111111111111111111111111111111111111111111'
      );
      expect(response.body.payment.amountUSD).toBe(0.001);
      expect(response.body.payment.payer).toBe('PayerWallet111111111111111111111111111111111');
    });

    it('should attach payment info to request', async () => {
      let capturedPayment: any;

      app.get('/test', middleware.requirePayment(0.001), (req, res) => {
        capturedPayment = req.payment;
        res.json({ success: true });
      });

      await request(app).get('/test').set('X-PAYMENT', mockPaymentHeader);

      expect(capturedPayment).toBeDefined();
      expect(capturedPayment.signature).toBeDefined();
      expect(capturedPayment.amountUSD).toBe(0.001);
      expect(capturedPayment.payer).toBeDefined();
      expect(capturedPayment.blockTime).toBe(1234567890);
      expect(capturedPayment.slot).toBe(123456);
    });

    it('should add X-PAYMENT-RESPONSE header', async () => {
      app.get('/test', middleware.requirePayment(0.001), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/test')
        .set('X-PAYMENT', mockPaymentHeader);

      expect(response.headers['x-payment-response']).toBeDefined();
      const receipt = JSON.parse(
        Buffer.from(response.headers['x-payment-response'], 'base64').toString('utf-8')
      );
      expect(receipt.signature).toBe(
        'TestSignature111111111111111111111111111111111111111111111111111'
      );
      expect(receipt.status).toBe('verified');
      expect(receipt.network).toBe('solana-devnet');
    });

    it('should verify payment with correct parameters', async () => {
      app.get('/test', middleware.requirePayment(0.001), (req, res) => {
        res.json({ success: true });
      });

      await request(app).get('/test').set('X-PAYMENT', mockPaymentHeader);

      expect(mockVerifier.verifyPayment).toHaveBeenCalledWith(
        'TestSignature111111111111111111111111111111111111111111111111111',
        'TokenAccount1111111111111111111111111111111',
        0.001,
        expect.objectContaining({
          maxAgeMs: 300_000,
          commitment: 'confirmed',
        })
      );
    });
  });

  describe('Invalid Payment', () => {
    it('should return 402 when payment verification fails - transaction not found', async () => {
      mockVerifier.verifyPayment.mockResolvedValue(
        createTransactionNotFoundError(
          'TestSignature111111111111111111111111111111111111111111111111111'
        )
      );

      app.get('/test', middleware.requirePayment(0.001), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/test')
        .set('X-PAYMENT', mockPaymentHeader);

      expect(response.status).toBe(402);
      expect(response.body).toHaveProperty('x402Version');
      expect(response.body).toHaveProperty('verificationError');
      expect(response.body.verificationError.message).toContain('not found');
    });

    it('should return 402 when payment is replay attack', async () => {
      mockVerifier.verifyPayment.mockResolvedValue(
        createReplayAttackError(
          'TestSignature111111111111111111111111111111111111111111111111111'
        )
      );

      app.get('/test', middleware.requirePayment(0.001), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/test')
        .set('X-PAYMENT', mockPaymentHeader);

      expect(response.status).toBe(402);
      expect(response.body.verificationError.code).toBe('REPLAY_ATTACK');
    });

    it('should return 402 with error message when header is invalid', async () => {
      app.get('/test', middleware.requirePayment(0.001), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test').set('X-PAYMENT', 'invalid-base64!!!');

      expect(response.status).toBe(402);
      expect(mockGenerator.generate).toHaveBeenCalledWith(
        0.001,
        expect.objectContaining({
          errorMessage: expect.stringContaining('Invalid payment header'),
        })
      );
    });
  });

  describe('Internal Errors', () => {
    it('should return 500 when verification throws error', async () => {
      mockVerifier.verifyPayment.mockRejectedValue(new Error('RPC connection failed'));

      app.get('/test', middleware.requirePayment(0.001), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/test')
        .set('X-PAYMENT', mockPaymentHeader);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Payment verification failed');
    });
  });

  describe('Middleware Options', () => {
    it('should use custom timeout', async () => {
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
        middleware.requirePayment(0.001, {
          timeoutSeconds: 600,
        }),
        (req, res) => {
          res.json({ success: true });
        }
      );

      await request(app).get('/test').set('X-PAYMENT', mockPaymentHeader);

      expect(mockVerifier.verifyPayment).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({
          maxAgeMs: 600_000,
        })
      );
    });
  });

  describe('Factory Function', () => {
    it('should create middleware using factory function', () => {
      const { createX402Middleware } = require('../src/middleware/express');
      const factoryMiddleware = createX402Middleware(mockConfig);

      expect(factoryMiddleware).toBeInstanceOf(X402Middleware);
    });
  });
});
