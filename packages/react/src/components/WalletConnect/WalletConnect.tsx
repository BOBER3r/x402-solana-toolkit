/**
 * WalletConnect component
 * Wallet connection button with network detection
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletConnectProps } from './types';
import { WalletIcon, WarningIcon, Spinner, CheckIcon } from '../shared';

/**
 * Helper function to safely check wallet connection
 * Prevents React 19 strict mode errors with wallet adapter proxy
 */
function getSafeWalletConnected(wallet: any): boolean {
  try {
    return wallet?.connected || false;
  } catch (err) {
    return false;
  }
}

/**
 * Helper function to safely get wallet public key
 * Prevents React 19 strict mode errors with wallet adapter proxy
 */
function getSafeWalletPublicKey(wallet: any): any {
  try {
    return wallet?.publicKey || null;
  } catch (err) {
    return null;
  }
}

/**
 * Component for wallet connection with network validation
 *
 * Provides a button for connecting/disconnecting wallets with
 * network detection and validation.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <WalletConnect />
 *
 * // With callbacks and network requirement
 * <WalletConnect
 *   requiredNetwork="devnet"
 *   onConnect={(pubkey) => console.log('Connected:', pubkey)}
 *   onDisconnect={() => console.log('Disconnected')}
 *   showNetwork
 * />
 *
 * // Compact mode
 * <WalletConnect compact variant="outline" />
 * ```
 */
