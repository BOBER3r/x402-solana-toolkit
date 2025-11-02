/**
 * Unit tests for payment cache
 */

import { InMemoryPaymentCache } from '../../src/verifier/payment-cache';
import { PaymentMetadata } from '../../src/types/solana.types';

describe('Payment Cache', () => {
  describe('InMemoryPaymentCache', () => {
    let cache: InMemoryPaymentCache;

    beforeEach(() => {
      // Create cache with short TTL for testing
      cache = new InMemoryPaymentCache(1, 0); // 1 second TTL, no auto-cleanup
    });

    afterEach(async () => {
      await cache.close();
    });

    describe('isUsed', () => {
      it('should return false for unused signature', async () => {
        const isUsed = await cache.isUsed('sig1');
        expect(isUsed).toBe(false);
      });

      it('should return true for used signature', async () => {
        const metadata: PaymentMetadata = {
          recipient: 'recipient1',
          amount: 1000,
          timestamp: Date.now(),
        };

        await cache.markUsed('sig1', metadata);
        const isUsed = await cache.isUsed('sig1');
        expect(isUsed).toBe(true);
      });

      it('should return false for expired signature', async () => {
        const metadata: PaymentMetadata = {
          recipient: 'recipient1',
          amount: 1000,
          timestamp: Date.now(),
        };

        await cache.markUsed('sig1', metadata);

        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 1100));

        const isUsed = await cache.isUsed('sig1');
        expect(isUsed).toBe(false);
      });
    });

    describe('markUsed', () => {
      it('should mark signature as used', async () => {
        const metadata: PaymentMetadata = {
          recipient: 'recipient1',
          amount: 1000,
          timestamp: Date.now(),
        };

        await cache.markUsed('sig1', metadata);
        const isUsed = await cache.isUsed('sig1');
        expect(isUsed).toBe(true);
      });

      it('should store metadata', async () => {
        const metadata: PaymentMetadata = {
          recipient: 'recipient1',
          amount: 1000,
          timestamp: Date.now(),
          payer: 'payer1',
        };

        await cache.markUsed('sig1', metadata);
        const stored = await cache.getMetadata('sig1');
        expect(stored).toEqual(metadata);
      });

      it('should overwrite existing entry', async () => {
        const metadata1: PaymentMetadata = {
          recipient: 'recipient1',
          amount: 1000,
          timestamp: Date.now(),
        };

        const metadata2: PaymentMetadata = {
          recipient: 'recipient2',
          amount: 2000,
          timestamp: Date.now(),
        };

        await cache.markUsed('sig1', metadata1);
        await cache.markUsed('sig1', metadata2);

        const stored = await cache.getMetadata('sig1');
        expect(stored).toEqual(metadata2);
      });
    });

    describe('getMetadata', () => {
      it('should return null for non-existent signature', async () => {
        const metadata = await cache.getMetadata('nonexistent');
        expect(metadata).toBeNull();
      });

      it('should return stored metadata', async () => {
        const metadata: PaymentMetadata = {
          recipient: 'recipient1',
          amount: 1000,
          timestamp: Date.now(),
          payer: 'payer1',
        };

        await cache.markUsed('sig1', metadata);
        const stored = await cache.getMetadata('sig1');
        expect(stored).toEqual(metadata);
      });

      it('should return null for expired signature', async () => {
        const metadata: PaymentMetadata = {
          recipient: 'recipient1',
          amount: 1000,
          timestamp: Date.now(),
        };

        await cache.markUsed('sig1', metadata);

        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 1100));

        const stored = await cache.getMetadata('sig1');
        expect(stored).toBeNull();
      });
    });

    describe('clear', () => {
      it('should clear all entries', async () => {
        const metadata: PaymentMetadata = {
          recipient: 'recipient1',
          amount: 1000,
          timestamp: Date.now(),
        };

        await cache.markUsed('sig1', metadata);
        await cache.markUsed('sig2', metadata);
        await cache.markUsed('sig3', metadata);

        await cache.clear();

        expect(await cache.isUsed('sig1')).toBe(false);
        expect(await cache.isUsed('sig2')).toBe(false);
        expect(await cache.isUsed('sig3')).toBe(false);
      });
    });

    describe('Multiple signatures', () => {
      it('should handle multiple signatures independently', async () => {
        const metadata1: PaymentMetadata = {
          recipient: 'recipient1',
          amount: 1000,
          timestamp: Date.now(),
        };

        const metadata2: PaymentMetadata = {
          recipient: 'recipient2',
          amount: 2000,
          timestamp: Date.now(),
        };

        await cache.markUsed('sig1', metadata1);
        await cache.markUsed('sig2', metadata2);

        expect(await cache.isUsed('sig1')).toBe(true);
        expect(await cache.isUsed('sig2')).toBe(true);

        const stored1 = await cache.getMetadata('sig1');
        const stored2 = await cache.getMetadata('sig2');

        expect(stored1).toEqual(metadata1);
        expect(stored2).toEqual(metadata2);
      });
    });

    describe('Automatic cleanup', () => {
      it('should clean up expired entries periodically', async () => {
        // Create cache with auto-cleanup every 100ms
        const cleanupCache = new InMemoryPaymentCache(0.5, 100); // 500ms TTL, 100ms cleanup

        const metadata: PaymentMetadata = {
          recipient: 'recipient1',
          amount: 1000,
          timestamp: Date.now(),
        };

        await cleanupCache.markUsed('sig1', metadata);
        expect(await cleanupCache.isUsed('sig1')).toBe(true);

        // Wait for expiration and cleanup
        await new Promise(resolve => setTimeout(resolve, 700));

        expect(await cleanupCache.isUsed('sig1')).toBe(false);

        await cleanupCache.close();
      });
    });
  });
});
