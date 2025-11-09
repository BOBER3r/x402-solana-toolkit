/**
 * Webhook HMAC signature generation and verification
 *
 * Implements secure webhook signing using HMAC-SHA256
 */

import crypto from 'crypto';
import { IWebhookSigner } from './types';

/**
 * Webhook signer for HMAC-SHA256 signatures
 *
 * @example
 * ```typescript
 * const signer = new WebhookSigner();
 * const signature = signer.sign(payload, 'secret');
 * console.log(signature); // "sha256=abc123..."
 *
 * const isValid = signer.verify(payload, signature, 'secret');
 * console.log(isValid); // true
 * ```
 */
export class WebhookSigner implements IWebhookSigner {
  /**
   * Generate HMAC-SHA256 signature for payload
   *
   * @param payload - Data to sign (will be JSON stringified)
   * @param secret - Secret key for HMAC
   * @returns Signature in format "sha256=<hex>"
   */
  sign(payload: any, secret: string): string {
    if (!secret || secret.length === 0) {
      throw new Error('Webhook secret is required for signing');
    }

    // Serialize payload to consistent JSON string
    const data = JSON.stringify(payload);

    // Generate HMAC-SHA256
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(data);
    const signature = hmac.digest('hex');

    return `sha256=${signature}`;
  }

  /**
   * Verify HMAC-SHA256 signature
   *
   * Uses timing-safe comparison to prevent timing attacks
   *
   * @param payload - Original payload
   * @param signature - Signature to verify (format: "sha256=<hex>")
   * @param secret - Secret key for HMAC
   * @returns True if signature is valid
   */
  verify(payload: any, signature: string, secret: string): boolean {
    if (!signature || !secret) {
      return false;
    }

    try {
      // Generate expected signature
      const expected = this.sign(payload, secret);

      // Use timing-safe comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
      );
    } catch (error) {
      // Comparison failed (likely due to length mismatch)
      return false;
    }
  }

  /**
   * Extract signature from header value
   *
   * @param header - X-Webhook-Signature header value
   * @returns Signature or null if invalid
   */
  static extractSignature(header: string | undefined): string | null {
    if (!header) {
      return null;
    }

    // Support both "sha256=..." and raw hex formats
    if (header.startsWith('sha256=')) {
      return header;
    }

    // If raw hex, convert to expected format
    if (/^[a-f0-9]{64}$/i.test(header)) {
      return `sha256=${header}`;
    }

    return null;
  }

  /**
   * Generate signature for webhook request headers
   *
   * @param payload - Webhook payload
   * @param secret - Webhook secret
   * @returns Headers object with signature
   */
  static generateHeaders(payload: any, secret: string): Record<string, string> {
    const signer = new WebhookSigner();
    const signature = signer.sign(payload, secret);

    return {
      'X-Webhook-Signature': signature,
      'X-Webhook-Timestamp': Date.now().toString(),
      'Content-Type': 'application/json',
    };
  }
}

/**
 * Verify webhook signature from request
 *
 * @param payload - Request body payload
 * @param signature - X-Webhook-Signature header value
 * @param secret - Webhook secret
 * @returns True if signature is valid
 *
 * @example
 * ```typescript
 * // Express middleware
 * app.post('/webhook', (req, res) => {
 *   const signature = req.headers['x-webhook-signature'];
 *   const isValid = verifyWebhookSignature(req.body, signature, SECRET);
 *
 *   if (!isValid) {
 *     return res.status(401).json({ error: 'Invalid signature' });
 *   }
 *
 *   // Process webhook
 *   res.json({ received: true });
 * });
 * ```
 */
export function verifyWebhookSignature(
  payload: any,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature) {
    return false;
  }

  const extractedSignature = WebhookSigner.extractSignature(signature);
  if (!extractedSignature) {
    return false;
  }

  const signer = new WebhookSigner();
  return signer.verify(payload, extractedSignature, secret);
}