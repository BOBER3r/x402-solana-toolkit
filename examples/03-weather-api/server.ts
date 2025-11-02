/**
 * Weather API Example with Tiered Pricing
 *
 * This example demonstrates a realistic API with multiple pricing tiers:
 * - FREE: Current weather (basic data)
 * - $0.001: 7-day forecast (more data)
 * - $0.01: Historical data (premium data)
 */

import express from 'express';
import { X402Middleware } from '@x402-solana/server';
import dotenv from 'dotenv';

dotenv.config();

// Initialize x402 middleware
const x402 = new X402Middleware({
  solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  recipientWallet: process.env.RECIPIENT_WALLET!,
  network: 'devnet',
  debug: true,
});

const app = express();
app.use(express.json());

// ============================================================================
// Mock Weather Data (simulating external API)
// ============================================================================

interface WeatherData {
  location: string;
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
}

function getCurrentWeather(city: string): WeatherData {
  return {
    location: city,
    temperature: Math.round(15 + Math.random() * 15), // 15-30°C
    condition: ['Sunny', 'Cloudy', 'Rainy', 'Partly Cloudy'][Math.floor(Math.random() * 4)],
    humidity: Math.round(40 + Math.random() * 40), // 40-80%
    windSpeed: Math.round(5 + Math.random() * 15), // 5-20 km/h
  };
}

function get7DayForecast(city: string) {
  return Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    high: Math.round(18 + Math.random() * 12),
    low: Math.round(10 + Math.random() * 8),
    condition: ['Sunny', 'Cloudy', 'Rainy', 'Partly Cloudy'][Math.floor(Math.random() * 4)],
    precipitation: Math.round(Math.random() * 100),
  }));
}

function getHistoricalData(city: string, days: number = 30) {
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    avgTemp: Math.round(12 + Math.random() * 16),
    maxTemp: Math.round(18 + Math.random() * 12),
    minTemp: Math.round(8 + Math.random() * 8),
    precipitation: Math.round(Math.random() * 50),
    avgHumidity: Math.round(50 + Math.random() * 30),
  }));
}

// ============================================================================
// API Endpoints
// ============================================================================

// Info endpoint - show available endpoints and pricing
app.get('/api/info', (req, res) => {
  res.json({
    service: 'Weather API with x402 Micropayments',
    network: 'solana-devnet',
    endpoints: [
      {
        path: '/api/weather/current',
        price: 'FREE',
        description: 'Get current weather for a city',
        example: '/api/weather/current?city=London',
      },
      {
        path: '/api/weather/forecast',
        price: '$0.001 (0.1 cents)',
        description: 'Get 7-day weather forecast',
        example: '/api/weather/forecast?city=London',
      },
      {
        path: '/api/weather/historical',
        price: '$0.01 (1 cent)',
        description: 'Get 30-day historical weather data',
        example: '/api/weather/historical?city=London&days=30',
      },
    ],
    usage: {
      curl: 'curl "http://localhost:3000/api/weather/current?city=London"',
      client: 'npm run client',
    },
  });
});

// ============================================================================
// FREE TIER - Current Weather
// ============================================================================

app.get('/api/weather/current', (req, res) => {
  const city = req.query.city as string || 'London';
  const weather = getCurrentWeather(city);

  res.json({
    tier: 'free',
    data: weather,
    message: 'Current weather is free! Upgrade to forecast or historical for more data.',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// BASIC TIER - 7-Day Forecast ($0.001)
// ============================================================================

app.get('/api/weather/forecast',
  x402.requirePayment(0.001, {
    description: '7-day weather forecast',
    resource: '/api/weather/forecast',
  }),
  (req, res) => {
    const city = req.query.city as string || 'London';
    const forecast = get7DayForecast(city);

    res.json({
      tier: 'basic',
      price: '$0.001',
      data: {
        location: city,
        forecast,
      },
      payment: {
        paidBy: req.payment?.payer,
        amount: `$${req.payment?.amount}`,
        signature: req.payment?.signature,
      },
      timestamp: new Date().toISOString(),
    });
  }
);

// ============================================================================
// PREMIUM TIER - Historical Data ($0.01)
// ============================================================================

app.get('/api/weather/historical',
  x402.requirePayment(0.01, {
    description: 'Historical weather data (30 days)',
    resource: '/api/weather/historical',
  }),
  (req, res) => {
    const city = req.query.city as string || 'London';
    const days = Math.min(parseInt(req.query.days as string || '30'), 365);
    const historical = getHistoricalData(city, days);

    res.json({
      tier: 'premium',
      price: '$0.01',
      data: {
        location: city,
        period: `${days} days`,
        records: historical,
        summary: {
          avgTemperature: historical.reduce((sum, d) => sum + d.avgTemp, 0) / historical.length,
          totalPrecipitation: historical.reduce((sum, d) => sum + d.precipitation, 0),
          recordCount: historical.length,
        },
      },
      payment: {
        paidBy: req.payment?.payer,
        amount: `$${req.payment?.amount}`,
        signature: req.payment?.signature,
      },
      timestamp: new Date().toISOString(),
    });
  }
);

// ============================================================================
// Health check
// ============================================================================

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ============================================================================
// Start server
// ============================================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║              Weather API with Tiered Pricing                   ║
╚════════════════════════════════════════════════════════════════╝

Server running on: http://localhost:${PORT}

Pricing Tiers:
  FREE     → /api/weather/current      Current weather
  $0.001   → /api/weather/forecast     7-day forecast
  $0.01    → /api/weather/historical   30-day history

Examples:
  curl "http://localhost:${PORT}/api/weather/current?city=London"
  curl "http://localhost:${PORT}/api/weather/forecast?city=Paris"
  curl "http://localhost:${PORT}/api/weather/historical?city=Tokyo&days=30"

Or run the demo client:
  npm run client

Recipient wallet: ${process.env.RECIPIENT_WALLET}
Network: devnet
  `);
});
