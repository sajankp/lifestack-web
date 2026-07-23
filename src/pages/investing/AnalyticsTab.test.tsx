import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { ToastProvider } from '../../components/ui/toast';
import { AnalyticsTab } from './AnalyticsTab';
import { server } from '../../test/setup';

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = vi.fn();
});

const renderWithQuery = (ui: React.ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
};

const EMPTY_EXPOSURE = {
  as_of_date: '2026-07-15',
  analysis_status: 'complete',
  currency: 'USD',
  fx_as_of: null,
  fx_rates_used: {},
  snapshot_coverage: '0',
  staleness_days: null,
  warnings: [],
  display_threshold_pct: '0',
  hidden_exposure_count: 0,
  exposure: [],
  total_direct_exposure: '0',
  total_lookthrough_exposure: '0',
};

const EMPTY_OVERLAP = {
  as_of_date: '2026-07-15',
  analysis_status: 'complete',
  currency: 'USD',
  fx_as_of: null,
  fx_rates_used: {},
  snapshot_coverage: '0',
  warnings: [],
  display_threshold_pct: '0',
  hidden_overlap_count: 0,
  top_5_concentration_pct: '0',
  top_10_concentration_pct: '0',
  duplicate_exposure_index: '0',
  overlaps: [],
};

const mockAnalyticsEndpoints = (instruments: unknown[] = []) => {
  server.use(
    http.get('*/v1/investing/instruments', () => HttpResponse.json(instruments)),
    http.get('*/v1/investing/analytics/exposure', () => HttpResponse.json(EMPTY_EXPOSURE)),
    http.get('*/v1/investing/analytics/overlap', () => HttpResponse.json(EMPTY_OVERLAP)),
  );
};

describe('AnalyticsTab', () => {
  it('Seed Constituents: pasting AAPL,0.60 no longer sets company_name to AAPL (spec-010 §3.3)', async () => {
    mockAnalyticsEndpoints([
      {
        public_id: 'instrument-etf-id',
        symbol: 'VTI',
        name: 'Vanguard Total Market ETF',
        instrument_type: 'etf',
        company_id: null,
        ticker: null,
        isin: null,
        exchange: null,
        is_active: true,
        created_at: '2026-05-24T00:00:00Z',
        updated_at: '2026-05-24T00:00:00Z',
      },
    ]);

    let upsertPayload: Record<string, unknown> | null = null;
    server.use(
      http.post(
        '*/v1/investing/instruments/instrument-etf-id/constituents',
        async ({ request }) => {
          upsertPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json([]);
        },
      ),
    );

    renderWithQuery(<AnalyticsTab currencyDisplayPreference="symbol" />);

    fireEvent.click(await screen.findByText('Advanced'));
    fireEvent.click(screen.getByText('Seed Constituents'));

    fireEvent.click(await screen.findByRole('combobox'));
    fireEvent.click(await screen.findByText(/VTI \(etf\)/));

    // Structured entry: company name is a separate field from the ticker —
    // change row 0's ticker to AAPL without touching the name field.
    fireEvent.change(screen.getByTestId('investing-constituent-ticker-0'), {
      target: { value: 'AAPL' },
    });
    fireEvent.change(screen.getByTestId('investing-constituent-weight-0'), {
      target: { value: '0.60' },
    });

    fireEvent.click(screen.getByText('Save breakdown'));

    await waitFor(() => {
      expect(upsertPayload).not.toBeNull();
    });
    const constituents = (
      upsertPayload as unknown as { constituents: Array<Record<string, unknown>> }
    ).constituents;
    expect(constituents[0].company_ticker).toBe('AAPL');
    expect(constituents[0].company_name).toBe('Apple Inc');
    expect(constituents[0].company_name).not.toBe('AAPL');
  });

  it('Analytics Edit Instrument modal: renders a field-level 422 error inline (spec-010 §5/§7)', async () => {
    mockAnalyticsEndpoints([
      {
        public_id: 'instrument-etf-id',
        symbol: 'VTI',
        name: 'Vanguard Total Market ETF',
        instrument_type: 'etf',
        company_id: null,
        ticker: null,
        isin: null,
        exchange: null,
        is_active: true,
        created_at: '2026-05-24T00:00:00Z',
        updated_at: '2026-05-24T00:00:00Z',
      },
    ]);
    server.use(
      http.patch('*/v1/investing/instruments/instrument-etf-id', () =>
        HttpResponse.json({ detail: 'ticker: required for US ETF' }, { status: 422 }),
      ),
    );

    renderWithQuery(<AnalyticsTab currencyDisplayPreference="symbol" />);

    fireEvent.click(await screen.findByText('Advanced'));
    fireEvent.click(await screen.findByTestId('investing-edit-instrument-instrument-etf-id'));

    fireEvent.click(await screen.findByTestId('investing-edit-instrument-submit'));

    const error = await screen.findByTestId('investing-edit-instrument-error');
    expect(error.textContent).toContain('ticker: required for US ETF');
  });

  it('scopes the coverage/status labels to look-through decomposition (#183)', async () => {
    // "Coverage: 0 / Status: partial" read as contradicting charts that
    // visibly show data -- the number was correct but unscoped (it measures
    // fund decomposition, not whether holdings have data at all).
    mockAnalyticsEndpoints([]);

    renderWithQuery(<AnalyticsTab currencyDisplayPreference="symbol" />);

    expect(await screen.findByText(/Look-through coverage:/)).toBeInTheDocument();
    expect(screen.getByText(/Decomposition status:/)).toBeInTheDocument();
    expect(screen.queryByText(/^Coverage:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Status:/)).not.toBeInTheDocument();
  });
});