export function WalletConnect({
  onConnect,
  onDisconnect,
  requiredNetwork,
  className = '',
  variant = 'primary',
  size = 'md',
  showNetwork = false,
  showWalletIcon = true,
  compact = false,
  labels = {},
}: WalletConnectProps) {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [showDropdown, setShowDropdown] = useState(false);

  const defaultLabels = {
    connect: 'Connect Wallet',
    disconnect: 'Disconnect',
    connecting: 'Connecting...',
    wrongNetwork: 'Wrong Network',
    ...labels,
  };

  // Detect network from connection endpoint
  const currentNetwork = useMemo(() => {
    const endpoint = connection.rpcEndpoint;
    return endpoint.includes('devnet') ? 'devnet' : 'mainnet-beta';
  }, [connection]);

  // Check if on wrong network
  const wrongNetwork = useMemo(() => {
    return requiredNetwork && currentNetwork !== requiredNetwork;
  }, [requiredNetwork, currentNetwork]);

  // Trigger callbacks on connection state change
  useEffect(() => {
    const isConnected = getSafeWalletConnected(wallet);
    const publicKey = getSafeWalletPublicKey(wallet);

    if (isConnected && publicKey) {
      onConnect?.(publicKey.toBase58());
    } else if (!isConnected) {
      onDisconnect?.();
    }
  }, [wallet, onConnect, onDisconnect]);

  const handleConnect = async () => {
    try {
      await wallet.connect();
    } catch (err) {
      console.error('Failed to connect wallet:', err);
    }
  };

  const handleDisconnect = async () => {
    try {
      await wallet.disconnect();
      setShowDropdown(false);
    } catch (err) {
      console.error('Failed to disconnect wallet:', err);
    }
  };

  // Size styles
  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: {
      padding: '6px 12px',
      fontSize: '14px',
      gap: '6px',
    },
    md: {
      padding: '10px 20px',
      fontSize: '16px',
      gap: '8px',
    },
    lg: {
      padding: '14px 28px',
      fontSize: '18px',
      gap: '10px',
    },
  };

  // Variant styles
  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: '#3b82f6',
      color: 'white',
      border: 'none',
    },
    secondary: {
      backgroundColor: '#6b7280',
      color: 'white',
      border: 'none',
    },
    outline: {
      backgroundColor: 'transparent',
      color: '#3b82f6',
      border: '2px solid #3b82f6',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: '#374151',
      border: 'none',
    },
  };

  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 500,
    borderRadius: '8px',
    cursor: wallet.connecting ? 'not-allowed' : 'pointer',
    opacity: wallet.connecting ? 0.5 : 1,
    transition: 'all 0.2s ease',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    position: 'relative',
    ...sizeStyles[size],
    ...variantStyles[variant],
  };

  const networkBadgeStyles: React.CSSProperties = {
    fontSize: '11px',
    padding: '2px 6px',
    borderRadius: '10px',
    backgroundColor: wrongNetwork ? '#fef2f2' : 'rgba(255, 255, 255, 0.2)',
    color: wrongNetwork ? '#dc2626' : 'white',
    border: wrongNetwork ? '1px solid #fecaca' : 'none',
    fontWeight: 600,
    textTransform: 'uppercase',
  };

  const dropdownStyles: React.CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    minWidth: '200px',
    zIndex: 1000,
  };

  const dropdownItemStyles: React.CSSProperties = {
    padding: '12px 16px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#374151',
    borderBottom: '1px solid #f3f4f6',
    transition: 'background-color 0.15s',
  };

  // Not connected
  const isConnected = getSafeWalletConnected(wallet);

  if (!isConnected) {
    return (
      <button
        onClick={handleConnect}
        disabled={wallet.connecting}
        className={`x402-wallet-connect x402-wallet-connect-${variant} ${className}`}
        style={baseStyles}
        type="button"
        aria-label="Connect wallet"
      >
        {wallet.connecting ? (
          <>
            <Spinner size={size === 'lg' ? 'md' : 'sm'} variant={variant === 'outline' || variant === 'ghost' ? 'primary' : 'white'} />
            <span>{defaultLabels.connecting}</span>
          </>
        ) : (
          <>
            {showWalletIcon && <WalletIcon size={size === 'lg' ? 24 : 20} color={variant === 'outline' || variant === 'ghost' ? '#3b82f6' : '#ffffff'} />}
            <span>{defaultLabels.connect}</span>
          </>
        )}
      </button>
    );
  }

  // Connected - show wallet info
  const publicKey = getSafeWalletPublicKey(wallet);
  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : '';

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`x402-wallet-connect x402-wallet-connect-connected ${className}`}
        style={baseStyles}
        type="button"
        aria-label="Wallet connected"
        aria-expanded={showDropdown}
      >
        {wrongNetwork ? (
          <>
            <WarningIcon size={size === 'lg' ? 24 : 20} color={variant === 'outline' || variant === 'ghost' ? '#f59e0b' : '#ffffff'} />
            <span>{defaultLabels.wrongNetwork}</span>
          </>
        ) : (
          <>
            {showWalletIcon && (
              compact ? (
                <CheckIcon size={size === 'lg' ? 24 : 20} color={variant === 'outline' || variant === 'ghost' ? '#10b981' : '#ffffff'} />
              ) : (
                <WalletIcon size={size === 'lg' ? 24 : 20} color={variant === 'outline' || variant === 'ghost' ? '#3b82f6' : '#ffffff'} />
              )
            )}
            <span>{compact ? wallet.wallet?.adapter.name || 'Connected' : shortAddress}</span>
            {showNetwork && !compact && (
              <span style={networkBadgeStyles}>
                {currentNetwork === 'devnet' ? 'DEV' : 'MAIN'}
              </span>
            )}
          </>
        )}
      </button>

      {showDropdown && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
            }}
            onClick={() => setShowDropdown(false)}
          />
          <div style={dropdownStyles}>
            <div
              style={{
                ...dropdownItemStyles,
                cursor: 'default',
                backgroundColor: '#f9fafb',
              }}
            >
              <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>
                Connected Wallet
              </div>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>
                {wallet.wallet?.adapter.name}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                {shortAddress}
              </div>
            </div>

            {showNetwork && (
              <div
                style={{
                  ...dropdownItemStyles,
                  cursor: 'default',
                }}
              >
                <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>
                  Network
                </div>
                <div style={{ fontWeight: 600, fontSize: '13px', textTransform: 'capitalize' }}>
                  {currentNetwork}
                </div>
                {wrongNetwork && (
                  <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>
                    Expected: {requiredNetwork}
                  </div>
                )}
              </div>
            )}

            <div
              style={{
                ...dropdownItemStyles,
                borderBottom: 'none',
                color: '#dc2626',
                fontWeight: 500,
              }}
              onClick={handleDisconnect}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#fef2f2';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {defaultLabels.disconnect}
            </div>
          </div>
        </>
      )}
    </div>
  );
}