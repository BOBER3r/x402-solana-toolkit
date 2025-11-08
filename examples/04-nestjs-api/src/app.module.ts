/**
 * NestJS x402 API Example - App Module
 * Configures x402 module and registers controllers
 */

import { Module } from '@nestjs/common';
import { X402Module } from '@x402-solana/server';
import { ApiController } from './api.controller';
import * as dotenv from 'dotenv';

dotenv.config();

@Module({
  imports: [
    X402Module.register({
      solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      recipientWallet: process.env.RECIPIENT_WALLET!,
      network: 'devnet',
      debug: true,
    }),
  ],
  controllers: [ApiController],
})
export class AppModule {}
