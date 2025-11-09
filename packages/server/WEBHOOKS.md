# Webhook System

The x402-solana-toolkit webhook system enables async payment notifications, allowing servers to notify clients when payments are confirmed without blocking HTTP responses.

## Overview

### Why Webhooks?

Payment verification on Solana takes 400-800ms on average. While the x402 protocol handles this synchronously, webhooks provide an alternative async notification pattern for:

- **Fire-and-forget payments**: Client sends payment and continues, server notifies later
- **Background processing**: Update databases, send emails, trigger workflows after payment
- **Decoupled architecture**: Separate payment verification from business logic
- **Retry resilience**: Automatic retries with exponential backoff if delivery fails

### Architecture

```
Payment Verified
    |
    v
Webhook Manager
    |
    +---> Webhook Sender (HTTP POST)
    |         |
    |         +---> HMAC Signature
    |         +---> Timeout (5s default)
    |         +---> Success: 2xx response
    |
    +---> Webhook Queue (if failed)
    |         |
    |         +---> Retry with exponential backoff
    |         +---> Max 3 attempts (configurable)
    |         +---> In-memory or Redis storage
    |
    +---> Webhook Logger
              |
              +---> Track all delivery attempts
              +---> Success/failure rates
              +---> Response times
```

## Quick Start

### Express

```typescript
import express from 'express';
import { X402Middleware } from '@x402-solana/server';

const app = express();
const x402 = new X402Middleware({
  solanaRpcUrl: 'https://api.devnet.solana.com',
  recipientWallet: 'YourWalletPublicKey...',
  network: 'devnet',
  webhook: {
    enabled: true, // Enable webhook manager
  },
});

// Route with webhook notification
app.get('/api/premium',
  x402.requirePayment(0.001, {
    description: 'Premium content',
    webhookUrl: 'https://your-app.com/webhooks/payment',
    webhookSecret: process.env.WEBHOOK_SECRET,
    webhookRetry: {
      maxAttempts: 3,
      initialDelay: 100,
      backoff: 'exponential',
    },
  }),
  (req, res) => {
    res.json({ data: 'premium content' });
  }
);

app.listen(3000);
```

### Standalone Usage

```typescript
import { WebhookManager } from '@x402-solana/server';

const manager = new WebhookManager({
  debug: true,
  redis: { url: process.env.REDIS_URL },
});

// Send webhook
await manager.sendWithRetry(
  {
    url: 'https://your-app.com/webhook',
    secret: 'your-secret',
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
      signature: 'tx_signature',
      amount: 1000000, // micro-USDC
      amountUSD: 1.0,
      payer: 'payer_wallet',
      recipient: 'recipient_wallet',
      resource: '/api/endpoint',
      blockTime: 1234567890,
      slot: 12345,
    },
  }
);

// Close manager
await manager.close();
```

## Webhook Payload

### Format

All webhooks are sent as HTTP POST with JSON body:

```json
{
  "event": "payment.confirmed",
  "timestamp": 1709123456789,
  "payment": {
    "signature": "5j7Xz...",
    "amount": 1000000,
    "amountUSD": 1.0,
    "payer": "8xKy...",
    "recipient": "9kLm...",
    "resource": "/api/premium",
    "blockTime": 1709123450,
    "slot": 254123456
  },
  "metadata": {
    "custom": "data"
  }
}
```

### Events

- `payment.confirmed` - Payment successfully verified
- `payment.failed` - Payment verification failed (future)

### Headers

```
POST /webhook HTTP/1.1
Host: your-app.com
Content-Type: application/json
X-Webhook-Signature: sha256=abc123...
X-Webhook-Timestamp: 1709123456789
User-Agent: x402-solana-webhook/1.0
```

## Security

### HMAC Signature Verification

All webhooks include an HMAC-SHA256 signature in the `X-Webhook-Signature` header.

**Format**: `sha256=<hex-encoded-signature>`

**Verify signatures** to ensure webhooks are from your server:

```typescript
import { verifyWebhookSignature } from '@x402-solana/server';

app.post('/webhooks/payment', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const secret = process.env.WEBHOOK_SECRET;

  // Verify signature
  if (!verifyWebhookSignature(req.body, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Process webhook
  const { event, payment } = req.body;
  console.log('Payment confirmed:', payment.signature);

  // Acknowledge receipt
  res.json({ received: true });
});
```

### Best Practices

