import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { ToastProvider } from '../../components/ui/toast';
import { AnalyticsTab } from './AnalyticsTab';
import { server } from '../../test/setup';
import type { PortfolioReport } from '../../types/investing';

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
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ToastProvider>{ui}</ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
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
    http.get('*/v1/investing/performance/history', () =>
      HttpResponse.json({ currency: 'USD', points: [], net_change: '0', net_change_pct: '0' }),
    ),
    http.get('*/v1/investing/analytics/allocation', () =>
      HttpResponse.json({
        as_of_date: '2026-09-13',
        currency: 'USD',
        total_portfolio_value: '0.00',
        holdings_value: '0.00',
        cash_value: '0.00',
        asset_classes: [],
        sectors: [],
      }),
    ),
    http.get('*/v1/investing/dividends/history', () =>
      HttpResponse.json({
        currency: 'USD',
        trailing_12m_total: '0.00',
        all_time_total: '0.00',
        points: [],
      }),
    ),
    http.get('*/v1/finance/settings/user', () =>
      HttpResponse.json({
        base_currency: 'USD',
        currency_display_preference: 'symbol',
      }),
    ),
    http.get('*/v1/finance/accounts', () =>
      HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
    ),
    http.get('*/v1/finance/currencies', () => HttpResponse.json([])),
    http.get('*/v1/investing/dividends', () =>
      HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
    ),
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
      http.get('*/v1/platform/workspaces/', () =>
        HttpResponse.json({ items: [] }),
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
      http.get('*/v1/platform/workspaces/', () =>
        HttpResponse.json({ items: [] }),
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
    server.use(
      http.get('*/v1/platform/workspaces/', () =>
        HttpResponse.json({ items: [] }),
      ),
    );

    renderWithQuery(<AnalyticsTab currencyDisplayPreference="symbol" />);

    expect(await screen.findByText(/Look-through coverage:/)).toBeInTheDocument();
    expect(screen.getByText(/Decomposition status:/)).toBeInTheDocument();
    expect(screen.queryByText(/^Coverage:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Status:/)).not.toBeInTheDocument();
  });

  const MOCK_WORKSPACE = {
    public_id: 'ws-1',
    name: 'Default',
    description: null,
    is_active: true,
    role: 'owner',
  };

  const MOCK_PORTFOLIO_REPORT: PortfolioReport = {
    public_id: 'rep-1',
    as_of: '2026-10-31',
    run_id: 'run-1',
    theme_weights: [
      { theme: 'US Equities', weight: 55 },
      { theme: 'India Equities', weight: 30 },
      { theme: 'Gold', weight: 10 },
      { theme: 'Cash', weight: 5 },
    ],
    harvest_candidates: [
      { symbol: 'RELIANCE', quantity: '10', loss: '45000.00', tax_saved: '13500.00' },
    ],
    lrs_headroom: { headroom_inr: '750000.00' },
    tax_buckets: [
      {
        regime: 'foreign',
        section: '115AD',
        rate_pct: '12.5',
        gain_native: '83333.33',
        gain_inr: '100000.00',
        fees_native: '0',
        fees_inr: '0',
        exemption_applied: '0',
        tax: '12500.00',
        sell_count: 2,
        lot_count: 2,
      },
    ],
    created_at: '2026-11-01T00:00:00Z',
    scalars_json: null,
    foundation_json: {
      countries: JSON.stringify([
        { country: 'US', weight: 70 },
        { country: 'IN', weight: 20 },
        { country: 'GB', weight: 7 },
        { country: 'AE', weight: 3 },
      ]),
    },
    actions_md: null,
  };

  const mockReportEndpoints = () => {
    server.use(
      http.get('*/v1/platform/workspaces/', () =>
        HttpResponse.json({ items: [MOCK_WORKSPACE] }),
      ),
      http.get('*/v1/investing/portfolio-reports', () =>
        HttpResponse.json({ items: [MOCK_PORTFOLIO_REPORT], total: 1, next_cursor: null }),
      ),
    );
  };

  it('renders the portfolio report cards from the latest report (live data)', async () => {
    mockAnalyticsEndpoints([]);
    mockReportEndpoints();

    renderWithQuery(<AnalyticsTab currencyDisplayPreference="symbol" />);

    expect(await screen.findByText('Portfolio Report (Latest)')).toBeInTheDocument();
    expect(await screen.findByText('LRS Headroom')).toBeInTheDocument();
    expect(await screen.findByText('₹750,000.00')).toBeInTheDocument();
    expect(await screen.findByText('Tax Buckets')).toBeInTheDocument();
    expect(await screen.findByText('Theme Split')).toBeInTheDocument();
    expect(await screen.findByText('Country Split')).toBeInTheDocument();
    expect(await screen.findByText('Harvest Candidates')).toBeInTheDocument();
  });

  it('shows the empty state when no report exists yet', async () => {
    mockAnalyticsEndpoints([]);
    server.use(
      http.get('*/v1/platform/workspaces/', () =>
        HttpResponse.json({ items: [MOCK_WORKSPACE] }),
      ),
      http.get('*/v1/investing/portfolio-reports', () =>
        HttpResponse.json({ items: [], total: 0, next_cursor: null }),
      ),
    );

    renderWithQuery(<AnalyticsTab currencyDisplayPreference="symbol" />);

    expect(await screen.findByText('No portfolio report available')).toBeInTheDocument();
    expect(screen.queryByText('LRS Headroom')).not.toBeInTheDocument();
  });

  it('opens the report detail view with the full foundation_json', async () => {
    mockAnalyticsEndpoints([]);
    mockReportEndpoints();

    renderWithQuery(<AnalyticsTab currencyDisplayPreference="symbol" />);

    expect(await screen.findByText('LRS Headroom')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('investing-report-detail'));

    expect(await screen.findByText('Portfolio Report Detail')).toBeInTheDocument();
    expect(screen.getByText(/run-1/)).toBeInTheDocument();
    expect(screen.getByText(/"countries"/)).toBeInTheDocument();
    expect(
      screen.getByText('Report as of 2026-10-31 · run run-1 · 2026-11-01T00:00:00Z'),
    ).toBeInTheDocument();
  });
});
