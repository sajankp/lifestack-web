import { describe, expect, it } from 'vitest';
import {
  SaleSimulationSchema,
  TaxDatesResponseSchema,
  TaxOpportunitiesResponseSchema,
} from './taxPlanning';
import { InstrumentSchema, TaxSummarySchema } from './investing';

// Payloads below are the shapes the API tests pin (test_tax_opportunities_rest.py,
// test_tax_dates_rest.py, test_elss_lock_in_rest.py), so a rename on either side breaks here.

describe('opportunities payload', () => {
  const payload = {
    status: 'success',
    as_of: '2026-11-28',
    fy: '2026-27',
    total_saves_this_fy_inr: '2288.00',
    opportunities: [
      {
        kind: 'wait_for_long_term',
        timing: 'this_fy',
        saves_inr: '2080.00',
        symbol: 'INFY',
        headline: 'Hold INFY until 16 Dec 2026',
        detail: 'Waiting saves about ₹2,080.00.',
        wait_until: '2026-12-16',
        days_to_long_term: 18,
        tax_if_sold_today_inr: '2080.00',
        tax_if_sold_on_date_inr: '0.00',
        act_by: '2026-12-16',
      },
      {
        kind: 'use_exemption',
        timing: 'later_years',
        saves_inr: '15600.00',
        headline: 'Use your tax-free allowance',
        detail: '₹125,000.00 of the allowance is unused.',
        exemption_inr: '125000',
        used_inr: '0.00',
        unused_inr: '125000.00',
        fills_inr: '120000.00',
        lots: [
          {
            symbol: 'LTFUND',
            account_name: 'in-broker',
            quantity: '100',
            gain_inr: '120000.00',
            tax_avoided_later_inr: '15600.00',
          },
        ],
        act_by: '2027-03-31',
      },
    ],
    warnings: [],
  };

  it('parses every kind and keeps timing', () => {
    const parsed = TaxOpportunitiesResponseSchema.parse(payload);
    expect(parsed.opportunities.map((o) => o.kind)).toEqual([
      'wait_for_long_term',
      'use_exemption',
    ]);
    expect(parsed.opportunities[1]?.timing).toBe('later_years');
    expect(parsed.opportunities[1]?.lots[0]?.tax_avoided_later_inr).toBe('15600.00');
    expect(parsed.total_saves_this_fy_inr).toBe('2288.00');
  });

  it('an empty answer is a valid answer', () => {
    expect(TaxOpportunitiesResponseSchema.parse({}).opportunities).toEqual([]);
  });
});

describe('dates payload', () => {
  it('parses each kind with its estimate flag', () => {
    const parsed = TaxDatesResponseSchema.parse({
      status: 'success',
      as_of: '2026-11-28',
      fy: '2026-27',
      horizon_days: 90,
      estimated_tax_inr: '20800.00',
      dates: [
        {
          kind: 'advance_tax',
          date: '2026-12-15',
          days_until: 17,
          headline: 'x',
          detail: 'y',
          estimate: true,
        },
        {
          kind: 'long_term',
          date: '2026-12-21',
          days_until: 23,
          headline: 'a',
          detail: 'b',
          estimate: false,
        },
      ],
    });
    expect(parsed.dates.map((d) => d.estimate)).toEqual([true, false]);
    expect(parsed.estimated_tax_inr).toBe('20800.00');
  });
});

describe('simulate-sale payload', () => {
  it('reads the locked units the ELSS rule reports', () => {
    const parsed = SaleSimulationSchema.parse({
      status: 'insufficient_quantity',
      message: null,
      sale: {
        date: '2026-11-28',
        fy: '2026-27',
        quantity_requested: '120',
        quantity_consumed: '100.00000000',
        quantity_locked: '50.00000000',
        locked_until: '2029-06-10',
        price_per_unit: '80',
        currency: 'INR',
      },
      lots: [
        { fifo_position: 1, acquired_date: '2023-07-01', quantity: '100', is_long_term: true },
      ],
      gains: { gain_native: '-2000.00', gain_inr: '-2000.00' },
      tax: null,
      assumptions: ['50 units locked until 2029-06-10 (lock-in); they are not part of this sale.'],
    });
    expect(parsed.sale.locked_until).toBe('2029-06-10');
    expect(parsed.tax).toBeNull();
    expect(parsed.lots[0]?.is_long_term).toBe(true);
  });
});

describe('extended existing schemas', () => {
  it('instrument carries the lock-in and its suggestion', () => {
    const parsed = InstrumentSchema.parse({
      public_id: 'x',
      symbol: 'ELSSFND',
      name: 'Quant ELSS Tax Saver Fund',
      instrument_type: 'mutual_fund',
      lock_in_months: null,
      lock_in_suggestion: 36,
    });
    expect(parsed.lock_in_suggestion).toBe(36);
    expect(parsed.lock_in_months).toBeNull();
  });

  it('an older instrument payload without the fields still parses', () => {
    const parsed = InstrumentSchema.parse({
      public_id: 'x',
      symbol: 'A',
      instrument_type: 'stock',
    });
    expect(parsed.lock_in_months).toBeNull();
    expect(parsed.lock_in_suggestion).toBeNull();
  });

  it('tax summary exposes set-off steps and unabsorbed losses', () => {
    const parsed = TaxSummarySchema.parse({
      status: 'success',
      fy_label: '2026-27',
      buckets: {
        'indian:short_term': { gain_inr: '-34315.91', set_off_inr: '0', taxable_inr: '0' },
      },
      unabsorbed_loss: { short_term: '34315.91', long_term: '0' },
      set_off_steps: [
        {
          loss_from: 'foreign:short_term',
          applied_to: 'foreign:long_term',
          amount_inr: '5000',
          rate_pct: '0.125',
        },
      ],
      carry_forward: { used: [], remaining: [], expired: [] },
    });
    expect(parsed.unabsorbed_loss.short_term).toBe('34315.91');
    expect(parsed.set_off_steps).toHaveLength(1);
    expect(parsed.buckets['indian:short_term']?.taxable_inr).toBe('0');
  });
});
