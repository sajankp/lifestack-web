import { describe, it, expect } from 'vitest';
import { valuationLine } from './format';

// spec-113 §2.2: one valuation line on Investments, derived from one ladder, so "Valuation status"
// and "Valuation as of … · estimated" can no longer disagree.

describe('valuationLine', () => {
  it('shows the as-of date when the valuation is current', () => {
    expect(
      valuationLine({
        summaryStatus: 'single_currency_native',
        performanceStatus: 'current',
        snapshotDate: '2026-05-24',
      }),
    ).toBe('Valuation as of 24-May-2026');
  });

  it('says some prices are estimates when the performance valuation is estimated', () => {
    expect(
      valuationLine({
        summaryStatus: 'single_currency_native',
        performanceStatus: 'estimated',
        snapshotDate: '2026-05-24',
      }),
    ).toBe('Some prices are estimates (updated 24-May-2026).');
  });

  it('cannot say "converted totals available" and "estimated" at once', () => {
    const line = valuationLine({
      summaryStatus: 'converted_available',
      performanceStatus: 'estimated',
      snapshotDate: '2026-05-24',
    });

    expect(line).toBe('Some prices are estimates (updated 24-May-2026).');
    expect(line).not.toMatch(/converted/i);
  });

  it.each(['multi_currency_unconverted', 'conversion_required'])(
    'puts the action to take first when %s, whatever the performance status',
    (summaryStatus) => {
      const line = valuationLine({
        summaryStatus,
        performanceStatus: 'estimated',
        snapshotDate: '2026-05-24',
      });

      expect(line).toMatch(/currenc/i);
      expect(line).not.toMatch(/estimate/i);
    },
  );

  it('says there is no data for an empty portfolio', () => {
    expect(
      valuationLine({ summaryStatus: 'empty', performanceStatus: 'empty', snapshotDate: '' }),
    ).toBe('No investing data yet.');
    expect(
      valuationLine({ summaryStatus: 'empty', performanceStatus: 'current', snapshotDate: '' }),
    ).toBe('No investing data yet.');
  });

  it('still shows the date when the performance status was not sent (defaults to empty)', () => {
    expect(
      valuationLine({
        summaryStatus: 'single_currency_native',
        performanceStatus: 'empty',
        snapshotDate: '2026-05-24',
      }),
    ).toBe('Valuation as of 24-May-2026');
  });

  it('says the date is unavailable while loading or when there is none', () => {
    expect(
      valuationLine({
        summaryStatus: undefined,
        performanceStatus: undefined,
        snapshotDate: undefined,
      }),
    ).toBe('Valuation date unavailable');
    expect(
      valuationLine({
        summaryStatus: 'single_currency_native',
        performanceStatus: 'current',
        snapshotDate: '',
      }),
    ).toBe('Valuation date unavailable');
  });
});
