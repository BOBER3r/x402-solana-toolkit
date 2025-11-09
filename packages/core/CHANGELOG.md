# Changelog

All notable changes to `@x402-solana/core` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-11-10

### Added

####  Payment Channels Support
- **NEW: `scheme: 'channel'`** - Off-chain payment channel verification
- **ChannelPaymentVerifier** - Complete channel payment verification with 13 security checks
- **ChannelPayload** type for channel payment structure
- **createChannelPaymentHeader()** - Helper function to create channel X-PAYMENT headers
- **9 new error codes** for channel-specific validations:
  - `CHANNEL_NOT_FOUND`
  - `CHANNEL_NOT_OPEN`
  - `CHANNEL_INVALID_SIGNATURE`
  - `CHANNEL_INVALID_NONCE`
  - `CHANNEL_AMOUNT_BACKWARDS`
  - `CHANNEL_INSUFFICIENT_BALANCE`
  - `CHANNEL_CLAIM_EXPIRED`
  - `CHANNEL_WRONG_SERVER`
  - `CHANNEL_INVALID_PAYLOAD`

#### Features
- **Dual scheme support** in `TransactionVerifier.verifyX402Payment()`:
  - `scheme: 'exact'` - On-chain USDC transactions (existing)
  - `scheme: 'channel'` - Off-chain payment channels (new)
- **Ed25519 signature verification** for channel claims
- **109-byte message construction** following x402-channel-claim-v1 domain spec
- **Comprehensive validation**: status, nonce, amount, balance, expiry, server pubkey
- **Replay protection** via strictly increasing nonce
- **Credit limit support** for overdraft protection

#### API Extensions
- `ChannelState` interface for on-chain channel account structure
- `ChannelVerifierConfig` and `ChannelVerificationOptions` types
- Extended `PaymentPayload` with channel fields:
  - `channelId: string`
  - `amount: string`
  - `nonce: string`
  - `channelSignature: string`
  - `expiry?: string`

#### Documentation
- **CHANNEL_PAYMENTS.md** - Complete payment channel integration guide
- Updated **README.md** with channel payment examples
- Performance comparison tables
- Security guarantee documentation
- Implementation checklist

### Changed
- **TransactionVerifier.verifyX402Payment()** now accepts optional `channelProgramId` parameter
- **x402-parser** now validates both 'exact' and 'channel' payload schemas
- Enhanced error messages for better debugging

### Performance
- **<10ms verification** for channel payments (vs 400-800ms on-chain)
- **$0 transaction fees** (vs ~$0.0005 per on-chain payment)
- **99.7% cost reduction** for 1000+ payments

### Dependencies
- Added `tweetnacl` for Ed25519 signature verification
- No breaking changes to existing dependencies

### Notes
- Channel support requires a deployed Solana program (not included in core package)
- Users must implement `fetchChannelState()` based on their channel program structure
- Fully backward compatible with existing on-chain payment verification

---

## [0.2.0] - 2025-11-08

### Added
- x402 v1 protocol compliance
- Transaction verification for Solana USDC payments
- Payment requirements generation
- Replay attack prevention with Redis/in-memory cache
- Support for both legacy and versioned transactions
- Express, NestJS, Fastify integrations
- Comprehensive error handling
- 96 unit tests

### Features
- TransactionVerifier with RPC retry logic
- PaymentRequirementsGenerator for 402 responses
- PaymentCache for signature deduplication
- USDCVerifier for SPL token transfer validation
- Address validation utilities
- Transaction parsing utilities

---

## [0.1.0] - 2025-11-08

### Added
- Initial release
- Basic transaction verification
- USDC validation on Solana devnet

---

[0.3.0]: https://github.com/BOBER3r/x402-solana-toolkit/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/BOBER3r/x402-solana-toolkit/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/BOBER3r/x402-solana-toolkit/releases/tag/v0.1.0
