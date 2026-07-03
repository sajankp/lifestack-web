import { describe, expect, it } from 'vitest';
import { describeRecurrence } from './recurrenceLabel';

describe('describeRecurrence', () => {
  it('describes simple daily/weekly/yearly cadences', () => {
    expect(describeRecurrence({ frequency: 'daily', interval: 1 })).toBe('Every day');
    expect(describeRecurrence({ frequency: 'weekly', interval: 2 })).toBe('Every 2nd week');
    expect(describeRecurrence({ frequency: 'yearly', interval: 1 })).toBe('Every year');
  });

  it('describes day-of-month monthly recurrence with no special mode', () => {
    expect(describeRecurrence({ frequency: 'monthly', interval: 1, monthly_mode: 'day_of_month' })).toBe(
      'Every month',
    );
  });

  it('describes last-day-of-month recurrence', () => {
    expect(describeRecurrence({ frequency: 'monthly', interval: 1, monthly_mode: 'last_day' })).toBe(
      'Every month on the last day',
    );
  });

  it('describes nth-weekday recurrence with interval composition', () => {
    expect(
      describeRecurrence({
        frequency: 'monthly',
        interval: 2,
        monthly_mode: 'nth_weekday',
        by_weekday: 4,
        by_ordinal: 1,
      }),
    ).toBe('Every 2nd month on the first Friday');
  });

  it('describes the last-weekday-of-month case', () => {
    expect(
      describeRecurrence({
        frequency: 'monthly',
        interval: 1,
        monthly_mode: 'nth_weekday',
        by_weekday: 6,
        by_ordinal: -1,
      }),
    ).toBe('Every month on the last Sunday');
  });
});
