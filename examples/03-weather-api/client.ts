/**
 * Weather API Client Example
 *
 * Demonstrates calling APIs with different pricing tiers:
 * - Free tier (no payment)
 * - Basic tier ($0.001)
 * - Premium tier ($0.01)
 */

import { X402Client } from '@x402-solana/client';
import dotenv from 'dotenv';

dotenv.config();

// Initialize x402 client
const client = new X402Client({
  solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  walletPrivateKey: process.env.WALLET_PRIVATE_KEY!,
  network: 'devnet',
});

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Helper to print weather data nicely
function printWeather(data: any, tier: string) {
  console.log(`\n   Tier: ${tier.toUpperCase()}`);

  if (data.data.temperature !== undefined) {
    // Current weather
    console.log(`   Location: ${data.data.location}`);
    console.log(`   Temperature: ${data.data.temperature}°C`);
    console.log(`   Condition: ${data.data.condition}`);
    console.log(`   Humidity: ${data.data.humidity}%`);
    console.log(`   Wind: ${data.data.windSpeed} km/h`);
  } else if (data.data.forecast) {
    // Forecast
    console.log(`   Location: ${data.data.location}`);
    console.log(`   Forecast (next 7 days):`);
    data.data.forecast.slice(0, 3).forEach((day: any) => {
      console.log(`     ${day.date}: ${day.high}°/${day.low}°C - ${day.condition}`);
    });
    console.log(`     ... and ${data.data.forecast.length - 3} more days`);
  } else if (data.data.records) {
    // Historical
    console.log(`   Location: ${data.data.location}`);
    console.log(`   Period: ${data.data.period}`);
    console.log(`   Average Temperature: ${data.data.summary.avgTemperature.toFixed(1)}°C`);
    console.log(`   Total Precipitation: ${data.data.summary.totalPrecipitation}mm`);
    console.log(`   Record Count: ${data.data.summary.recordCount}`);
  }

  if (data.payment) {
    console.log(`\n   Payment Info:`);
    console.log(`   - Amount: ${data.payment.amount}`);
    console.log(`   - Paid by: ${data.payment.paidBy.substring(0, 8)}...`);
    console.log(`   - Signature: ${data.payment.signature.substring(0, 16)}...`);
  }
}

async function demo() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║        Weather API Client - Tiered Pricing Demo               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const cities = ['London', 'Paris', 'Tokyo'];

  // ============================================================================
  // 1. FREE TIER - Current Weather
  // ============================================================================

  console.log('1. FREE TIER - Current Weather (no payment required)');
  console.log('   ================================================');

  for (const city of cities.slice(0, 2)) {
    console.log(`\n   Fetching current weather for ${city}...`);
    const response = await client.fetch(`${API_URL}/api/weather/current?city=${city}`);
    const data = await response.json();
    printWeather(data, 'free');
  }

  // ============================================================================
  // 2. BASIC TIER - 7-Day Forecast ($0.001)
  // ============================================================================

  console.log('\n\n2. BASIC TIER - 7-Day Forecast ($0.001)');
  console.log('   ======================================');
  console.log('   Making payment automatically...');

  const city1 = 'Paris';
  console.log(`\n   Fetching 7-day forecast for ${city1}...`);
  const forecastResponse = await client.fetch(`${API_URL}/api/weather/forecast?city=${city1}`);
  const forecastData = await forecastResponse.json();
  printWeather(forecastData, 'basic');

  // ============================================================================
  // 3. PREMIUM TIER - Historical Data ($0.01)
  // ============================================================================

  console.log('\n\n3. PREMIUM TIER - 30-Day Historical Data ($0.01)');
  console.log('   ===============================================');
  console.log('   Making payment automatically...');

  const city2 = 'Tokyo';
  console.log(`\n   Fetching 30-day history for ${city2}...`);
  const historicalResponse = await client.fetch(
    `${API_URL}/api/weather/historical?city=${city2}&days=30`
  );
  const historicalData = await historicalResponse.json();
  printWeather(historicalData, 'premium');

  // ============================================================================
  // Summary
  // ============================================================================

  console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                       Demo Complete!                           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('Summary:');
  console.log('  - Called FREE tier endpoints (no payment)');
  console.log('  - Paid $0.001 for forecast data');
  console.log('  - Paid $0.01 for historical data');
  console.log('  - Total spent: $0.011 (1.1 cents)');
  console.log('\nAll payments were handled automatically by x402!\n');
}

// Run demo
demo().catch((error) => {
  console.error('\nError running demo:', error.message);
  process.exit(1);
});
