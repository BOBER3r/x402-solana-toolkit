/**
 * NestJS x402 API Example - API Controller
 * Shows how to use @RequirePayment decorator and @Payment parameter
 */

import { Controller, Get, UseGuards } from '@nestjs/common';
import { X402Guard, RequirePayment, Payment } from '@x402-solana/server';
import type { X402PaymentInfo } from '@x402-solana/server';

@Controller('api')
@UseGuards(X402Guard)
export class ApiController {
  /**
   * FREE endpoint - no payment required
   */
  @Get('hello')
  getHello() {
    return {
      message: 'Hello! This endpoint is free.',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * PAID endpoint - $0.001 required
   * Uses @Payment() decorator to inject payment info
   */
  @Get('premium')
  @RequirePayment(0.001, {
    description: 'Access to premium data',
    resource: '/api/premium',
  })
  getPremium(@Payment() payment: X402PaymentInfo) {
    return {
      message: 'Premium content! You paid for this.',
      tier: 'premium',
      paidBy: payment.payer,
      amount: `$${payment.amount}`,
      signature: payment.signature,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * PAID endpoint - $0.005 required
   * Higher tier pricing example
   */
  @Get('analytics')
  @RequirePayment(0.005, {
    description: 'Advanced analytics data',
    resource: '/api/analytics',
  })
  getAnalytics(@Payment() payment: X402PaymentInfo) {
    return {
      message: 'Analytics data access granted',
      tier: 'analytics',
      data: {
        totalUsers: 10543,
        activeNow: 234,
        growth: '+12.3%',
        revenue: '$45,678',
      },
      paidBy: payment.payer,
      amount: `$${payment.amount}`,
      signature: payment.signature,
      blockTime: payment.blockTime,
      slot: payment.slot,
      timestamp: new Date().toISOString(),
    };
  }
}
