import { describe, expect, it } from 'vitest';
import {
  calendarDateKey,
  calendarDayUtcRange,
  formatDateInTimezone,
  resolveEffectiveTimezone,
} from './timezone';

describe('timezone utilities', () => {
  it('uses the saved preference before the browser timezone', () => {
    expect(resolveEffectiveTimezone('Asia/Kolkata', 'America/New_York')).toBe('Asia/Kolkata');
  });

  it('falls back through browser timezone to UTC', () => {
    expect(resolveEffectiveTimezone(null, 'America/New_York')).toBe('America/New_York');
    expect(resolveEffectiveTimezone(null, '')).toBe('UTC');
  });

  it('derives and formats the calendar day in the selected timezone', () => {
    const instant = '2026-08-03T20:00:00Z';
    expect(calendarDateKey(instant, 'Asia/Kolkata')).toBe('2026-08-04');
    expect(formatDateInTimezone(instant, 'Asia/Kolkata')).toBe('4-Aug-2026');
  });

  it('converts a local calendar-day filter to its exact UTC range', () => {
    expect(calendarDayUtcRange('2026-08-04', 'Asia/Kolkata')).toEqual({
      from: '2026-08-03T18:30:00.000Z',
      to: '2026-08-04T18:29:59.999Z',
    });
  });

  it('respects daylight-saving day length when deriving filter boundaries', () => {
    expect(calendarDayUtcRange('2026-03-08', 'America/New_York')).toEqual({
      from: '2026-03-08T05:00:00.000Z',
      to: '2026-03-09T03:59:59.999Z',
    });
  });
});
