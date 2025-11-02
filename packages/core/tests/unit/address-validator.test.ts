/**
 * Unit tests for address validator utilities
 */

import {
  isValidSolanaAddress,
  isValidSignature,
  isUSDCMint,
  getUSDCMint,
  normalizeNetwork,
  extractNetworkFromX402,
  formatNetworkForX402,
  areAddressesEqual,
} from '../../src/utils/address-validator';
import { PublicKey } from '@solana/web3.js';

describe('Address Validator', () => {
  describe('isValidSolanaAddress', () => {
    it('should validate correct addresses', () => {
      expect(isValidSolanaAddress('11111111111111111111111111111111')).toBe(true);
      expect(isValidSolanaAddress('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')).toBe(true);
    });

    it('should reject invalid addresses', () => {
      expect(isValidSolanaAddress('invalid')).toBe(false);
      expect(isValidSolanaAddress('')).toBe(false);
      expect(isValidSolanaAddress('123')).toBe(false);
    });
  });

  describe('isValidSignature', () => {
    it('should validate correct signature format', () => {
      // 88 character base58 string
      const validSig = '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7';
      expect(isValidSignature(validSig)).toBe(true);
    });

    it('should reject invalid signature formats', () => {
      expect(isValidSignature('short')).toBe(false);
      expect(isValidSignature('')).toBe(false);
      expect(isValidSignature('0'.repeat(100))).toBe(false); // Invalid base58
    });

    it('should reject signatures with invalid characters', () => {
      const invalidChars = 'a'.repeat(87) + '@'; // Contains '@' which is not base58
      expect(isValidSignature(invalidChars)).toBe(false);
    });
  });

  describe('isUSDCMint', () => {
    it('should recognize devnet USDC mint', () => {
      expect(isUSDCMint('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr')).toBe(true);
      expect(isUSDCMint('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr', 'devnet')).toBe(true);
    });

    it('should recognize mainnet USDC mint', () => {
      expect(isUSDCMint('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')).toBe(true);
      expect(isUSDCMint('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'mainnet-beta')).toBe(true);
    });

    it('should reject non-USDC mints', () => {
      expect(isUSDCMint('11111111111111111111111111111111')).toBe(false);
      expect(isUSDCMint('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')).toBe(false);
    });

    it('should enforce network when specified', () => {
      const devnetMint = 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr';
      const mainnetMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

      expect(isUSDCMint(devnetMint, 'devnet')).toBe(true);
      expect(isUSDCMint(devnetMint, 'mainnet-beta')).toBe(false);
      expect(isUSDCMint(mainnetMint, 'mainnet-beta')).toBe(true);
      expect(isUSDCMint(mainnetMint, 'devnet')).toBe(false);
    });
  });

  describe('getUSDCMint', () => {
    it('should return correct mint for devnet', () => {
      expect(getUSDCMint('devnet')).toBe('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');
    });

    it('should return correct mint for mainnet', () => {
      expect(getUSDCMint('mainnet-beta')).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    });

    it('should throw for unsupported network', () => {
      expect(() => getUSDCMint('unsupported')).toThrow('Unsupported network');
    });
  });

  describe('normalizeNetwork', () => {
    it('should normalize mainnet variations', () => {
      expect(normalizeNetwork('mainnet')).toBe('mainnet-beta');
      expect(normalizeNetwork('mainnet-beta')).toBe('mainnet-beta');
      expect(normalizeNetwork('Mainnet')).toBe('mainnet-beta');
      expect(normalizeNetwork('MAINNET-BETA')).toBe('mainnet-beta');
    });

    it('should normalize devnet', () => {
      expect(normalizeNetwork('devnet')).toBe('devnet');
      expect(normalizeNetwork('Devnet')).toBe('devnet');
      expect(normalizeNetwork('DEVNET')).toBe('devnet');
    });

    it('should normalize testnet', () => {
      expect(normalizeNetwork('testnet')).toBe('testnet');
      expect(normalizeNetwork('Testnet')).toBe('testnet');
    });

    it('should normalize localnet', () => {
      expect(normalizeNetwork('localnet')).toBe('localnet');
      expect(normalizeNetwork('localhost')).toBe('localnet');
      expect(normalizeNetwork('Localnet')).toBe('localnet');
    });

    it('should handle whitespace', () => {
      expect(normalizeNetwork('  devnet  ')).toBe('devnet');
      expect(normalizeNetwork(' mainnet-beta ')).toBe('mainnet-beta');
    });
  });

  describe('extractNetworkFromX402', () => {
    it('should extract network from x402 format', () => {
      expect(extractNetworkFromX402('solana-devnet')).toBe('devnet');
      expect(extractNetworkFromX402('solana-mainnet-beta')).toBe('mainnet-beta');
      expect(extractNetworkFromX402('solana-testnet')).toBe('testnet');
    });

    it('should handle without prefix', () => {
      expect(extractNetworkFromX402('devnet')).toBe('devnet');
      expect(extractNetworkFromX402('mainnet')).toBe('mainnet-beta');
    });
  });

  describe('formatNetworkForX402', () => {
    it('should format network for x402 protocol', () => {
      expect(formatNetworkForX402('devnet')).toBe('solana-devnet');
      expect(formatNetworkForX402('mainnet-beta')).toBe('solana-mainnet-beta');
      expect(formatNetworkForX402('testnet')).toBe('solana-testnet');
    });

    it('should normalize before formatting', () => {
      expect(formatNetworkForX402('mainnet')).toBe('solana-mainnet-beta');
      expect(formatNetworkForX402('Devnet')).toBe('solana-devnet');
    });
  });

  describe('areAddressesEqual', () => {
    const addr1 = '11111111111111111111111111111111';
    const addr2 = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

    it('should compare string addresses', () => {
      expect(areAddressesEqual(addr1, addr1)).toBe(true);
      expect(areAddressesEqual(addr1, addr2)).toBe(false);
    });

    it('should compare PublicKey addresses', () => {
      const pk1 = new PublicKey(addr1);
      const pk2 = new PublicKey(addr1);
      const pk3 = new PublicKey(addr2);

      expect(areAddressesEqual(pk1, pk2)).toBe(true);
      expect(areAddressesEqual(pk1, pk3)).toBe(false);
    });

    it('should compare mixed string and PublicKey', () => {
      const pk1 = new PublicKey(addr1);

      expect(areAddressesEqual(addr1, pk1)).toBe(true);
      expect(areAddressesEqual(pk1, addr1)).toBe(true);
      expect(areAddressesEqual(addr2, pk1)).toBe(false);
    });
  });
});
