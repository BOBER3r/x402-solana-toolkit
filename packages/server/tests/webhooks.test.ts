/**
 * Webhook system tests
 */

import { WebhookSigner } from '../src/webhooks/webhook-signer';
import { WebhookSender } from '../src/webhooks/webhook-sender';
import { WebhookLogger } from '../src/webhooks/webhook-logger';
import { InMemoryWebhookQueue, createQueuedWebhook } from '../src/webhooks/webhook-queue';
import { WebhookManager } from '../src/webhooks/webhook-manager';
import { MockWebhookServer } from '../src/webhooks/webhook-test';
import { WebhookPayload } from '../src/webhooks/types';

describe('Webhook System', () => {
  describe('WebhookSigner', () => {
    it('should generate HMAC signature', () => {
      const signer = new WebhookSigner();
      const payload = { test: 'data' };
      const secret = 'test-secret';

      const signature = signer.sign(payload, secret);

      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it('should verify valid signature', () => {
      const signer = new WebhookSigner();
      const payload = { test: 'data' };
      const secret = 'test-secret';

      const signature = signer.sign(payload, secret);
      const isValid = signer.verify(payload, signature, secret);

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const signer = new WebhookSigner();
      const payload = { test: 'data' };
      const secret = 'test-secret';

      const isValid = signer.verify(payload, 'sha256=invalid', secret);

      expect(isValid).toBe(false);
    });

    it('should reject wrong secret', () => {
      const signer = new WebhookSigner();
      const payload = { test: 'data' };

      const signature = signer.sign(payload, 'secret1');
      const isValid = signer.verify(payload, signature, 'secret2');

      expect(isValid).toBe(false);
    });

    it('should reject tampered payload', () => {
      const signer = new WebhookSigner();
      const payload = { test: 'data' };
      const secret = 'test-secret';

      const signature = signer.sign(payload, secret);
      const tamperedPayload = { test: 'modified' };
      const isValid = signer.verify(tamperedPayload, signature, secret);

      expect(isValid).toBe(false);
    });
  });

  describe('WebhookLogger', () => {
    it('should log webhook delivery', async () => {
      const logger = new WebhookLogger();

      await logger.log({
        id: 'test-1',
        url: 'https://example.com/webhook',
        event: 'payment.confirmed',
        attempt: 1,
        success: true,
        statusCode: 200,
        responseTime: 150,
        timestamp: Date.now(),
        payload: {} as WebhookPayload,
      });

      const recent = await logger.getRecent(10);
      expect(recent).toHaveLength(1);
      expect(recent[0].id).toBe('test-1');
    });

    it('should track success rate', async () => {
      const logger = new WebhookLogger();
      const url = 'https://example.com/webhook';

      // Log 3 successful, 1 failed
      for (let i = 0; i < 3; i++) {
        await logger.log({
          id: `test-${i}`,
          url,
          event: 'payment.confirmed',
          attempt: 1,
          success: true,
          statusCode: 200,
          responseTime: 150,
          timestamp: Date.now(),
          payload: {} as WebhookPayload,
        });
      }

      await logger.log({
        id: 'test-fail',
        url,
        event: 'payment.confirmed',
        attempt: 1,
        success: false,
        error: 'Connection failed',
        responseTime: 5000,
        timestamp: Date.now(),
        payload: {} as WebhookPayload,
      });

      const successRate = await logger.getSuccessRate(url);
      expect(successRate).toBe(0.75); // 3/4
    });

    it('should calculate average response time', async () => {
      const logger = new WebhookLogger();
      const url = 'https://example.com/webhook';

      await logger.log({
        id: 'test-1',
        url,
        event: 'payment.confirmed',
        attempt: 1,
        success: true,
        statusCode: 200,
        responseTime: 100,
        timestamp: Date.now(),
        payload: {} as WebhookPayload,
      });

      await logger.log({
        id: 'test-2',
        url,
        event: 'payment.confirmed',
        attempt: 1,
        success: true,
        statusCode: 200,
        responseTime: 200,
        timestamp: Date.now(),
        payload: {} as WebhookPayload,
      });

      const avgTime = await logger.getAverageResponseTime(url);
      expect(avgTime).toBe(150); // (100 + 200) / 2
    });
  });

  describe('WebhookQueue', () => {
    it('should enqueue and dequeue webhooks', async () => {
      const queue = new InMemoryWebhookQueue();

      const webhook = createQueuedWebhook(
        {
          url: 'https://example.com/webhook',
          secret: 'test-secret',
        },
        {
          event: 'payment.confirmed',
          timestamp: Date.now(),
          payment: {
            signature: 'test-sig',
            amount: 1000000,
            amountUSD: 1.0,
            payer: 'payer',
            recipient: 'recipient',
            resource: '/api/test',
          },
        }
      );

      await queue.enqueue(webhook);

      const size = await queue.size();
      expect(size).toBe(1);

      const dequeued = await queue.dequeue();
      expect(dequeued).toBeDefined();
      expect(dequeued!.id).toBe(webhook.id);

      const sizeAfter = await queue.size();
      expect(sizeAfter).toBe(0);
    });

    it('should retry failed webhooks with exponential backoff', async () => {
      const queue = new InMemoryWebhookQueue();

      const webhook = createQueuedWebhook(
        {
          url: 'https://example.com/webhook',
          secret: 'test-secret',
          retry: {
            maxAttempts: 3,
            initialDelay: 100,
            backoff: 'exponential',
          },
        },
        {
          event: 'payment.confirmed',
          timestamp: Date.now(),
          payment: {
            signature: 'test-sig',
            amount: 1000000,
            amountUSD: 1.0,
            payer: 'payer',
            recipient: 'recipient',
            resource: '/api/test',
          },
        }
      );

      webhook.attempts = 1;

      await queue.retry(webhook, 'Connection failed');

      const all = queue.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].attempts).toBe(2);
      expect(all[0].lastError).toBe('Connection failed');
    });

    it('should not retry beyond max attempts', async () => {
      const queue = new InMemoryWebhookQueue();

      const webhook = createQueuedWebhook(
        {
          url: 'https://example.com/webhook',
          secret: 'test-secret',
          retry: {
            maxAttempts: 3,
          },
        },
        {
          event: 'payment.confirmed',
          timestamp: Date.now(),
          payment: {
            signature: 'test-sig',
            amount: 1000000,
            amountUSD: 1.0,
            payer: 'payer',
            recipient: 'recipient',
            resource: '/api/test',
          },
        }
      );

      webhook.attempts = 3; // Already at max

      await queue.retry(webhook, 'Connection failed');

      const size = await queue.size();
      expect(size).toBe(0); // Should not re-queue
    });
  });

  describe('WebhookManager', () => {
    it('should send webhook successfully', async () => {
      // Start mock server
      const server = new MockWebhookServer({
        port: 3001,
        secret: 'test-secret',
      });

      await server.start();

      try {
        const manager = new WebhookManager();

        const result = await manager.send(
          {
            url: server.getUrl(),
            secret: 'test-secret',
          },
          {
            event: 'payment.confirmed',
            timestamp: Date.now(),
            payment: {
              signature: 'test-sig',
              amount: 1000000,
              amountUSD: 1.0,
              payer: 'payer',
              recipient: 'recipient',
              resource: '/api/test',
            },
          }
        );

        expect(result.success).toBe(true);
        expect(result.statusCode).toBe(200);

        const received = server.getReceived();
        expect(received).toHaveLength(1);
        expect(received[0].event).toBe('payment.confirmed');

        await manager.close();
      } finally {
        await server.stop();
      }
    }, 10000);

    it('should filter by subscribed events', async () => {
      const manager = new WebhookManager();

      const result = await manager.send(
        {
          url: 'https://example.com/webhook',
          secret: 'test-secret',
          events: ['payment.failed'], // Only failed events
        },
        {
          event: 'payment.confirmed', // Sending confirmed
          timestamp: Date.now(),
          payment: {
            signature: 'test-sig',
            amount: 1000000,
            amountUSD: 1.0,
            payer: 'payer',
            recipient: 'recipient',
            resource: '/api/test',
          },
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Event not subscribed');

      await manager.close();
    });
  });
});