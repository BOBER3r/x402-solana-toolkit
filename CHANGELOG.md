# Changelog

All notable changes to x402-solana-toolkit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2025-01-02

### Added
- **[@x402-solana/core]** Comprehensive package README for npm registry with code examples and API reference
- **[@x402-solana/server]** Comprehensive package README for npm registry with framework integration guides
- **[@x402-solana/client]** Comprehensive package README for npm registry with MCP integration examples

### Fixed
- **[@x402-solana/client]** Fixed MCP protocol compatibility by changing debug logs from `console.log()` to `console.error()`
  - MCP protocol requires stdout for JSON-RPC only
  - Debug logs now correctly output to stderr
  - This allows `debug: true` to work in MCP server environments
  - Issue discovered during betting-analytics-mcp integration

## [0.1.0] - 2025-01-02

### Added
- **[@x402-solana/core]** Initial release with transaction verification and payment validation
  - TransactionVerifier for parsing Solana transactions
  - USDCVerifier for validating USDC transfers
  - PaymentCache for replay attack prevention
  - Support for both legacy and versioned transaction formats
  - 96 comprehensive unit tests

- **[@x402-solana/server]** Server-side middleware for Express, NestJS, and Fastify
  - X402Middleware for Express with `requirePayment()` method
  - NestJS guard and decorator support
  - Fastify plugin integration
  - Redis caching support for multi-instance deployments

- **[@x402-solana/client]** Auto-payment client SDK
  - X402Client with automatic 402 detection and payment
  - Drop-in replacement for native `fetch()`
  - Automatic USDC payment creation and confirmation
  - Retry logic with exponential backoff
  - Support for devnet and mainnet-beta

### Documentation
- Comprehensive GETTING_STARTED.md with setup instructions
- README.md with quick start examples
- EXAMPLES_OVERVIEW.md documenting all example projects
- PAYMENT_CHANNELS.md specification for future enhancement

### Examples
- 01-basic-api: Simple x402 integration example
- 02-solex-betting: Production-ready betting platform with AI agent
- 03-weather-api: Tiered pricing example

### Infrastructure
- Published to npm registry under @x402-solana scope
- Monorepo structure with workspace support
- TypeScript with strict mode
- Automated testing with Jest
- Continuous integration ready
