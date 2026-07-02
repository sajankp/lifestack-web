import { describe, it, expect } from 'vitest';

import { formatDate, formatDateTime, formatMonthYear } from './dateFormat';

describe('formatDateTime', () => {
  it('defaults to UTC calendar fields, matching formatDate behavior', () => {
    // 23:30 UTC on the 9th is still the 9th in UTC, but would roll to the 10th
    // in timezones ahead of UTC if formatted using local time instead.
    const value = '2027-06-09T23:30:00Z';
    expect(formatDateTime(value)).toBe(`${formatDate(value)} 23:30`);
  });

  it('formats using local time when utc: false is passed', () => {
    const date = new Date(2027, 5, 9, 14, 45, 0); // local time, no TZ conversion
    expect(formatDateTime(date, { utc: false })).toBe(`${formatDate(date, { utc: false })} 14:45`);
  });

  it('returns the fallback for null/undefined/empty values', () => {
    expect(formatDateTime(null)).toBe('-');
    expect(formatDateTime(undefined)).toBe('-');
    expect(formatDateTime('')).toBe('-');
    expect(formatDateTime(null, { fallback: 'N/A' })).toBe('N/A');
  });

  it('returns the fallback for invalid dates', () => {
    expect(formatDateTime('not-a-date')).toBe('-');
  });
});

describe('formatDate', () => {
  it('re-anchors to the UTC calendar date by default', () => {
    expect(formatDate('2027-01-01T00:00:00Z')).toBe('1-Jan-2027');
  });
});

describe('formatMonthYear', () => {
  it('formats using the short month/year format by default', () => {
    expect(formatMonthYear('2027-03-15T00:00:00Z')).toBe('Mar 2027');
  });
});
