import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/setup';
import { financeService } from './finance';
import { DashboardSummarySchema } from '../types/dashboard';

// spec-113 §3: Today reads GET /finance/period-change and the dashboard's month_budget.

const complete = {
  status: 'complete',
  start_date: '2026-11-21',
  end_date: '2026-11-28',
  currency: 'INR',
  net_worth: {
    start: '2700000.00',
    end: '2802813.00',
    change: '102813.00',
    saved: '99200.00',
    markets_and_other: '3613.00',
  },
  investments: {
    start: '1000000.00',
    end: '1095000.00',
    change: '95000.00',
    new_money: '60000.00',
    growth: '35000.00',
  },
};

describe('financeService.getPeriodChange', () => {
  it('asks for the period and returns the parsed split', async () => {
    let requested: URL | null = null;
    server.use(
      http.get('*/v1/finance/period-change', ({ request }) => {
        requested = new URL(request.url);
        return HttpResponse.json(complete);
      }),
    );

    const result = await financeService.getPeriodChange('week');

    expect(requested!.searchParams.get('period')).toBe('week');
    expect(result.status).toBe('complete');
    expect(result.currency).toBe('INR');
    expect(result.net_worth.end).toBe('2802813.00');
    expect(result.net_worth.saved).toBe('99200.00');
    expect(result.investments.new_money).toBe('60000.00');
    expect(result.investments.growth).toBe('35000.00');
  });

  it('keeps the nulls of a partial or unavailable answer', async () => {
    server.use(
      http.get('*/v1/finance/period-change', () =>
        HttpResponse.json({
          status: 'partial',
          start_date: '2026-11-21',
          end_date: '2026-11-28',
          currency: 'INR',
          net_worth: { start: '1', end: '2', change: '1', saved: null, markets_and_other: null },
          investments: { start: null, end: null, change: null, new_money: null, growth: null },
        }),
      ),
    );

    const result = await financeService.getPeriodChange('month');

    expect(result.status).toBe('partial');
    expect(result.net_worth.saved).toBeNull();
    expect(result.investments.change).toBeNull();
  });
});

describe('DashboardSummarySchema month_budget', () => {
  const base = {
    todos: {},
    spending: {},
    investing: {},
    system: { generated_at: '2026-11-28T10:00:00Z' },
  };

  it('keeps the month budget answer', () => {
    const parsed = DashboardSummarySchema.parse({
      ...base,
      month_budget: {
        month: '2026-11',
        as_of: '2026-11-28',
        lines: [],
        covered_spend: '108.00',
        covered_limit: '120.00',
        uncovered_spend: '692.05',
        used_pct: 90,
        breached_count: 0,
        total_spend: '800.05',
      },
    });

    expect(parsed.month_budget?.covered_limit).toBe('120.00');
    expect(parsed.month_budget?.uncovered_spend).toBe('692.05');
    expect(parsed.month_budget?.used_pct).toBe(90);
  });

  it('is null when the API has none (spending unavailable, or an older cached entry)', () => {
    expect(DashboardSummarySchema.parse(base).month_budget).toBeNull();
    expect(DashboardSummarySchema.parse({ ...base, month_budget: null }).month_budget).toBeNull();
  });
});
