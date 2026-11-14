import { describe, expect, it } from 'vitest';
import { normalizeHarvestCandidates, normalizeTaxBuckets } from './portfolioReport';

// Shapes below are what the fortnightly cron really stores in portfolio_reports
// (index_portfolio_report.py: harvest_detail + the scalars "tax" dict), not an
// idealised contract. Keep them in sync with production rows.

describe('normalizeTaxBuckets', () => {
  it('turns the flat stored tax dict into long-term and short-term buckets', () => {
    const buckets = normalizeTaxBuckets({
      lt_gain_inr: 1000,
      lt_tax_inr: 125,
      st_gain_inr: 200,
      st_tax_inr: 70,
      total_tax_inr: 195,
      slab_pct: 30,
      advance_paid_inr: 0,
    });

    expect(buckets).toHaveLength(2);
    expect(buckets[0]).toMatchObject({
      regime: 'long-term',
      gain_inr: '1000',
      tax: '125',
      rate_pct: '12.5',
    });
    expect(buckets[1]).toMatchObject({
      regime: 'short-term',
      gain_inr: '200',
      tax: '70',
      rate_pct: '35',
    });
  });

  it('reports a zero rate when there is no gain to divide by', () => {
    const [lt, st] = normalizeTaxBuckets({
      lt_gain_inr: 0,
      lt_tax_inr: 0,
      st_gain_inr: -50,
      st_tax_inr: 0,
    });

    expect(lt.rate_pct).toBe('0');
    expect(st.rate_pct).toBe('0');
  });

  it('keeps per-bucket records and falls back to the key for the section', () => {
    const buckets = normalizeTaxBuckets({
      foreign_115AD: { regime: 'foreign', section: '115AD', tax: '1500', gain_inr: '12000' },
      other: { regime: 'domestic', tax: '10', gain_inr: '100' },
    });

    expect(buckets).toHaveLength(2);
    expect(buckets[0]).toMatchObject({ section: '115AD', tax: '1500', gain_inr: '12000' });
    expect(buckets[1].section).toBe('other');
  });

  it('passes an array of buckets through', () => {
    const input = [{ regime: 'foreign', section: '112', tax: '5', gain_inr: '50' }];
    expect(normalizeTaxBuckets(input)).toHaveLength(1);
  });

  it.each([null, undefined, {}, []])('returns no buckets for %j', (value) => {
    expect(normalizeTaxBuckets(value as never)).toEqual([]);
  });
});

describe('normalizeHarvestCandidates', () => {
  it('maps the stored harvest_detail keys onto the card model', () => {
    const [candidate] = normalizeHarvestCandidates([
      {
        symbol: 'ABC',
        account: 'IND Money',
        qty: 4,
        unrealised_loss_inr: 2500.5,
        days_to_long_term: 40,
        tax_saved_inr: 780.25,
      },
    ]);

    expect(candidate).toEqual({
      symbol: 'ABC',
      quantity: 4,
      loss: 2500.5,
      tax_saved: 780.25,
    });
  });

  it('accepts the canonical keys and the loss_inr alias', () => {
    const result = normalizeHarvestCandidates([
      { symbol: 'AAA', quantity: '2', loss: '50', tax_saved: '5' },
      { symbol: 'BBB', quantity: 1, loss_inr: '70', tax_saved_inr: '7' },
    ]);

    expect(result).toEqual([
      { symbol: 'AAA', quantity: '2', loss: '50', tax_saved: '5' },
      { symbol: 'BBB', quantity: 1, loss: '70', tax_saved: '7' },
    ]);
  });

  it('defaults null quantity/tax saved from older reports to zero', () => {
    const [candidate] = normalizeHarvestCandidates([
      { symbol: 'OLD', qty: null, unrealised_loss_inr: 900, tax_saved_inr: null },
    ]);

    expect(candidate).toEqual({ symbol: 'OLD', quantity: 0, loss: 900, tax_saved: 0 });
  });

  it('drops entries that are not objects or have no symbol', () => {
    expect(normalizeHarvestCandidates([null, 7, 'x', { qty: 1 }] as never)).toEqual([]);
  });

  it.each([null, undefined])('returns [] for %s', (value) => {
    expect(normalizeHarvestCandidates(value as never)).toEqual([]);
  });
});