1. **Always verify signatures** - Never trust unverified webhooks
2. **Use strong secrets** - Generate random 32+ character secrets
3. **Store secrets securely** - Use environment variables or secret managers
4. **Implement idempotency** - Handle duplicate deliveries (check payment signature)
5. **Respond quickly** - Return 200 within 5 seconds to avoid retries
6. **Log failures** - Monitor webhook delivery failures

## Retry Logic

### Exponential Backoff

Failed webhooks are automatically retried with exponential backoff:

```
Attempt 1: Immediate
Attempt 2: +100ms delay
Attempt 3: +200ms delay
Attempt 4: +400ms delay
Attempt 5: +800ms delay
...
Max delay: 60 seconds
```

### Configuration

```typescript
webhookRetry: {
  maxAttempts: 3,        // Max 3 attempts total
  initialDelay: 100,     // Start with 100ms
  maxDelay: 60000,       // Cap at 60 seconds
  backoff: 'exponential' // or 'linear'
}
```

### Success Criteria

A webhook delivery is considered successful if:
- HTTP response status code is 2xx (200-299)
- Response received within timeout (5s default)

All other responses trigger a retry.

## Queue Storage

### In-Memory (Default)

Fast but not persistent. Suitable for development and low-traffic production.

```typescript
const manager = new WebhookManager({
  // No redis config = in-memory queue
});
```

### Redis (Production)

Persistent queue for production. Survives server restarts.

```typescript
const manager = new WebhookManager({
  redis: {
    url: 'redis://localhost:6379',
    keyPrefix: 'x402:webhook:',
  },
});
```

**Install Redis client**:
```bash
npm install ioredis
```

## Webhook Receiver Example

### Express

```typescript
import express from 'express';
import { createWebhookReceiverEndpoint } from '@x402-solana/server';

const app = express();
app.use(express.json());

app.post('/webhooks/payment',
  createWebhookReceiverEndpoint(
    process.env.WEBHOOK_SECRET,
    async (payload) => {
      // Process webhook
      console.log('Payment confirmed:', payload.payment.signature);

      // Update database
      await db.payments.create({
        signature: payload.payment.signature,
        amount: payload.payment.amountUSD,
        payer: payload.payment.payer,
        timestamp: payload.timestamp,
      });

      // Send confirmation email
      await sendEmail(payload.payment.payer, 'Payment received');
    }
  )
);
```

### Custom Receiver

```typescript
import crypto from 'crypto';

app.post('/webhook', express.json(), (req, res) => {
  // 1. Verify signature
  const signature = req.headers['x-webhook-signature'];
  const secret = process.env.WEBHOOK_SECRET;

  const expected = 'sha256=' +
    crypto.createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 2. Check for duplicate (idempotency)
  const { payment } = req.body;
  if (await db.payments.exists(payment.signature)) {
    return res.json({ received: true, duplicate: true });
  }

  // 3. Process payment
  await processPayment(payment);

  // 4. Return 200 quickly (< 5s)
  res.json({ received: true });
});
```

## Testing

### Mock Webhook Server

```typescript
import { createMockWebhookServer } from '@x402-solana/server';

const server = createMockWebhookServer({
  port: 3001,
  secret: 'test-secret',
});

await server.start();

// Send webhook
const manager = new WebhookManager();
await manager.send(
  { url: server.getUrl(), secret: 'test-secret' },
  {
    event: 'payment.confirmed',
    timestamp: Date.now(),
    payment: { /* ... */ },
  }
);

// Check received
const webhooks = server.getReceived();
console.log('Received:', webhooks.length);

await server.stop();
```

### Test Endpoint

```typescript
import { createWebhookTestEndpoint } from '@x402-solana/server';

app.post('/test-webhook', createWebhookTestEndpoint());

// Test webhook delivery
const response = await fetch('http://localhost:3000/test-webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://your-app.com/webhook',
    secret: 'your-secret',
    payload: {
      event: 'payment.confirmed',
      timestamp: Date.now(),
      payment: { /* ... */ },
    },
    withRetry: true,
  }),
});

const result = await response.json();
console.log('Delivery result:', result);
```

## Monitoring

### Webhook Logger

```typescript
const manager = new WebhookManager({ debug: true });

// Get logger
const logger = manager.getLogger();

// Recent deliveries
const recent = await logger.getRecent(100);

// Deliveries for specific URL
const urlLogs = await logger.getByUrl('https://your-app.com/webhook', 50);

// Success rate
const successRate = await logger.getSuccessRate(
  'https://your-app.com/webhook',
  Date.now() - 86400000 // last 24h
);

// Average response time
const avgTime = await logger.getAverageResponseTime(
  'https://your-app.com/webhook'
);
```

