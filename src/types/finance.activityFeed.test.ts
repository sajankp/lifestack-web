import { describe, it, expect } from 'vitest';
import { ActivityFeedResponseSchema } from './finance';

// The feed is parsed with zod, which drops keys the schema doesn't know. The one-row transfer
// (spec-113 §2.1) relies on amount_in / currency_in reaching the timeline.

const base = {
  id: 'id-1',
  event_type: 'transfer',
  date: '2026-07-02T10:00:00Z',
  description: 'Wallet → Brokerage',
  amount: '-100.00',
  currency: 'USD',
  account_id: 'acc-1',
  account_name: 'Wallet',
  account_type: 'wallet',
  source_ref: 'tf-1',
};

describe('ActivityFeedResponseSchema', () => {
  it('keeps the received side of a one-row transfer', () => {
    const parsed = ActivityFeedResponseSchema.parse({
      items: [{ ...base, amount_in: '+9500.00', currency_in: 'INR' }],
      total: 1,
    });

    expect(parsed.items[0].amount_in).toBe('+9500.00');
    expect(parsed.items[0].currency_in).toBe('INR');
  });

  it('accepts rows without it (single-account feed, spend, orders)', () => {
    const parsed = ActivityFeedResponseSchema.parse({
      items: [{ ...base }, { ...base, id: 'id-2', amount_in: null, currency_in: null }],
      total: 2,
    });

    expect(parsed.items[0].amount_in ?? null).toBeNull();
    expect(parsed.items[1].amount_in).toBeNull();
  });
});
