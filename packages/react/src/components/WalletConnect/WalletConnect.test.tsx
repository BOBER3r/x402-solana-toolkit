/**
 * Tests for WalletConnect component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WalletConnect } from './WalletConnect';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

// Mock the hooks
jest.mock('@solana/wallet-adapter-react');

const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;
const mockUseConnection = useConnection as jest.MockedFunction<typeof useConnection>;

describe('WalletConnect', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default connection mock
    mockUseConnection.mockReturnValue({
      connection: {
        rpcEndpoint: 'https://api.devnet.solana.com',
      } as any,
    });

    // Default wallet mock (not connected)
    mockUseWallet.mockReturnValue({
      connected: false,
      publicKey: null,
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
  });

  it('renders connect button when not connected', () => {
    render(<WalletConnect />);
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  it('shows connecting state', () => {
    mockUseWallet.mockReturnValue({
      connected: false,
      publicKey: null,
      connecting: true,
    } as any);

    render(<WalletConnect />);
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('calls connect when button is clicked', async () => {
    const mockConnect = jest.fn();
    mockUseWallet.mockReturnValue({
      connected: false,
      publicKey: null,
      connect: mockConnect,
      connecting: false,
    } as any);

    render(<WalletConnect />);

    const button = screen.getByText('Connect Wallet');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalled();
    });
  });

  it('shows wallet address when connected', () => {
    mockUseWallet.mockReturnValue({
      connected: true,
      publicKey: {
        toBase58: () => '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      },
      wallet: {
        adapter: { name: 'Phantom' },
      },
    } as any);

    render(<WalletConnect />);
    expect(screen.getByText(/5eyk...Kvdp/)).toBeInTheDocument();
  });

  it('shows dropdown when connected button is clicked', async () => {
    mockUseWallet.mockReturnValue({
      connected: true,
      publicKey: {
        toBase58: () => '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      },
      wallet: {
        adapter: { name: 'Phantom' },
      },
    } as any);

    render(<WalletConnect />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Phantom')).toBeInTheDocument();
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });
  });

  it('calls disconnect when disconnect is clicked', async () => {
    const mockDisconnect = jest.fn();
    mockUseWallet.mockReturnValue({
      connected: true,
      publicKey: {
        toBase58: () => '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      },
      wallet: {
        adapter: { name: 'Phantom' },
      },
      disconnect: mockDisconnect,
    } as any);

    render(<WalletConnect />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      const disconnectButton = screen.getByText('Disconnect');
      fireEvent.click(disconnectButton);
    });

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('shows network indicator when showNetwork is true', () => {
    mockUseWallet.mockReturnValue({
      connected: true,
      publicKey: {
        toBase58: () => '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      },
      wallet: {
        adapter: { name: 'Phantom' },
      },
    } as any);

    render(<WalletConnect showNetwork />);
    expect(screen.getByText('DEV')).toBeInTheDocument();
  });

  it('shows wrong network warning', () => {
    mockUseConnection.mockReturnValue({
      connection: {
        rpcEndpoint: 'https://api.mainnet-beta.solana.com',
      } as any,
    });

    mockUseWallet.mockReturnValue({
      connected: true,
      publicKey: {
        toBase58: () => '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      },
      wallet: {
        adapter: { name: 'Phantom' },
      },
    } as any);

    render(<WalletConnect requiredNetwork="devnet" />);
    expect(screen.getByText('Wrong Network')).toBeInTheDocument();
  });

  it('calls onConnect when wallet connects', () => {
    const onConnect = jest.fn();

    mockUseWallet.mockReturnValue({
      connected: true,
      publicKey: {
        toBase58: () => 'test-public-key',
      },
      wallet: {
        adapter: { name: 'Phantom' },
      },
    } as any);

    render(<WalletConnect onConnect={onConnect} />);

    expect(onConnect).toHaveBeenCalledWith('test-public-key');
  });

  it('renders different variants correctly', () => {
    const { rerender, container } = render(<WalletConnect variant="primary" />);
    expect(container.querySelector('.x402-wallet-connect-primary')).toBeInTheDocument();

    rerender(<WalletConnect variant="secondary" />);
    expect(container.querySelector('.x402-wallet-connect-secondary')).toBeInTheDocument();

    rerender(<WalletConnect variant="outline" />);
    expect(container.querySelector('.x402-wallet-connect-outline')).toBeInTheDocument();
  });

  it('renders in compact mode', () => {
    mockUseWallet.mockReturnValue({
      connected: true,
      publicKey: {
        toBase58: () => '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      },
      wallet: {
        adapter: { name: 'Phantom' },
      },
    } as any);

    render(<WalletConnect compact />);
    expect(screen.getByText('Phantom')).toBeInTheDocument();
  });

  it('uses custom labels', () => {
    render(
      <WalletConnect
        labels={{
          connect: 'Custom Connect',
        }}
      />
    );

    expect(screen.getByText('Custom Connect')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<WalletConnect className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('disables button when connecting', () => {
    mockUseWallet.mockReturnValue({
      connected: false,
      publicKey: null,
      connecting: true,
    } as any);

    render(<WalletConnect />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });
});