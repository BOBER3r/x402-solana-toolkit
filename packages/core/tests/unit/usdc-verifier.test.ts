/**
 * Unit tests for USDC verifier
 */

import { verifyUSDCTransfer, isValidUSDCMint } from '../../src/verifier/usdc-verifier';
import { USDCTransfer } from '../../src/types/solana.types';

describe('USDC Verifier', () => {
  const devnetUSDCMint = 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr';
  const mainnetUSDCMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const recipientAccount = 'RecipientAccount11111111111111111111111111';
  const sourceAccount = 'SourceAccount1111111111111111111111111111';
  const authority = 'Authority11111111111111111111111111111111';

  describe('verifyUSDCTransfer', () => {
    it('should verify valid USDC transfer', () => {
      const transfers: USDCTransfer[] = [
        {
          source: sourceAccount,
          destination: recipientAccount,
          authority,
          amount: 1000, // 0.001 USDC
          mint: devnetUSDCMint,
        },
      ];

      const result = verifyUSDCTransfer(transfers, recipientAccount, 0.001, {
        network: 'devnet',
      });

      expect(result.valid).toBe(true);
      expect(result.transfer).toEqual(transfers[0]);
    });

    it('should allow overpayment by default', () => {
      const transfers: USDCTransfer[] = [
        {
          source: sourceAccount,
          destination: recipientAccount,
          authority,
          amount: 1100, // 0.0011 USDC (overpaid)
          mint: devnetUSDCMint,
        },
      ];

      const result = verifyUSDCTransfer(transfers, recipientAccount, 0.001, {
        network: 'devnet',
      });

      expect(result.valid).toBe(true);
    });

    it('should reject underpayment', () => {
      const transfers: USDCTransfer[] = [
        {
          source: sourceAccount,
          destination: recipientAccount,
          authority,
          amount: 900, // 0.0009 USDC (underpaid)
          mint: devnetUSDCMint,
        },
      ];

      const result = verifyUSDCTransfer(transfers, recipientAccount, 0.001, {
        network: 'devnet',
      });

      expect(result.valid).toBe(false);
      expect(result.code).toBe('INSUFFICIENT_AMOUNT');
    });

    it('should reject when no transfers found', () => {
      const transfers: USDCTransfer[] = [];

      const result = verifyUSDCTransfer(transfers, recipientAccount, 0.001);

      expect(result.valid).toBe(false);
      expect(result.code).toBe('NO_USDC_TRANSFER');
    });

    it('should reject wrong recipient', () => {
      const wrongRecipient = 'WrongRecipient111111111111111111111111111';
      const transfers: USDCTransfer[] = [
        {
          source: sourceAccount,
          destination: wrongRecipient,
          authority,
          amount: 1000,
          mint: devnetUSDCMint,
        },
      ];

      const result = verifyUSDCTransfer(transfers, recipientAccount, 0.001, {
        network: 'devnet',
      });

      expect(result.valid).toBe(false);
      expect(result.code).toBe('TRANSFER_MISMATCH');
    });

    it('should reject wrong token mint', () => {
      const wrongMint = 'WrongMint1111111111111111111111111111111111';
      const transfers: USDCTransfer[] = [
        {
          source: sourceAccount,
          destination: recipientAccount,
          authority,
          amount: 1000,
          mint: wrongMint,
        },
      ];

      const result = verifyUSDCTransfer(transfers, recipientAccount, 0.001, {
        network: 'devnet',
        strictMintCheck: true,
      });

      expect(result.valid).toBe(false);
      expect(result.code).toBe('INSUFFICIENT_AMOUNT'); // Falls through to amount check
    });

    it('should handle multiple transfers and find correct one', () => {
      const transfers: USDCTransfer[] = [
        {
          source: sourceAccount,
          destination: 'OtherAccount111111111111111111111111111',
          authority,
          amount: 500,
          mint: devnetUSDCMint,
        },
        {
          source: sourceAccount,
          destination: recipientAccount,
          authority,
          amount: 1000, // This is the correct one
          mint: devnetUSDCMint,
        },
        {
          source: sourceAccount,
          destination: 'AnotherAccount1111111111111111111111111',
          authority,
          amount: 2000,
          mint: devnetUSDCMint,
        },
      ];

      const result = verifyUSDCTransfer(transfers, recipientAccount, 0.001, {
        network: 'devnet',
      });

      expect(result.valid).toBe(true);
      expect(result.transfer?.amount).toBe(1000);
      expect(result.transfer?.destination).toBe(recipientAccount);
    });

    it('should include debug information on failure', () => {
      const transfers: USDCTransfer[] = [
        {
          source: sourceAccount,
          destination: 'WrongRecipient111111111111111111111111111',
          authority,
          amount: 1000,
          mint: devnetUSDCMint,
        },
      ];

      const result = verifyUSDCTransfer(transfers, recipientAccount, 0.001);

      expect(result.valid).toBe(false);
      expect(result.debug).toBeDefined();
      expect(result.debug?.expectedRecipient).toBe(recipientAccount);
      expect(result.debug?.expectedAmount).toBe(1000);
      expect(result.debug?.foundTransfers).toEqual(transfers);
    });

    it('should skip strict mint check when disabled', () => {
      const transfers: USDCTransfer[] = [
        {
          source: sourceAccount,
          destination: recipientAccount,
          authority,
          amount: 1000,
          mint: 'unknown', // Unknown mint
        },
      ];

      const result = verifyUSDCTransfer(transfers, recipientAccount, 0.001, {
        strictMintCheck: false,
      });

      expect(result.valid).toBe(true);
    });

    it('should handle mainnet USDC mint', () => {
      const transfers: USDCTransfer[] = [
        {
          source: sourceAccount,
          destination: recipientAccount,
          authority,
          amount: 1000,
          mint: mainnetUSDCMint,
        },
      ];

      const result = verifyUSDCTransfer(transfers, recipientAccount, 0.001, {
        network: 'mainnet-beta',
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('isValidUSDCMint', () => {
    it('should validate devnet USDC mint', () => {
      const transfer: USDCTransfer = {
        source: sourceAccount,
        destination: recipientAccount,
        authority,
        amount: 1000,
        mint: devnetUSDCMint,
      };

      expect(isValidUSDCMint(transfer, 'devnet')).toBe(true);
    });

    it('should validate mainnet USDC mint', () => {
      const transfer: USDCTransfer = {
        source: sourceAccount,
        destination: recipientAccount,
        authority,
        amount: 1000,
        mint: mainnetUSDCMint,
      };

      expect(isValidUSDCMint(transfer, 'mainnet-beta')).toBe(true);
    });

    it('should reject wrong mint', () => {
      const transfer: USDCTransfer = {
        source: sourceAccount,
        destination: recipientAccount,
        authority,
        amount: 1000,
        mint: 'WrongMint1111111111111111111111111111111111',
      };

      expect(isValidUSDCMint(transfer, 'devnet')).toBe(false);
    });

    it('should return false for unknown mint', () => {
      const transfer: USDCTransfer = {
        source: sourceAccount,
        destination: recipientAccount,
        authority,
        amount: 1000,
        mint: 'unknown',
      };

      expect(isValidUSDCMint(transfer, 'devnet')).toBe(false);
    });
  });
});
