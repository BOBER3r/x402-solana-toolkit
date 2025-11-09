/**
 * Tests for PriceTag component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { PriceTag } from './PriceTag';

describe('PriceTag', () => {
  it('renders with default props', () => {
    render(<PriceTag priceUSD={1.50} />);
    expect(screen.getByText(/1.500/)).toBeInTheDocument();
  });

  it('renders badge variant correctly', () => {
    const { container } = render(<PriceTag priceUSD={0.05} variant="badge" />);
    expect(container.querySelector('.x402-price-tag-badge')).toBeInTheDocument();
    expect(screen.getByText(/0.050/)).toBeInTheDocument();
  });

  it('renders inline variant correctly', () => {
    const { container } = render(<PriceTag priceUSD={2.00} variant="inline" />);
    expect(container.querySelector('.x402-price-tag-inline')).toBeInTheDocument();
    expect(screen.getByText(/2.000/)).toBeInTheDocument();
  });

  it('renders large variant correctly', () => {
    const { container } = render(<PriceTag priceUSD={10.00} variant="large" />);
    expect(container.querySelector('.x402-price-tag-large')).toBeInTheDocument();
    expect(screen.getByText(/10.000/)).toBeInTheDocument();
  });

  it('shows USD label when showUSD is true', () => {
    render(<PriceTag priceUSD={1.50} showUSD />);
    expect(screen.getByText(/USDC/)).toBeInTheDocument();
  });

  it('shows USDC micro units when showUSDC is true', () => {
    render(<PriceTag priceUSD={1.50} showUSDC />);
    expect(screen.getByText(/1,500,000 μUSDC/)).toBeInTheDocument();
  });

  it('formats price correctly', () => {
    render(<PriceTag priceUSD={0.123} />);
    expect(screen.getByText(/0.123/)).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<PriceTag priceUSD={1.00} className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('applies custom styles', () => {
    const { container } = render(
      <PriceTag priceUSD={1.00} style={{ color: 'red' }} />
    );
    const element = container.querySelector('.x402-price-tag');
    expect(element).toHaveStyle({ color: 'red' });
  });

  it('has correct aria-label', () => {
    render(<PriceTag priceUSD={1.50} />);
    expect(screen.getByLabelText('Price: 1.500 USDC')).toBeInTheDocument();
  });
});