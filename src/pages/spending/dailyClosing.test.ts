import { describe, expect, it } from 'vitest';
import { dailyClosingEntryIds } from './dailyClosing';

const entry = (public_id: string, occurred_at: string) => ({ public_id, occurred_at });

describe('dailyClosingEntryIds', () => {
  it('marks only the newest entry in each effective-timezone day', () => {
    const entries = [
      entry('latest-aug-4', '2026-08-04T18:00:00Z'),
      entry('middle-aug-4', '2026-08-04T10:00:00Z'),
      entry('utc-aug-3-local-aug-4', '2026-08-03T20:00:00Z'),
      entry('latest-aug-3', '2026-08-03T17:00:00Z'),
    ];

    expect([...dailyClosingEntryIds(entries, undefined, 'Asia/Kolkata')]).toEqual([
      'latest-aug-4',
      'latest-aug-3',
    ]);
  });

  it('does not mark a page-boundary row when a newer entry shares its day', () => {
    const previous = entry('previous-page', '2026-08-04T18:00:00Z');
    const entries = [entry('first-current-page', '2026-08-04T10:00:00Z')];

    expect(dailyClosingEntryIds(entries, previous, 'Asia/Kolkata').size).toBe(0);
  });

  it('marks a page-boundary row when the preceding entry is from another day', () => {
    const previous = entry('previous-page', '2026-08-04T10:00:00Z');
    const entries = [entry('first-current-page', '2026-08-03T17:00:00Z')];

    expect([...dailyClosingEntryIds(entries, previous, 'Asia/Kolkata')]).toEqual([
      'first-current-page',
    ]);
  });
});
