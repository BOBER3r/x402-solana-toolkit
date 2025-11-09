/**
 * Tests for PaymentHistory component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentHistory } from './PaymentHistory';
import { usePaymentHistory } from '../../hooks/usePaymentHistory';

// Mock the hook
jest.mock('../../hooks/usePaymentHistory');

const mockUsePaymentHistory = usePaymentHistory as jest.MockedFunction<typeof usePaymentHistory>;

describe('PaymentHistory', () => {
  const mockHistory = [
    {
      id: '1',
      signature: 'sig1',
      url: '/api/test1',
      amount: 1.50,
      amountMicroUSDC: 1_500_000,
      timestamp: Date.now() - 1000,
      requirements: {} as any,
      status: 'confirmed' as const,
    },
    {
      id: '2',
      signature: 'sig2',
      url: '/api/test2',
      amount: 2.00,
      amountMicroUSDC: 2_000_000,
      timestamp: Date.now() - 2000,
      requirements: {} as any,
      status: 'pending' as const,
    },
    {
      id: '3',
      signature: 'sig3',
      url: '/api/test3',
      amount: 0.50,
      amountMicroUSDC: 500_000,
      timestamp: Date.now() - 3000,
      requirements: {} as any,
      status: 'failed' as const,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockUsePaymentHistory.mockReturnValue({
      history: mockHistory,
      addPayment: jest.fn(),
      updatePayment: jest.fn(),
      clear: jest.fn(),
      getPayment: jest.fn(),
      getPaymentsForUrl: jest.fn(),
      totalSpent: 1.50,
      successfulPayments: 1,
    });
  });

  it('renders with default props', () => {
    render(<PaymentHistory />);
    expect(screen.getByText('sig1'.slice(0, 8) + '...')).toBeInTheDocument();
  });

  it('shows empty state when no history', () => {
    mockUsePaymentHistory.mockReturnValue({
      history: [],
      addPayment: jest.fn(),
      updatePayment: jest.fn(),
      clear: jest.fn(),
      getPayment: jest.fn(),
      getPaymentsForUrl: jest.fn(),
      totalSpent: 0,
      successfulPayments: 0,
    });

    render(<PaymentHistory />);
    expect(screen.getByText('No payment history yet')).toBeInTheDocument();
  });

  it('displays summary statistics', () => {
    render(<PaymentHistory showSummary />);
    expect(screen.getByText('$1.500 USDC')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // successful payments
  });

  it('filters by status', () => {
    render(<PaymentHistory showFilters />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'confirmed' } });

    // Should only show confirmed transactions
    expect(screen.queryByText(/sig2/)).not.toBeInTheDocument();
  });

  it('calls onTransactionClick when row is clicked', () => {
    const onTransactionClick = jest.fn();
    render(<PaymentHistory onTransactionClick={onTransactionClick} />);

    const rows = screen.getAllByRole('row');
    fireEvent.click(rows[1]); // First data row (index 0 is header)

    expect(onTransactionClick).toHaveBeenCalledWith('sig1');
  });

  it('exports to CSV when export button is clicked', () => {
    // Mock URL.createObjectURL
    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();

    // Mock createElement and click
    const mockClick = jest.fn();
    const originalCreateElement = document.createElement;
    document.createElement = jest.fn((tag) => {
      const element = originalCreateElement.call(document, tag);
      if (tag === 'a') {
        element.click = mockClick;
      }
      return element;
    });

    render(<PaymentHistory exportable />);

    const exportButton = screen.getByText('Export CSV');
    fireEvent.click(exportButton);

    expect(mockClick).toHaveBeenCalled();

    // Restore
    document.createElement = originalCreateElement;
  });

  it('clears history when clear button is clicked', () => {
    const mockClear = jest.fn();
    mockUsePaymentHistory.mockReturnValue({
      history: mockHistory,
      addPayment: jest.fn(),
      updatePayment: jest.fn(),
      clear: mockClear,
      getPayment: jest.fn(),
      getPaymentsForUrl: jest.fn(),
      totalSpent: 1.50,
      successfulPayments: 1,
    });

    render(<PaymentHistory showFilters />);

    const clearButton = screen.getByText('Clear History');
    fireEvent.click(clearButton);

    expect(mockClear).toHaveBeenCalled();
  });

  it('renders in compact mode', () => {
    render(<PaymentHistory compact />);

    // Summary should not be shown in compact mode
    expect(screen.queryByText('Total Spent')).not.toBeInTheDocument();

    // Amount column should not be shown
    expect(screen.queryByText('Amount')).not.toBeInTheDocument();
  });

  it('shows pagination when enabled', () => {
    const longHistory = Array.from({ length: 25 }, (_, i) => ({
      id: `${i}`,
      signature: `sig${i}`,
      url: `/api/test${i}`,
      amount: 1.0,
      amountMicroUSDC: 1_000_000,
      timestamp: Date.now() - i * 1000,
      requirements: {} as any,
      status: 'confirmed' as const,
    }));

    mockUsePaymentHistory.mockReturnValue({
      history: longHistory,
      addPayment: jest.fn(),
      updatePayment: jest.fn(),
      clear: jest.fn(),
      getPayment: jest.fn(),
      getPaymentsForUrl: jest.fn(),
      totalSpent: 25.0,
      successfulPayments: 25,
    });

    render(<PaymentHistory showPagination itemsPerPage={10} />);

    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<PaymentHistory className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('uses correct network for explorer links', () => {
    render(<PaymentHistory network="mainnet-beta" />);

    const link = screen.getAllByRole('link')[0];
    expect(link).toHaveAttribute('href', expect.stringContaining('cluster=mainnet-beta'));
  });

  it('displays different status icons', () => {
    const { container } = render(<PaymentHistory />);

    // Should have icons for confirmed, pending, and failed
    expect(container.querySelector('.x402-check-icon')).toBeInTheDocument();
    expect(container.querySelector('.x402-spinner')).toBeInTheDocument();
    expect(container.querySelector('.x402-error-icon')).toBeInTheDocument();
  });
});