import { describe, expect, it } from 'vitest';
import {
  endOfLocalDayFromDateOnlyDueDate,
  isDateOnlyDueDate,
  startOfLocalDayFromDueDate,
} from './dueDate';

describe('isDateOnlyDueDate', () => {
  it('matches backend date-only timestamp and plain date', () => {
    expect(isDateOnlyDueDate('2026-07-17T00:00:00Z')).toBe(true);
    expect(isDateOnlyDueDate('2026-07-17')).toBe(true);
  });

  it('rejects invalid and time-specific values', () => {
    expect(isDateOnlyDueDate('2026-02-30')).toBe(false);
    expect(isDateOnlyDueDate('2026-07-17T00:00:00.000Z')).toBe(false);
    expect(isDateOnlyDueDate('2026-07-17T11:30:00Z')).toBe(false);
    expect(isDateOnlyDueDate('')).toBe(false);
  });
});

describe('startOfLocalDayFromDueDate', () => {
  it('uses calendar day from date-only UTC-midnight value', () => {
    const start = startOfLocalDayFromDueDate('2026-07-17T00:00:00Z');
    expect(start).not.toBeNull();
    expect(start?.getFullYear()).toBe(2026);
    expect(start?.getMonth()).toBe(6);
    expect(start?.getDate()).toBe(17);
    expect(start?.getHours()).toBe(0);
    expect(start?.getMinutes()).toBe(0);
  });

  it('returns null for invalid date values', () => {
    expect(startOfLocalDayFromDueDate('not-a-date')).toBeNull();
  });
});

describe('endOfLocalDayFromDateOnlyDueDate', () => {
  it('returns local 23:59:59.999 for date-only values', () => {
    const dueTime = endOfLocalDayFromDateOnlyDueDate('2026-07-17T00:00:00Z');
    expect(dueTime).not.toBeNull();

    const date = new Date(dueTime ?? 0);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(6);
    expect(date.getDate()).toBe(17);
    expect(date.getHours()).toBe(23);
    expect(date.getMinutes()).toBe(59);
    expect(date.getSeconds()).toBe(59);
    expect(date.getMilliseconds()).toBe(999);
  });

  it('returns null for invalid date-only values', () => {
    expect(endOfLocalDayFromDateOnlyDueDate('2026-02-30')).toBeNull();
  });
});
