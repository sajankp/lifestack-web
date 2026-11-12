import { describe, it, expect, vi, beforeEach } from 'vitest';

import api from './api';
import { investingService } from './investing';

describe('investingService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls holdings endpoints', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({ data: { items: [], total: 0 } } as never);
    vi.spyOn(api, 'patch').mockResolvedValueOnce({ data: { public_id: 'h1' } } as never);
    vi.spyOn(api, 'delete').mockResolvedValueOnce({} as never);

    await investingService.getHoldings(10, 20);
    await investingService.updateHolding('h1', {} as never);
    await investingService.deleteHolding('h1');

    expect(api.get).toHaveBeenCalledWith('/investing/holdings', {
      params: { limit: 10, offset: 20 },
    });
    expect(api.patch).toHaveBeenCalledWith('/investing/holdings/h1', {});
    expect(api.delete).toHaveBeenCalledWith('/investing/holdings/h1');
  });

  it('calls cash balance endpoints', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({ data: { items: [], total: 0 } } as never);
    vi.spyOn(api, 'post').mockResolvedValueOnce({ data: { public_id: 'c1' } } as never);
    vi.spyOn(api, 'patch').mockResolvedValueOnce({ data: { public_id: 'c1' } } as never);
    vi.spyOn(api, 'delete').mockResolvedValueOnce({} as never);

    await investingService.getCashBalances(5, 0);
    await investingService.createCashBalance({} as never);
    await investingService.updateCashBalance('c1', {} as never);
    await investingService.deleteCashBalance('c1');

    expect(api.get).toHaveBeenCalledWith('/investing/cash-balances', {
      params: { limit: 5, offset: 0 },
    });
    expect(api.post).toHaveBeenCalledWith('/investing/cash-balances', {});
    expect(api.patch).toHaveBeenCalledWith('/investing/cash-balances/c1', {});
    expect(api.delete).toHaveBeenCalledWith('/investing/cash-balances/c1');
  });

  it('calls summary, instrument, constituent, and analytics endpoints', async () => {
    vi.spyOn(api, 'get')
      .mockResolvedValueOnce({ data: { portfolio_value: '0' } } as never)
      .mockResolvedValueOnce({ data: [] } as never)
      .mockResolvedValueOnce({ data: { exposure: [] } } as never)
      .mockResolvedValueOnce({ data: { overlaps: [] } } as never);
    vi.spyOn(api, 'post')
      .mockResolvedValueOnce({ data: { public_id: 'i1' } } as never)
      .mockResolvedValueOnce({ data: [] } as never);
    vi.spyOn(api, 'patch').mockResolvedValueOnce({ data: { public_id: 'i1' } } as never);

    await investingService.getSummary();
    await investingService.getInstruments();
    await investingService.createInstrument({} as never);
    await investingService.updateInstrument('i1', { instrument_type: 'etf' });
    await investingService.upsertInstrumentConstituents('i1', {} as never);
    await investingService.getExposureAnalytics('2026-05-24');
    await investingService.getOverlapAnalytics('2026-05-24');

    expect(api.get).toHaveBeenNthCalledWith(1, '/investing/summary');
    expect(api.get).toHaveBeenNthCalledWith(2, '/investing/instruments');
    expect(api.post).toHaveBeenNthCalledWith(1, '/investing/instruments', {});
    expect(api.patch).toHaveBeenCalledWith('/investing/instruments/i1', { instrument_type: 'etf' });
    expect(api.post).toHaveBeenNthCalledWith(2, '/investing/instruments/i1/constituents', {});
    expect(api.get).toHaveBeenNthCalledWith(3, '/investing/analytics/exposure', {
      params: { as_of: '2026-05-24' },
    });
    expect(api.get).toHaveBeenNthCalledWith(4, '/investing/analytics/overlap', {
      params: { as_of: '2026-05-24' },
    });
  });

  it('resolves a reference identifier (api spec-083 §5.4)', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({
      data: {
        identifier_status: 'resolved',
        isin: 'US0378331005',
        ticker: 'AAPL',
        exchange: 'XNAS',
        name: 'Apple Inc',
        security_type: 'stock',
      },
    } as never);

    const result = await investingService.resolveReference({ ticker: 'AAPL', type: 'stock' });

    expect(api.get).toHaveBeenCalledWith('/investing/reference/resolve', {
      params: { isin: undefined, ticker: 'AAPL', exchange: undefined, type: 'stock' },
    });
    expect(result.identifier_status).toBe('resolved');
    expect(result.name).toBe('Apple Inc');
  });

  it('falls back to "unresolved" for an unrecognized identifier_status value', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({
      data: {
        identifier_status: 'something-new',
        isin: null,
        ticker: null,
        exchange: null,
        name: null,
        security_type: null,
      },
    } as never);

    const result = await investingService.resolveReference({ isin: 'BOGUS' });
    expect(result.identifier_status).toBe('unresolved');
  });

  it('calls portfolio reports list endpoint with workspace, dates, limit and cursor', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({
      data: { total: 0, next_cursor: null, items: [] },
    } as never);

    await investingService.getPortfolioReports('ws-1', '2026-01-01', '2026-03-31', 10, 'cur-1');

    expect(api.get).toHaveBeenCalledWith('/investing/portfolio-reports', {
      params: {
        workspace_id: 'ws-1',
        from_date: '2026-01-01',
        to_date: '2026-03-31',
        limit: 10,
        cursor: 'cur-1',
      },
    });
  });

  it('omits undefined optional portfolio report params', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({
      data: { total: 0, next_cursor: null, items: [] },
    } as never);

    await investingService.getPortfolioReports('ws-1');

    expect(api.get).toHaveBeenCalledWith('/investing/portfolio-reports', {
      params: {
        workspace_id: 'ws-1',
        from_date: undefined,
        to_date: undefined,
        limit: 50,
        cursor: undefined,
      },
    });
  });

  it('calls portfolio report detail endpoint and parses the item', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({
      data: {
        public_id: 'r1',
        as_of: '2026-06-30',
        run_id: 'run-1',
        theme_weights: [{ theme: 'equity', weight: '60' }],
        harvest_candidates: [
          { symbol: 'RELIANCE', quantity: '2', loss: '5000', tax_saved: '1500' },
        ],
        lrs_headroom: { headroom_inr: '250000' },
        tax_buckets: [
          {
            regime: 'foreign',
            section: '115AD',
            rate_pct: '12.5',
            gain_native: '0',
            gain_inr: '0',
            fees_native: '0',
            fees_inr: '0',
            exemption_applied: '0',
            tax: '0',
            sell_count: 0,
            lot_count: 0,
          },
        ],
        created_at: '2026-06-30T10:00:00Z',
      },
    } as never);

    const result = await investingService.getPortfolioReport('r1', true);

    expect(api.get).toHaveBeenCalledWith('/investing/portfolio-reports/r1', {
      params: { include_payload: true },
    });
    expect(result.public_id).toBe('r1');
    expect(result.theme_weights[0]?.theme).toBe('equity');
    expect(result.harvest_candidates[0]?.symbol).toBe('RELIANCE');
    expect(result.lrs_headroom?.headroom_inr).toBe('250000');
    expect(result.tax_buckets[0]?.tax).toBe('0');
  });
});
