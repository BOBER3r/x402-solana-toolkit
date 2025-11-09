/**
 * Type definitions for PaymentButton component
 */

export interface PaymentButtonProps {
  /** Price in USD to charge */
  priceUSD: number;

  /** Description of the payment (optional) */
  description?: string;

  /** Resource identifier (optional) */
  resource?: string;

  /** Callback when payment succeeds */
  onSuccess?: (data: any) => void;

  /** Callback when payment fails */
  onError?: (error: Error) => void;

  /** Button style variant */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';

  /** Button size */
  size?: 'sm' | 'md' | 'lg';

  /** Disabled state */
  disabled?: boolean;

  /** Button content */
  children: React.ReactNode;

  /** Custom className */
  className?: string;

  /** Show price badge on button */
  showPrice?: boolean;

  /** Full width button */
  fullWidth?: boolean;

  /** Custom API endpoint to call */
  endpoint?: string;

  /** HTTP method for the request */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';

  /** Additional fetch options */
  fetchOptions?: RequestInit;
}