/**
 * Unit tests for payment requirements generator
 */

import { PaymentRequirementsGenerator } from '../../src/generator/payment-requirements';
import { Keypair } from '@solana/web3.js';

describe('PaymentRequirementsGenerator', () => {
  let generator: PaymentRequirementsGenerator;
  let recipientKeypair: Keypair;

  beforeEach(() => {
    // Generate a random keypair for testing
    recipientKeypair = Keypair.generate();

    generator = new PaymentRequirementsGenerator({
      recipientWallet: recipientKeypair.publicKey.toString(),
      network: 'devnet',
    });
  });

  describe('Constructor', () => {
    it('should create generator with valid config', () => {
      expect(generator).toBeDefined();
      expect(generator.getNetwork()).toBe('devnet');
      expect(generator.getRecipientWallet()).toBe(recipientKeypair.publicKey.toString());
    });

    it('should throw on invalid wallet address', () => {
      expect(() => {
        new PaymentRequirementsGenerator({
          recipientWallet: 'invalid',
          network: 'devnet',
        });
      }).toThrow('Invalid recipient wallet');
    });

    it('should derive USDC token account', () => {
      const usdcAccount = generator.getRecipientUSDCAccount();
      expect(usdcAccount).toBeTruthy();
      expect(usdcAccount).not.toBe(recipientKeypair.publicKey.toString());
    });
  });

  describe('generate', () => {
    it('should generate payment requirements', () => {
      const requirements = generator.generate(0.001);

      expect(requirements).toHaveProperty('x402Version', 1);
      expect(requirements).toHaveProperty('accepts');
      expect(requirements).toHaveProperty('error');
      expect(requirements.accepts).toHaveLength(1);
    });

    it('should include correct amount in micro-USDC', () => {
      const requirements = generator.generate(0.001);
      const accept = requirements.accepts[0];

      expect(accept.maxAmountRequired).toBe('1000');
    });

    it('should include recipient USDC account, not wallet', () => {
      const requirements = generator.generate(0.001);
      const accept = requirements.accepts[0];

      expect(accept.payTo.address).toBe(generator.getRecipientUSDCAccount());
      expect(accept.payTo.address).not.toBe(generator.getRecipientWallet());
    });

    it('should include USDC mint address', () => {
      const requirements = generator.generate(0.001);
      const accept = requirements.accepts[0];

      expect(accept.payTo.asset).toBe('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr'); // Devnet USDC
    });

    it('should include correct network', () => {
      const requirements = generator.generate(0.001);
      const accept = requirements.accepts[0];

      expect(accept.network).toBe('solana-devnet');
    });

    it('should use default timeout', () => {
      const requirements = generator.generate(0.001);
      const accept = requirements.accepts[0];

      expect(accept.timeout).toBe(300);
    });

    it('should use custom timeout', () => {
      const requirements = generator.generate(0.001, {
        timeoutSeconds: 600,
      });
      const accept = requirements.accepts[0];

      expect(accept.timeout).toBe(600);
    });

    it('should include custom description', () => {
      const requirements = generator.generate(0.001, {
        description: 'Premium API access',
      });
      const accept = requirements.accepts[0];

      expect(accept.description).toBe('Premium API access');
    });

    it('should include custom resource', () => {
      const requirements = generator.generate(0.001, {
        resource: '/api/premium/data',
      });
      const accept = requirements.accepts[0];

      expect(accept.resource).toBe('/api/premium/data');
    });

    it('should include custom error message', () => {
      const requirements = generator.generate(0.001, {
        errorMessage: 'Custom error',
      });

      expect(requirements.error).toBe('Custom error');
    });

    it('should throw on zero price', () => {
      expect(() => generator.generate(0)).toThrow('Price must be greater than 0');
    });

    it('should throw on negative price', () => {
      expect(() => generator.generate(-1)).toThrow('Price must be greater than 0');
    });

    it('should handle various price amounts', () => {
      const testCases = [
        { usd: 0.001, expected: '1000' },
        { usd: 1, expected: '1000000' },
        { usd: 0.5, expected: '500000' },
        { usd: 10.123456, expected: '10123456' },
      ];

      testCases.forEach(({ usd, expected }) => {
        const requirements = generator.generate(usd);
        expect(requirements.accepts[0].maxAmountRequired).toBe(expected);
      });
    });
  });

  describe('generateMultiple', () => {
    it('should generate multiple payment options', () => {
      const requirements = generator.generateMultiple([
        { priceUSD: 0.001, description: 'Basic' },
        { priceUSD: 0.005, description: 'Premium' },
      ]);

      expect(requirements.accepts).toHaveLength(2);
      expect(requirements.accepts[0].maxAmountRequired).toBe('1000');
      expect(requirements.accepts[1].maxAmountRequired).toBe('5000');
      expect(requirements.accepts[0].description).toBe('Basic');
      expect(requirements.accepts[1].description).toBe('Premium');
    });

    it('should throw on empty options', () => {
      expect(() => generator.generateMultiple([])).toThrow('At least one payment option is required');
    });
  });

  describe('Mainnet generator', () => {
    it('should use mainnet USDC mint', () => {
      const mainnetGenerator = new PaymentRequirementsGenerator({
        recipientWallet: recipientKeypair.publicKey.toString(),
        network: 'mainnet-beta',
      });

      const requirements = mainnetGenerator.generate(0.001);
      const accept = requirements.accepts[0];

      expect(accept.payTo.asset).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // Mainnet USDC
      expect(accept.network).toBe('solana-mainnet-beta');
    });
  });

  describe('Static methods', () => {
    it('should encode and decode payment requirements', () => {
      const requirements = generator.generate(0.001);
      const encoded = PaymentRequirementsGenerator.encode(requirements);
      const decoded = PaymentRequirementsGenerator.decode(encoded);

      expect(decoded).toEqual(requirements);
    });

    it('should throw on invalid encoding', () => {
      expect(() => PaymentRequirementsGenerator.decode('invalid')).toThrow(
        'Invalid payment requirements encoding'
      );
    });
  });
});
