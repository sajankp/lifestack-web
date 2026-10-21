import { describe, it, expect } from 'vitest';
import { monthValueToMonthStart, monthStartToMonthValue } from './format';

describe('monthValueToMonthStart', () => {
  it('widens a YYYY-MM month to the first day of that month', () => {
    // The API's budget start_month/end_month are `date` fields pinned to
    // the first of the month; the form works in YYYY-MM.
    expect(monthValueToMonthStart('2026-10')).toBe('2026-10-01');
    expect(monthValueToMonthStart('2026-01')).toBe('2026-01-01');
    expect(monthValueToMonthStart('2026-12')).toBe('2026-12-01');
  });

  it('returns undefined for a value that is not a YYYY-MM month', () => {
    expect(monthValueToMonthStart('')).toBeUndefined();
    expect(monthValueToMonthStart('2026-13')).toBeUndefined();
    expect(monthValueToMonthStart('not-a-month')).toBeUndefined();
    expect(monthValueToMonthStart('2026-10-01')).toBeUndefined();
  });

  it('round-trips with monthStartToMonthValue', () => {
    expect(monthStartToMonthValue(monthValueToMonthStart('2026-10')!)).toBe('2026-10');
  });
});
