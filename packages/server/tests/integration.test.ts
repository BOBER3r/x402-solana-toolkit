/**
 * Integration tests for x402 payment flow
 * Tests end-to-end payment verification across all frameworks
 */

import express from 'express';
import { Test } from '@nestjs/testing';
import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import Fastify from 'fastify';
import request from 'supertest';
import { X402Middleware } from '../src/middleware/express';
import { X402Guard, RequirePayment, X402Module } from '../src/middleware/nestjs';
import x402Plugin from '../src/middleware/fastify';
import {
  TransactionVerifier,
  PaymentRequirementsGenerator,
  createSuccessResult,
} from '@x402-solana/core';

// Mock core package
jest.mock('@x402-solana/core', () => ({
  ...jest.requireActual('@x402-solana/core'),
  TransactionVerifier: jest.fn(),
  PaymentRequirementsGenerator: jest.fn(),
}));

describe('Integration Tests', () => {
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

  let mockVerifier: any;
  let mockGenerator: any;

  beforeEach(() => {
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Payment Flow - Express', () => {
    it('should handle complete payment flow', async () => {
      const app = express();
      const middleware = new X402Middleware(mockConfig);

      app.get('/premium', middleware.requirePayment(0.001), (req, res) => {
        res.json({
          data: 'premium content',
          payment: req.payment,
        });
      });

      // Step 1: Request without payment returns 402
      const step1 = await request(app).get('/premium');
      expect(step1.status).toBe(402);
      expect(step1.body).toHaveProperty('x402Version');
      expect(step1.body.accepts[0].payTo.address).toBe(
        'TokenAccount1111111111111111111111111111111'
      );

      // Step 2: Request with valid payment returns 200
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

      const step2 = await request(app).get('/premium').set('X-PAYMENT', mockPaymentHeader);

      expect(step2.status).toBe(200);
      expect(step2.body.data).toBe('premium content');
      expect(step2.body.payment).toBeDefined();
      expect(step2.headers['x-payment-response']).toBeDefined();

      await middleware.close();
    });
  });

  describe('Payment Flow - NestJS', () => {
    it('should handle complete payment flow', async () => {
      @Controller('api')
      @UseGuards(X402Guard)
      class TestController {
        @Get('premium')
        @RequirePayment(0.001)
        getPremiumData() {
          return { data: 'premium content' };
        }
      }

      @Module({
        imports: [X402Module.register(mockConfig)],
        controllers: [TestController],
      })
      class TestModule {}

      const moduleRef = await Test.createTestingModule({
        imports: [TestModule],
      }).compile();

      const app = moduleRef.createNestApplication();
      await app.init();

      // Step 1: Request without payment returns 402
      const step1 = await request(app.getHttpServer()).get('/api/premium');
      expect(step1.status).toBe(402);
      expect(step1.body).toHaveProperty('x402Version');

      // Step 2: Request with valid payment returns 200
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

      const step2 = await request(app.getHttpServer())
        .get('/api/premium')
        .set('X-PAYMENT', mockPaymentHeader);

      expect(step2.status).toBe(200);
      expect(step2.body.data).toBe('premium content');
      expect(step2.headers['x-payment-response']).toBeDefined();

      await app.close();
    });
  });

  describe('Payment Flow - Fastify', () => {
    it('should handle complete payment flow', async () => {
      const app = Fastify();
      await app.register(x402Plugin, mockConfig);

      app.get(
        '/premium',
        {
          x402: {
            priceUSD: 0.001,
            description: 'Premium data',
          },
        },
        async (request, reply) => {
          return {
            data: 'premium content',
            payment: request.payment,
          };
        }
      );

      // Step 1: Request without payment returns 402
      const step1 = await app.inject({
        method: 'GET',
        url: '/premium',
      });

      expect(step1.statusCode).toBe(402);
      const body1 = JSON.parse(step1.body);
      expect(body1).toHaveProperty('x402Version');

      // Step 2: Request with valid payment returns 200
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

      const step2 = await app.inject({
        method: 'GET',
        url: '/premium',
        headers: {
          'x-payment': mockPaymentHeader,
        },
      });

      expect(step2.statusCode).toBe(200);
      const body2 = JSON.parse(step2.body);
      expect(body2.data).toBe('premium content');
      expect(body2.payment).toBeDefined();
      expect(step2.headers['x-payment-response']).toBeDefined();

      await app.close();
    });
  });

  describe('Multiple Price Tiers', () => {
    it('should support different prices for different routes', async () => {
      const app = express();
      const middleware = new X402Middleware(mockConfig);

      app.get('/basic', middleware.requirePayment(0.001), (req, res) => {
        res.json({ tier: 'basic', payment: req.payment });
      });

      app.get('/premium', middleware.requirePayment(0.01), (req, res) => {
        res.json({ tier: 'premium', payment: req.payment });
      });

      // Check basic tier
      const basicResponse = await request(app).get('/basic');
      expect(basicResponse.status).toBe(402);
      expect(mockGenerator.generate).toHaveBeenCalledWith(0.001, expect.any(Object));

      // Check premium tier
      const premiumResponse = await request(app).get('/premium');
      expect(premiumResponse.status).toBe(402);
      expect(mockGenerator.generate).toHaveBeenCalledWith(0.01, expect.any(Object));

      await middleware.close();
    });
  });

  describe('Payment Receipt Verification', () => {
    it('should generate valid payment receipt', async () => {
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

      const app = express();
      const middleware = new X402Middleware(mockConfig);

      app.get('/test', middleware.requirePayment(0.001), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test').set('X-PAYMENT', mockPaymentHeader);

      expect(response.status).toBe(200);
      expect(response.headers['x-payment-response']).toBeDefined();

      // Decode and verify receipt
      const receiptBase64 = response.headers['x-payment-response'];
      const receiptJson = Buffer.from(receiptBase64, 'base64').toString('utf-8');
      const receipt = JSON.parse(receiptJson);

      expect(receipt.signature).toBe(
        'TestSignature111111111111111111111111111111111111111111111111111'
      );
      expect(receipt.status).toBe('verified');
      expect(receipt.network).toBe('solana-devnet');
      expect(receipt.amount).toBe(1000);
      expect(receipt.blockTime).toBe(1234567890);
      expect(receipt.slot).toBe(123456);

      await middleware.close();
    });
  });
});
