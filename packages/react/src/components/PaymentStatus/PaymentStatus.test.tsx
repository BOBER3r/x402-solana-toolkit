/**
 * Tests for PaymentStatus component
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { PaymentStatus } from './PaymentStatus';
import { useConnection } from '@solana/wallet-adapter-react';

// Mock the hooks
jest.mock('@solana/wallet-adapter-react');

const mockUseConnection = useConnection as jest.MockedFunction<typeof useConnection>;

describe('PaymentStatus', () => {
  const defaultProps = {
    signature: '5xJ7Q...',
    network: 'devnet' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default connection mock
    mockUseConnection.mockReturnValue({
      connection: {
        getSignatureStatus: jest.fn().mockResolvedValue({
          value: null,
        }),
        getTransaction: jest.fn(),
      } as any,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders with default props', () => {
    render(<PaymentStatus {...defaultProps} />);
    expect(screen.getByText(/Initiating/)).toBeInTheDocument();
  });

  it('shows confirming state while polling', async () => {
    mockUseConnection.mockReturnValue({
      connection: {
        getSignatureStatus: jest.fn().mockResolvedValue({
          value: { confirmationStatus: 'processed', err: null },
        }),
        getTransaction: jest.fn(),
      } as any,
    });

    render(<PaymentStatus {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Confirming/)).toBeInTheDocument();
    });
  });

  it('shows confirmed state when transaction is confirmed', async () => {
    const onConfirmed = jest.fn();
    mockUseConnection.mockReturnValue({
      connection: {
        getSignatureStatus: jest.fn().mockResolvedValue({
          value: { confirmationStatus: 'confirmed', err: null },
        }),
        getTransaction: jest.fn().mockResolvedValue({
          blockTime: 1234567890,
          slot: 123456,
        }),
      } as any,
    });

    render(<PaymentStatus {...defaultProps} onConfirmed={onConfirmed} />);

    await waitFor(() => {
      expect(screen.getByText(/Payment Confirmed/)).toBeInTheDocument();
      expect(onConfirmed).toHaveBeenCalledWith(defaultProps.signature);
    });
  });

  it('shows failed state when transaction fails', async () => {
    const onFailed = jest.fn();
    mockUseConnection.mockReturnValue({
      connection: {
        getSignatureStatus: jest.fn().mockResolvedValue({
          value: { confirmationStatus: null, err: { InstructionError: [0, 'Custom'] } },
        }),
        getTransaction: jest.fn(),
      } as any,
    });

    render(<PaymentStatus {...defaultProps} onFailed={onFailed} />);

    await waitFor(() => {
      expect(screen.getByText(/Payment Failed/)).toBeInTheDocument();
      expect(onFailed).toHaveBeenCalled();
    });
  });

  it('shows timeout state after max attempts', async () => {
    const onFailed = jest.fn();
    mockUseConnection.mockReturnValue({
      connection: {
        getSignatureStatus: jest.fn().mockResolvedValue({
          value: null,
        }),
        getTransaction: jest.fn(),
      } as any,
    });

    render(
      <PaymentStatus
        {...defaultProps}
        pollInterval={100}
        maxPollAttempts={3}
        onFailed={onFailed}
      />
    );

    // Fast-forward through all polling attempts
    for (let i = 0; i < 4; i++) {
      await waitFor(() => jest.advanceTimersByTime(100));
    }

    await waitFor(() => {
      expect(screen.getByText(/Timeout/)).toBeInTheDocument();
      expect(onFailed).toHaveBeenCalledWith(
        defaultProps.signature,
        'Transaction confirmation timeout'
      );
    });
  });

  it('shows explorer link when showExplorerLink is true', () => {
    render(<PaymentStatus {...defaultProps} showExplorerLink />);
    const link = screen.getByText('View on Explorer').closest('a');
    expect(link).toHaveAttribute(
      'href',
      `https://explorer.solana.com/tx/${defaultProps.signature}?cluster=devnet`
    );
  });

  it('hides details in compact mode', () => {
    render(<PaymentStatus {...defaultProps} compact />);
    expect(screen.queryByText(/Attempt/)).not.toBeInTheDocument();
  });

  it('shows transaction details when confirmed', async () => {
    mockUseConnection.mockReturnValue({
      connection: {
        getSignatureStatus: jest.fn().mockResolvedValue({
          value: { confirmationStatus: 'confirmed', err: null },
        }),
        getTransaction: jest.fn().mockResolvedValue({
          blockTime: 1234567890,
          slot: 123456,
        }),
      } as any,
    });

    render(<PaymentStatus {...defaultProps} showDetails />);

    await waitFor(() => {
      expect(screen.getByText(/Slot: 123,456/)).toBeInTheDocument();
    });
  });

  it('applies custom className', () => {
    const { container } = render(<PaymentStatus {...defaultProps} className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('uses mainnet-beta explorer URL', () => {
    render(<PaymentStatus {...defaultProps} network="mainnet-beta" showExplorerLink />);
    const link = screen.getByText('View on Explorer').closest('a');
    expect(link).toHaveAttribute(
      'href',
      `https://explorer.solana.com/tx/${defaultProps.signature}?cluster=mainnet-beta`
    );
  });
});