### Metrics

Track these metrics for production:

- **Delivery success rate** - Target: > 99%
- **Average response time** - Target: < 1s
- **Retry rate** - Target: < 1%
- **Queue size** - Target: < 100

## Troubleshooting

### Webhook Not Received

1. **Check signature** - Verify secret matches on both sides
2. **Check URL** - Ensure webhook URL is accessible from server
3. **Check firewall** - Allow incoming connections from server IP
4. **Check logs** - Enable `debug: true` to see delivery attempts
5. **Check timeout** - Ensure receiver responds within 5 seconds

### Duplicate Webhooks

Webhooks may be delivered multiple times due to retries. Always implement idempotency:

```typescript
// Check if already processed
if (await db.payments.exists(payment.signature)) {
  return res.json({ received: true, duplicate: true });
}

// Process payment
await processPayment(payment);
```

### High Retry Rate

If many webhooks are retrying:

1. **Check receiver performance** - Must respond within 5s
2. **Check error responses** - Return 2xx for success
3. **Check network** - Ensure stable connection
4. **Increase timeout** - If needed (not recommended)

### Queue Growing

If queue size keeps growing:

1. **Check webhook URL** - Is it accessible?
2. **Check rate limits** - Are you hitting receiver limits?
3. **Check errors** - What errors are logged?
4. **Increase capacity** - Use Redis for larger queues

## Advanced Usage

### Custom Webhook Manager

```typescript
import { WebhookManager, WebhookLogger } from '@x402-solana/server';

// Custom logger
class DatabaseLogger extends WebhookLogger {
  async log(entry) {
    await db.webhookLogs.create(entry);
  }
}

// Create manager with custom logger
const manager = new WebhookManager({
  debug: true,
  redis: { url: process.env.REDIS_URL },
});

// Replace logger
const customLogger = new DatabaseLogger();
manager.logger = customLogger;
```

### Conditional Webhooks

```typescript
app.get('/api/premium',
  x402.requirePayment(0.001, {
    webhookUrl: req.query.webhook_url, // Dynamic webhook URL
    webhookSecret: await getWebhookSecret(req.user),
    webhookEvents: req.user.isPremium
      ? ['payment.confirmed', 'payment.failed']
      : ['payment.confirmed'],
  }),
  handler
);
```

### Webhook Filtering

```typescript
const manager = new WebhookManager();

// Only send for large payments
if (payment.amountUSD >= 10.0) {
  await manager.sendWithRetry(webhookConfig, payload);
}
```

## API Reference

### WebhookManager

```typescript
class WebhookManager {
  constructor(config?: WebhookManagerConfig);

  // Send webhook immediately (no retry)
  send(config: WebhookConfig, payload: WebhookPayload): Promise<WebhookDeliveryResult>;

  // Send with automatic retries
  sendWithRetry(config: WebhookConfig, payload: WebhookPayload): Promise<WebhookDeliveryResult>;

  // Send async (fire and forget)
  sendAsync(config: WebhookConfig, payload: WebhookPayload): void;

  // Get logger instance
  getLogger(): IWebhookLogger;

  // Get queue instance
  getQueue(): IWebhookQueue;

  // Close and cleanup
  close(): Promise<void>;
}
```

### WebhookConfig

```typescript
interface WebhookConfig {
  url: string;                    // Webhook URL
  secret: string;                 // HMAC secret
  events?: WebhookEvent[];        // Events to subscribe to
  retry?: WebhookRetryConfig;     // Retry configuration
  timeout?: number;               // Request timeout (ms)
  headers?: Record<string, string>; // Additional headers
}
```

### WebhookPayload

```typescript
interface WebhookPayload {
  event: 'payment.confirmed' | 'payment.failed';
  timestamp: number;              // Unix milliseconds
  payment: WebhookPaymentData;
  metadata?: Record<string, any>;
}
```

## See Also

- [Express Integration](../examples/express-webhook.ts)
- [NestJS Integration](../examples/nestjs-webhook.ts)
- [Fastify Integration](../examples/fastify-webhook.ts)
- [Testing Guide](./TESTING.md)
- [Security Best Practices](./SECURITY.md)