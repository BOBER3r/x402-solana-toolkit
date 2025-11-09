/**
 * Webhook testing utilities
 *
 * Provides endpoints and helpers for testing webhook integrations
 */

import { Request, Response } from 'express';
import { WebhookManager } from './webhook-manager';
import { WebhookConfig, WebhookPayload } from './types';
import { verifyWebhookSignature } from './webhook-signer';

/**
 * Create webhook test endpoint handler
 *
 * This endpoint allows developers to test webhook deliveries
 *
 * @returns Express route handler
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { createWebhookTestEndpoint } from '@x402-solana/server';
 *
 * const app = express();
 * app.use(express.json());
 *
 * app.post('/test-webhook', createWebhookTestEndpoint());
 * ```
 */
export function createWebhookTestEndpoint() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { url, secret, payload, withRetry } = req.body;

      // Validate request
      if (!url || !secret || !payload) {
        res.status(400).json({
          error: 'Missing required fields',
          required: ['url', 'secret', 'payload'],
        });
        return;
      }

      // Create webhook config
      const config: WebhookConfig = {
        url,
        secret,
        retry: withRetry
          ? {
              maxAttempts: 3,
              initialDelay: 100,
              backoff: 'exponential',
            }
          : undefined,
      };

      // Create manager
      const manager = new WebhookManager({ debug: true });

      // Send webhook
      const result = withRetry
        ? await manager.sendWithRetry(config, payload)
        : await manager.send(config, payload);

      // Close manager
      await manager.close();

      // Return result
      res.json({
        success: result.success,
        statusCode: result.statusCode,
        error: result.error,
        responseTime: result.responseTime,
        attempts: result.attempts,
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Webhook test failed',
        message: error.message,
      });
    }
  };
}

/**
 * Create webhook receiver endpoint for testing
 *
 * This endpoint receives and validates webhook deliveries
 *
 * @param secret - Webhook secret for signature validation
 * @param onWebhook - Callback when webhook is received
 * @returns Express route handler
 *
 * @example
 * ```typescript
 * app.post('/webhooks/payment',
 *   createWebhookReceiverEndpoint(
 *     process.env.WEBHOOK_SECRET,
 *     (payload) => {
 *       console.log('Received webhook:', payload);
 *     }
 *   )
 * );
 * ```
 */
export function createWebhookReceiverEndpoint(
  secret: string,
  onWebhook?: (payload: WebhookPayload) => void | Promise<void>
) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      // Get signature from header
      const signature = req.headers['x-webhook-signature'] as string;

      if (!signature) {
        res.status(401).json({
          error: 'Missing X-Webhook-Signature header',
        });
        return;
      }

      // Verify signature
      const isValid = verifyWebhookSignature(req.body, signature, secret);

      if (!isValid) {
        res.status(401).json({
          error: 'Invalid webhook signature',
        });
        return;
      }

      // Get payload
      const payload: WebhookPayload = req.body;

      // Call callback
      if (onWebhook) {
        await onWebhook(payload);
      }

      // Return success
      res.json({
        received: true,
        event: payload.event,
        timestamp: payload.timestamp,
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Webhook processing failed',
        message: error.message,
      });
    }
  };
}

/**
 * Mock webhook server for testing
 *
 * Creates a simple HTTP server that receives webhooks
 */
export class MockWebhookServer {
  private server: any;
  private port: number;
  private receivedWebhooks: WebhookPayload[] = [];
  private secret: string;

  constructor(config: { port: number; secret: string }) {
    this.port = config.port;
    this.secret = config.secret;
  }

  /**
   * Start mock server
   */
  async start(): Promise<void> {
    const express = require('express');
    const app = express();
    app.use(express.json());

    // Webhook receiver endpoint
    app.post('/webhook', (req: Request, res: Response): void => {
      const signature = req.headers['x-webhook-signature'] as string;

      // Verify signature
      const isValid = verifyWebhookSignature(req.body, signature, this.secret);

      if (!isValid) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      // Store webhook
      this.receivedWebhooks.push(req.body);

      // Return success
      res.json({ received: true });
    });

    // Health check
    app.get('/health', (_req: Request, res: Response): void => {
      res.json({ status: 'ok', received: this.receivedWebhooks.length });
    });

    // Start server
    return new Promise((resolve) => {
      this.server = app.listen(this.port, () => {
        console.log(`[mock-webhook-server] Listening on port ${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop mock server
   */
  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('[mock-webhook-server] Stopped');
          resolve();
        });
      });
    }
  }

  /**
   * Get URL for webhook endpoint
   */
  getUrl(): string {
    return `http://localhost:${this.port}/webhook`;
  }

  /**
   * Get received webhooks
   */
  getReceived(): WebhookPayload[] {
    return [...this.receivedWebhooks];
  }

  /**
   * Clear received webhooks
   */
  clearReceived(): void {
    this.receivedWebhooks = [];
  }

  /**
   * Wait for webhook to be received
   *
   * @param timeout - Timeout in milliseconds
   * @returns Received webhook or null if timeout
   */
  async waitForWebhook(timeout: number = 5000): Promise<WebhookPayload | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (this.receivedWebhooks.length > 0) {
        return this.receivedWebhooks[this.receivedWebhooks.length - 1];
      }

      // Wait 100ms before checking again
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return null;
  }
}

/**
 * Create mock webhook server
 *
 * @param config - Server configuration
 * @returns Mock webhook server instance
 *
 * @example
 * ```typescript
 * const server = createMockWebhookServer({
 *   port: 3001,
 *   secret: 'test-secret',
 * });
 *
 * await server.start();
 *
 * // Send webhook
 * const manager = new WebhookManager();
 * await manager.send(
 *   { url: server.getUrl(), secret: 'test-secret' },
 *   payload
 * );
 *
 * // Check received
 * const webhooks = server.getReceived();
 * console.log('Received:', webhooks.length);
 *
 * await server.stop();
 * ```
 */
export function createMockWebhookServer(config: {
  port: number;
  secret: string;
}): MockWebhookServer {
  return new MockWebhookServer(config);
}