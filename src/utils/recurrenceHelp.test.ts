import { describe, expect, it } from 'vitest';
import { describeRecurrenceHelp } from './recurrenceHelp';

describe('describeRecurrenceHelp', () => {
  const today = new Date(2026, 7, 18);

  it('explains the 15th-of-every-month selection and previews the next date', () => {
    expect(
      describeRecurrenceHelp({
        frequency: 'monthly',
        interval: 1,
        anchorDate: '2026-08-15',
        monthlyMode: 'day_of_month',
        today,
      }),
    ).toContain('Expected next due: 15-Sep-2026.');
  });

  it('explains last-day mode', () => {
    expect(
      describeRecurrenceHelp({
        frequency: 'monthly',
        interval: 1,
        anchorDate: '2026-08-01',
        monthlyMode: 'last_day',
        today,
      }),
    ).toContain('Expected next due: 31-Aug-2026.');
  });

  it('explains nth-weekday mode', () => {
    const help = describeRecurrenceHelp({
      frequency: 'monthly',
      interval: 1,
      anchorDate: '2026-08-01',
      monthlyMode: 'nth_weekday',
      byOrdinal: 1,
      byWeekday: 4,
      today,
    });

    expect(help).toContain('first Friday');
    expect(help).toContain('Expected next due: 4-Sep-2026.');
  });
});

