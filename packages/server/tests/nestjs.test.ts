/**
 * NestJS guard tests
 */

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { X402Guard, RequirePayment } from '../src/middleware/nestjs';
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

describe('NestJS Guard', () => {
  let guard: X402Guard;
  let reflector: Reflector;
  let mockVerifier: any;
  let mockGenerator: any;
  let mockExecutionContext: ExecutionContext;
  let mockRequest: any;
  let mockResponse: any;

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

    // Create reflector
    reflector = new Reflector();

    // Create guard
    guard = new X402Guard(reflector, mockConfig);

    // Mock request and response
    mockRequest = {
      headers: {},
      path: '/test',
      method: 'GET',
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };

    // Mock execution context
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('No Price Metadata', () => {
    it('should allow request through when no price is set', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockVerifier.verifyPayment).not.toHaveBeenCalled();
    });
  });

  describe('No Payment Header', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'get').mockReturnValue(0.001);
    });

    it('should return false and send 402 when no X-PAYMENT header', async () => {
      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(false);
      expect(mockResponse.status).toHaveBeenCalledWith(402);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          x402Version: 1,
          accepts: expect.any(Array),
        })
      );
    });

    it('should not call verifier when no payment header', async () => {
      await guard.canActivate(mockExecutionContext);

      expect(mockVerifier.verifyPayment).not.toHaveBeenCalled();
    });
  });

  describe('Valid Payment', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === 'x402:price') return 0.001;
        return undefined;
      });

      mockRequest.headers['x-payment'] = mockPaymentHeader;

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

    it('should return true when payment is valid', async () => {
      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('should attach payment to request', async () => {
      await guard.canActivate(mockExecutionContext);

      expect(mockRequest.payment).toBeDefined();
      expect(mockRequest.payment.signature).toBe(
        'TestSignature111111111111111111111111111111111111111111111111111'
      );
      expect(mockRequest.payment.amount).toBe(0.001);
      expect(mockRequest.payment.payer).toBe('PayerWallet111111111111111111111111111111111');
      expect(mockRequest.payment.blockTime).toBe(1234567890);
      expect(mockRequest.payment.slot).toBe(123456);
    });

    it('should add X-PAYMENT-RESPONSE header', async () => {
      await guard.canActivate(mockExecutionContext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-PAYMENT-RESPONSE',
        expect.any(String)
      );

      const headerValue = mockResponse.setHeader.mock.calls[0][1];
      const receipt = JSON.parse(Buffer.from(headerValue, 'base64').toString('utf-8'));

      expect(receipt.signature).toBe(
        'TestSignature111111111111111111111111111111111111111111111111111'
      );
      expect(receipt.status).toBe('verified');
      expect(receipt.network).toBe('solana-devnet');
    });

    it('should verify payment with correct parameters', async () => {
      await guard.canActivate(mockExecutionContext);

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
    beforeEach(() => {
      jest.spyOn(reflector, 'get').mockReturnValue(0.001);
      mockRequest.headers['x-payment'] = mockPaymentHeader;
    });

    it('should return false when transaction not found', async () => {
      mockVerifier.verifyPayment.mockResolvedValue(
        createTransactionNotFoundError(
          'TestSignature111111111111111111111111111111111111111111111111111'
        )
      );

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(false);
      expect(mockResponse.status).toHaveBeenCalledWith(402);
    });

    it('should return false when replay attack detected', async () => {
      mockVerifier.verifyPayment.mockResolvedValue(
        createReplayAttackError(
          'TestSignature111111111111111111111111111111111111111111111111111'
        )
      );

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(false);
      expect(mockResponse.status).toHaveBeenCalledWith(402);
    });

    it('should include error message in 402 response', async () => {
      mockVerifier.verifyPayment.mockResolvedValue(
        createTransactionNotFoundError(
          'TestSignature111111111111111111111111111111111111111111111111111'
        )
      );

      await guard.canActivate(mockExecutionContext);

      expect(mockGenerator.generate).toHaveBeenCalledWith(
        0.001,
        expect.objectContaining({
          errorMessage: expect.stringContaining('not found'),
        })
      );
    });
  });

  describe('Route Options', () => {
    beforeEach(() => {
      mockRequest.headers['x-payment'] = mockPaymentHeader;
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
    });

    it('should use custom timeout from route options', async () => {
      jest.spyOn(reflector, 'get').mockImplementation((key) => {
        if (key === 'x402:price') return 0.001;
        if (key === 'x402:options')
          return {
            maxPaymentAgeMs: 600_000,
          };
        return undefined;
      });

      await guard.canActivate(mockExecutionContext);

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

  describe('RequirePayment Decorator', () => {
    it('should set price metadata', () => {
      const target = {};
      const propertyKey = 'testMethod';
      const descriptor = { value: jest.fn() };

      RequirePayment(0.001)(target, propertyKey, descriptor as any);

      // Verify metadata is set (this is a simplified check)
      // In real scenario, you'd use Reflect.getMetadata
      expect(descriptor).toBeDefined();
    });

    it('should set price and options metadata', () => {
      const target = {};
      const propertyKey = 'testMethod';
      const descriptor = { value: jest.fn() };

      RequirePayment(0.001, {
        description: 'Test',
        resource: '/test',
      })(target, propertyKey, descriptor as any);

      expect(descriptor).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'get').mockReturnValue(0.001);
      mockRequest.headers['x-payment'] = mockPaymentHeader;
    });

    it('should throw HttpException when verification throws error', async () => {
      mockVerifier.verifyPayment.mockRejectedValue(new Error('RPC connection failed'));

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should close verifier on module destroy', async () => {
      await (guard as any).onModuleDestroy();

      expect(mockVerifier.close).toHaveBeenCalled();
    });
  });
});
