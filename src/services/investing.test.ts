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

    expect(api.get).toHaveBeenCalledWith('/investing/holdings', { params: { limit: 10, offset: 20 } });
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

    expect(api.get).toHaveBeenCalledWith('/investing/cash-balances', { params: { limit: 5, offset: 0 } });
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
});
