/**
 * NestJS x402 API Example - Main Entry Point
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const PORT = process.env.PORT || 3000;
  await app.listen(PORT);

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                  NestJS x402 API Server                        ║
╚════════════════════════════════════════════════════════════════╝

Server running on: http://localhost:${PORT}

Endpoints:
  - GET /api/hello             [FREE]
  - GET /api/premium           [PAID: $0.001]
  - GET /api/analytics         [PAID: $0.005]

Recipient wallet: ${process.env.RECIPIENT_WALLET}
Network: devnet

Try it:
  1. Free:  curl http://localhost:${PORT}/api/hello
  2. Paid:  npm run client
  `);
}

bootstrap();
