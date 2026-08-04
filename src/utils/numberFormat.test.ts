import { describe, expect, it } from 'vitest';
import { formatCompactNumber, formatCurrency, formatNumber, formatQuantity } from './numberFormat';

describe('formatCurrency', () => {
  it('defaults to a deterministic en-US locale, not the browser implicit locale', () => {
    expect(formatCurrency(1234.5, 'USD')).toBe('$1,234.50');
  });

  it('applies Indian digit grouping when locale is en-IN', () => {
    expect(formatCurrency(1234567, 'INR', 'symbol', 'en-IN')).toBe('₹12,34,567.00');
  });

  it('honors an explicit decimal-places preference', () => {
    expect(formatCurrency(1234.5, 'INR', 'symbol', 'en-IN', 0)).toBe('₹1,235');
  });

  it('falls back gracefully for an invalid currency code', () => {
    expect(formatCurrency(10, 'NOTACURRENCY')).toBe('NOTACURRENCY 10.00');
    expect(formatCurrency(1234567, 'NOTACURRENCY', 'code', 'en-IN')).toBe(
      'NOTACURRENCY 12,34,567.00',
    );
  });
});

describe('formatNumber', () => {
  it('groups digits per locale without a currency symbol', () => {
    expect(formatNumber(1234567, 'en-IN')).toBe('12,34,567.00');
    expect(formatNumber(1234567, 'en-US')).toBe('1,234,567.00');
  });

  it('honors decimal-places', () => {
    expect(formatNumber(1234.5, 'en-US', 0)).toBe('1,235');
  });

  it('supports grouped variable-precision numbers', () => {
    expect(formatNumber(1234567.5, 'en-IN', 8, 0)).toBe('12,34,567.5');
  });
});

describe('formatQuantity', () => {
  it('uses the selected grouping while keeping useful fractional precision', () => {
    expect(formatQuantity(1234567.125, 8, 'en-IN')).toBe('12,34,567.125');
    expect(formatQuantity(1234567.125, 8, 'en-US')).toBe('1,234,567.125');
  });
});

describe('formatCompactNumber', () => {
  it('keeps chart labels compact while respecting locale-specific units', () => {
    expect(formatCompactNumber(1_200_000, 'en-US')).toBe('1.2M');
    expect(formatCompactNumber(1_200_000, 'en-IN')).toBe('12L');
  });
});
