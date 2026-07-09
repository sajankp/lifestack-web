import { describe, expect, it } from 'vitest';
import { describeMedicationSchedule } from './medicationScheduleLabel';

describe('describeMedicationSchedule', () => {
  it('describes a simple daily schedule', () => {
    expect(describeMedicationSchedule({ frequency: 'daily', interval: 1, times: ['09:00'] })).toBe(
      'Every day, 09:00',
    );
  });

  it('describes every-N-days', () => {
    expect(describeMedicationSchedule({ frequency: 'daily', interval: 3, times: ['09:00'] })).toBe(
      'Every 3rd day, 09:00',
    );
  });

  it('describes weekly with multiple weekdays', () => {
    expect(
      describeMedicationSchedule({
        frequency: 'weekly',
        interval: 1,
        days_of_week: [0, 2, 4],
        times: ['09:00'],
      }),
    ).toBe('Every week on Mon, Wed, Fri, 09:00');
  });

  it('sorts weekdays regardless of input order', () => {
    expect(
      describeMedicationSchedule({
        frequency: 'weekly',
        interval: 1,
        days_of_week: [4, 0],
        times: ['09:00'],
      }),
    ).toBe('Every week on Mon, Fri, 09:00');
  });

  it('appends the end date when present', () => {
    expect(
      describeMedicationSchedule({
        frequency: 'weekly',
        interval: 1,
        days_of_week: [0],
        times: ['09:00'],
        end_date: '2026-08-15',
      }),
    ).toBe('Every week on Mon, 09:00 — until Aug 15');
  });

  it('joins multiple dose times', () => {
    expect(
      describeMedicationSchedule({ frequency: 'daily', interval: 1, times: ['09:00', '21:00'] }),
    ).toBe('Every day, 09:00, 21:00');
  });
});
