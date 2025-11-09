/**
 * Tests for PaymentButton component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PaymentButton } from './PaymentButton';
import { useWallet } from '@solana/wallet-adapter-react';
import { useX402Payment } from '../../hooks/useX402Payment';

// Mock the hooks
jest.mock('@solana/wallet-adapter-react');
jest.mock('../../hooks/useX402Payment');

const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;
const mockUseX402Payment = useX402Payment as jest.MockedFunction<typeof useX402Payment>;

describe('PaymentButton', () => {
  const defaultProps = {
    priceUSD: 1.50,
    children: 'Pay Now',
    endpoint: '/api/test',
  };

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

    // Default payment hook mock
    mockUseX402Payment.mockReturnValue({
      fetch: jest.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
      isLoading: false,
      error: null,
      lastPaymentSignature: null,
      lastPaymentAmount: null,
      paymentHistory: [],
    });
  });

  it('renders with default props', () => {
    render(<PaymentButton {...defaultProps} />);
    expect(screen.getByText('Pay Now')).toBeInTheDocument();
    expect(screen.getByText(/1.500/)).toBeInTheDocument(); // Price badge
  });

  it('renders different variants correctly', () => {
    const { rerender, container } = render(<PaymentButton {...defaultProps} variant="primary" />);
    expect(container.querySelector('.x402-payment-button-primary')).toBeInTheDocument();

    rerender(<PaymentButton {...defaultProps} variant="secondary" />);
    expect(container.querySelector('.x402-payment-button-secondary')).toBeInTheDocument();

    rerender(<PaymentButton {...defaultProps} variant="outline" />);
    expect(container.querySelector('.x402-payment-button-outline')).toBeInTheDocument();
  });

  it('renders different sizes correctly', () => {
    const { rerender, container } = render(<PaymentButton {...defaultProps} size="sm" />);
    expect(container.querySelector('.x402-payment-button-sm')).toBeInTheDocument();

    rerender(<PaymentButton {...defaultProps} size="md" />);
    expect(container.querySelector('.x402-payment-button-md')).toBeInTheDocument();

    rerender(<PaymentButton {...defaultProps} size="lg" />);
    expect(container.querySelector('.x402-payment-button-lg')).toBeInTheDocument();
  });

  it('hides price when showPrice is false', () => {
    render(<PaymentButton {...defaultProps} showPrice={false} />);
    expect(screen.queryByText(/1.500/)).not.toBeInTheDocument();
  });

  it('shows error when wallet not connected', async () => {
    mockUseWallet.mockReturnValue({
      connected: false,
      publicKey: null,
    } as any);

    const onError = jest.fn();
    render(<PaymentButton {...defaultProps} onError={onError} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Please connect your wallet first',
      }));
    });
  });

  it('calls onSuccess when payment succeeds', async () => {
    const onSuccess = jest.fn();
    const mockFetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: 'test' }), { status: 200 })
    );

    mockUseX402Payment.mockReturnValue({
      fetch: mockFetch,
      isLoading: false,
      error: null,
      lastPaymentSignature: null,
      lastPaymentAmount: null,
      paymentHistory: [],
    });

    render(<PaymentButton {...defaultProps} onSuccess={onSuccess} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/test', expect.any(Object));
      expect(onSuccess).toHaveBeenCalledWith({ data: 'test' });
    });
  });

  it('calls onError when payment fails', async () => {
    const onError = jest.fn();
    const mockFetch = jest.fn().mockRejectedValue(new Error('Payment failed'));

    mockUseX402Payment.mockReturnValue({
      fetch: mockFetch,
      isLoading: false,
      error: null,
      lastPaymentSignature: null,
      lastPaymentAmount: null,
      paymentHistory: [],
    });

    render(<PaymentButton {...defaultProps} onError={onError} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Payment failed',
      }));
    });
  });

  it('disables button when disabled prop is true', () => {
    render(<PaymentButton {...defaultProps} disabled />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('disables button when loading', () => {
    mockUseX402Payment.mockReturnValue({
      fetch: jest.fn(),
      isLoading: true,
      error: null,
      lastPaymentSignature: null,
      lastPaymentAmount: null,
      paymentHistory: [],
    });

    render(<PaymentButton {...defaultProps} />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('applies custom className', () => {
    const { container } = render(<PaymentButton {...defaultProps} className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('renders full width when fullWidth prop is true', () => {
    const { container } = render(<PaymentButton {...defaultProps} fullWidth />);
    const button = container.querySelector('.x402-payment-button') as HTMLElement;
    expect(button.style.width).toBe('100%');
  });

  it('uses correct HTTP method', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    );

    mockUseX402Payment.mockReturnValue({
      fetch: mockFetch,
      isLoading: false,
      error: null,
      lastPaymentSignature: null,
      lastPaymentAmount: null,
      paymentHistory: [],
    });

    render(<PaymentButton {...defaultProps} method="POST" />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});