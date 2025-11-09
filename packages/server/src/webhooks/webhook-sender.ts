/**
 * Webhook HTTP sender
 *
 * Handles HTTP POST requests to webhook endpoints with timeout and error handling
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import {
  IWebhookSender,
  WebhookPayload,
  WebhookDeliveryResult,
  WebhookSendOptions,
} from './types';

/**
 * Webhook sender for HTTP POST requests
 *
 * @example
 * ```typescript
 * const sender = new WebhookSender();
 * const result = await sender.send(
 *   'https://example.com/webhook',
 *   payload,
 *   'sha256=abc123...',
 *   { timeout: 5000 }
 * );
 *
 * if (result.success) {
 *   console.log('Webhook delivered in', result.responseTime, 'ms');
 * } else {
 *   console.error('Webhook failed:', result.error);
 * }
 * ```
 */
export class WebhookSender implements IWebhookSender {
  private readonly defaultTimeout: number;
  private readonly debug: boolean;

  constructor(config?: { defaultTimeout?: number; debug?: boolean }) {
    this.defaultTimeout = config?.defaultTimeout || 5000;
    this.debug = config?.debug || false;
  }

  /**
   * Send webhook HTTP POST request
   *
   * @param url - Webhook URL
   * @param payload - Webhook payload
   * @param signature - HMAC signature
   * @param options - Send options
   * @returns Delivery result
   */
  async send(
    url: string,
    payload: WebhookPayload,
    signature: string,
    options?: WebhookSendOptions
  ): Promise<WebhookDeliveryResult> {
    const startTime = Date.now();
    const timeout = options?.timeout || this.defaultTimeout;

    try {
      // Parse URL
      const parsedUrl = new URL(url);

      // Prepare request body
      const body = JSON.stringify(payload);

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body).toString(),
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': Date.now().toString(),
        'User-Agent': 'x402-solana-webhook/1.0',
        ...options?.headers,
      };

      if (this.debug) {
        console.log('[webhook] Sending to:', url);
        console.log('[webhook] Headers:', headers);
      }

      // Send request
      const statusCode = await this.sendRequest(
        parsedUrl,
        body,
        headers,
        timeout,
        options?.followRedirects
      );

      const responseTime = Date.now() - startTime;

      // Check if status code indicates success (2xx)
      const success = statusCode >= 200 && statusCode < 300;

      if (this.debug) {
        console.log('[webhook] Response:', {
          statusCode,
          success,
          responseTime,
        });
      }

      return {
        success,
        statusCode,
        responseTime,
        attempts: 1,
        url,
        event: payload.event,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      if (this.debug) {
        console.error('[webhook] Send failed:', error.message);
      }

      return {
        success: false,
        error: error.message || 'Unknown error',
        responseTime,
        attempts: 1,
        url,
        event: payload.event,
      };
    }
  }

  /**
   * Send HTTP request using native Node.js modules
   *
   * @param url - Parsed URL
   * @param body - Request body
   * @param headers - Request headers
   * @param timeout - Timeout in milliseconds
   * @param followRedirects - Whether to follow redirects
   * @returns HTTP status code
   */
  private sendRequest(
    url: URL,
    body: string,
    headers: Record<string, string>,
    timeout: number,
    followRedirects?: boolean
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      // Choose http or https
      const client = url.protocol === 'https:' ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers,
        timeout,
      };

      const req = client.request(options, (res) => {
        // Consume response data (we don't need it, but must drain stream)
        res.on('data', () => {});

        res.on('end', () => {
          const statusCode = res.statusCode || 0;

          // Handle redirects
          if (
            followRedirects &&
            statusCode >= 300 &&
            statusCode < 400 &&
            res.headers.location
          ) {
            const redirectUrl = new URL(
              res.headers.location,
              `${url.protocol}//${url.host}`
            );
            this.sendRequest(redirectUrl, body, headers, timeout, true)
              .then(resolve)
              .catch(reject);
            return;
          }

          resolve(statusCode);
        });
      });

      // Handle errors
      req.on('error', (error) => {
        reject(error);
      });

      // Handle timeout
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${timeout}ms`));
      });

      // Send body
      req.write(body);
      req.end();
    });
  }
}

/**
 * Send webhook with automatic signature generation
 *
 * @param url - Webhook URL
 * @param payload - Webhook payload
 * @param secret - Webhook secret
 * @param options - Send options
 * @returns Delivery result
 *
 * @example
 * ```typescript
 * const result = await sendWebhook(
 *   'https://example.com/webhook',
 *   {
 *     event: 'payment.confirmed',
 *     timestamp: Date.now(),
 *     payment: { ... },
 *   },
 *   'my-secret',
 *   { timeout: 5000 }
 * );
 * ```
 */
export async function sendWebhook(
  url: string,
  payload: WebhookPayload,
  secret: string,
  options?: WebhookSendOptions
): Promise<WebhookDeliveryResult> {
  const { WebhookSigner } = await import('./webhook-signer');
  const signer = new WebhookSigner();
  const signature = signer.sign(payload, secret);

  const sender = new WebhookSender();
  return sender.send(url, payload, signature, options);
}
