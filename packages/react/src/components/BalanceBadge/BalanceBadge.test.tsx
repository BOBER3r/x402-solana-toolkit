/**
 * Tests for BalanceBadge component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BalanceBadge } from './BalanceBadge';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletBalance } from '../../hooks/useWalletBalance';

// Mock the hooks
jest.mock('@solana/wallet-adapter-react');
jest.mock('../../hooks/useWalletBalance');

const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;
const mockUseWalletBalance = useWalletBalance as jest.MockedFunction<typeof useWalletBalance>;

describe('BalanceBadge', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default wallet mock (connected)
    mockUseWallet.mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'test-public-key' } as any,
      wallet: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      connecting: false,
      disconnecting: false,
      select: jest.fn(),
      wallets: [],
      signTransaction: undefined,
      signAllTransactions: undefined,
      signMessage: undefined,
      sendTransaction: jest.fn(),
    } as any);

    // Default balance hook mock
    mockUseWalletBalance.mockReturnValue({
      usdcBalance: 10.50,
      solBalance: 1.25,
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
  });

  it('renders with default props', () => {
    render(<BalanceBadge />);
    expect(screen.getByText('Balance')).toBeInTheDocument();
    expect(screen.getByText('1.2500')).toBeInTheDocument(); // SOL
    expect(screen.getByText('10.50')).toBeInTheDocument(); // USDC
  });

  it('shows only SOL when showUSDC is false', () => {
    render(<BalanceBadge showSOL showUSDC={false} />);
    expect(screen.getByText('SOL')).toBeInTheDocument();
    expect(screen.queryByText('USDC')).not.toBeInTheDocument();
  });

  it('shows only USDC when showSOL is false', () => {
    render(<BalanceBadge showSOL={false} showUSDC />);
    expect(screen.queryByText('SOL')).not.toBeInTheDocument();
    expect(screen.getByText('USDC')).toBeInTheDocument();
  });

  it('renders in compact mode', () => {
    render(<BalanceBadge compact />);
    expect(screen.queryByText('Balance')).not.toBeInTheDocument();
    expect(screen.getByText('1.2500')).toBeInTheDocument();
    expect(screen.getByText('10.50')).toBeInTheDocument();
  });

  it('shows low balance warning when below threshold', () => {
    mockUseWalletBalance.mockReturnValue({
      usdcBalance: 0.005,
      solBalance: 1.25,
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });

    const { container } = render(<BalanceBadge lowBalanceThreshold={0.01} />);
    expect(container.querySelector('.x402-balance-low')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('calls onLowBalance when balance is low', () => {
    mockUseWalletBalance.mockReturnValue({
      usdcBalance: 0.005,
      solBalance: 1.25,
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });

    const onLowBalance = jest.fn();
    render(<BalanceBadge lowBalanceThreshold={0.01} onLowBalance={onLowBalance} />);

    expect(onLowBalance).toHaveBeenCalledWith(0.005);
  });

  it('calls refresh when refresh button is clicked', () => {
    const mockRefresh = jest.fn();
    mockUseWalletBalance.mockReturnValue({
      usdcBalance: 10.50,
      solBalance: 1.25,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    });

    render(<BalanceBadge />);
    const refreshButton = screen.getByLabelText('Refresh balance');
    fireEvent.click(refreshButton);

    expect(mockRefresh).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    mockUseWalletBalance.mockReturnValue({
      usdcBalance: 10.50,
      solBalance: 1.25,
      isLoading: true,
      error: null,
      refresh: jest.fn(),
    });

    render(<BalanceBadge />);
    const loadingElements = screen.getAllByText('...');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('shows disconnected state when wallet not connected', () => {
    mockUseWallet.mockReturnValue({
      connected: false,
      publicKey: null,
    } as any);

    render(<BalanceBadge />);
    expect(screen.getByText('Wallet not connected')).toBeInTheDocument();
  });

  it('hides refresh button when showRefresh is false', () => {
    render(<BalanceBadge showRefresh={false} />);
    expect(screen.queryByLabelText('Refresh balance')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<BalanceBadge className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockUseWalletBalance.mockReturnValue({
      usdcBalance: 10.50,
      solBalance: 1.25,
      isLoading: false,
      error: new Error('RPC error'),
      refresh: jest.fn(),
    });

    render(<BalanceBadge />);
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('disables refresh button when loading', () => {
    mockUseWalletBalance.mockReturnValue({
      usdcBalance: 10.50,
      solBalance: 1.25,
      isLoading: true,
      error: null,
      refresh: jest.fn(),
    });

    render(<BalanceBadge />);
    const refreshButton = screen.getByLabelText('Refresh balance');
    expect(refreshButton).toBeDisabled();
  });
});