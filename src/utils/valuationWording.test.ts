import { describe, it, expect } from 'vitest';
import { valuationNote } from './valuationWording';

// spec-113 §2.2: never show the raw status word ("estimated", "cost_basis_fallback", ...).

describe('valuationNote', () => {
  it('says some prices are estimates, with the date it was last updated', () => {
    expect(valuationNote('estimated', '2026-05-23')).toBe(
      'Some prices are estimates (updated 23-May-2026).',
    );
  });

  it('drops the date when there is none', () => {
    expect(valuationNote('estimated', null)).toBe('Some prices are estimates.');
    expect(valuationNote('estimated', undefined)).toBe('Some prices are estimates.');
    expect(valuationNote('estimated', 'not a date')).toBe('Some prices are estimates.');
  });

  it('explains the other degraded statuses in plain words', () => {
    expect(valuationNote('cost_basis_fallback', '2026-05-23')).toMatch(/shown at cost/i);
    expect(valuationNote('multi_currency_unconverted', null)).toMatch(/other currencies/i);
    expect(valuationNote('conversion_required', null)).toMatch(/other currencies/i);
  });

  it('is case-insensitive about the status', () => {
    expect(valuationNote('ESTIMATED', null)).toBe('Some prices are estimates.');
  });

  it.each(['current', 'empty', '', 'ok', 'single_currency_native', undefined, null])(
    'has nothing to say for %s',
    (status) => {
      expect(valuationNote(status as string | null | undefined, '2026-05-23')).toBeNull();
    },
  );
});
