import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { ExposureTab } from './ExposureTab';
import { server } from '../../test/setup';
import { useWorkspaceStore } from '../../store/workspaceStore';

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const renderTab = () => {
  useWorkspaceStore.getState().setActiveWorkspaceId('ws-1');
  return render(
    <MemoryRouter>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <ExposureTab currencyDisplayPreference="symbol" />
      </QueryClientProvider>
    </MemoryRouter>,
  );
};

const exposure = (overrides: Record<string, unknown> = {}) => ({
  as_of_date: '2026-11-28',
  analysis_status: 'complete',
  currency: 'INR',
  fx_as_of: null,
  fx_rates_used: {},
  snapshot_coverage: '0.9',
  staleness_days: null,
  warnings: [],
  display_threshold_pct: '0.5',
  hidden_exposure_count: 0,
  exposure: [],
  total_direct_exposure: '1310000',
  total_lookthrough_exposure: '2750000',
  ...overrides,
});

const serve = ({
  exposureBody = exposure(),
  themeWeights = { semis_ai: 50, gold: 34 } as Record<string, number>,
  withReport = true,
} = {}) => {
  server.use(
    http.get('*/v1/platform/workspaces/', () =>
      HttpResponse.json({
        items: [
          { public_id: 'ws-1', name: 'Default', description: null, is_active: true, role: 'owner' },
        ],
      }),
    ),
    http.get('*/v1/investing/analytics/exposure', () => HttpResponse.json(exposureBody)),
    http.get('*/v1/investing/analytics/overlap', () =>
      HttpResponse.json({
        as_of_date: '2026-11-28',
        analysis_status: 'complete',
        currency: 'INR',
        fx_as_of: null,
        fx_rates_used: {},
        snapshot_coverage: '0.9',
        warnings: [],
        display_threshold_pct: '0.5',
        hidden_overlap_count: 0,
        top_5_concentration_pct: '0.2',
        top_10_concentration_pct: '0.3',
        duplicate_exposure_index: '0.1',
        overlaps: [],
      }),
    ),
    http.get('*/v1/investing/analytics/allocation', () =>
      HttpResponse.json({
        as_of_date: '2026-11-28',
        currency: 'INR',
        total_portfolio_value: '0.00',
        holdings_value: '0.00',
        cash_value: '0.00',
        asset_classes: [],
        sectors: [],
      }),
    ),
    http.get('*/v1/investing/portfolio-reports', () =>
      HttpResponse.json({
        total: withReport ? 1 : 0,
        next_cursor: null,
        items: withReport
          ? [
              {
                public_id: '550e8400-e29b-41d4-a716-446655440000',
                as_of: '2026-11-28',
                run_id: 'r',
                theme_weights: themeWeights,
                created_at: '2026-11-28T00:00:00Z',
              },
            ]
          : [],
      }),
    ),
    http.get('*/v1/finance/settings/user', () =>
      HttpResponse.json({
        reporting_currency_override_code: null,
        currency_display_preference_override: null,
        workspace_reporting_currency_code: 'INR',
        workspace_currency_display_preference: 'symbol',
        effective_reporting_currency_code: 'INR',
        effective_currency_display_preference: 'symbol',
        effective_locale: 'en-IN',
        effective_decimal_places: 2,
        updated_at: '2026-05-24T00:00:00Z',
      }),
    ),
  );
};

describe('ExposureTab', () => {
  it('says what the two totals are in plain words, with the direct share inside the whole', async () => {
    serve();
    renderTab();

    const summary = await screen.findByTestId('investing-exposure-summary');
    await waitFor(() => expect(summary).toHaveTextContent('Whole portfolio, seen through funds'));
    expect(summary).toHaveTextContent('of which stocks you hold directly');
    expect(screen.getByTestId('investing-total-lookthrough')).toHaveTextContent('27,50,000');
    expect(screen.getByTestId('investing-total-direct')).toHaveTextContent('13,10,000');
  });

  it('shows a dash, not a zero amount, when there are no direct holdings', async () => {
    serve({ exposureBody: exposure({ total_direct_exposure: '0' }) });
    renderTab();

    await waitFor(() =>
      expect(screen.getByTestId('investing-total-lookthrough')).toHaveTextContent('27,50,000'),
    );
    expect(screen.getByTestId('investing-total-direct')).toHaveTextContent('—');
  });

  it('collapses duplicate data warnings into one line with the list behind it', async () => {
    serve({
      exposureBody: exposure({
        warnings: ['Fund A has no snapshot', 'Fund A has no snapshot', 'Fund B is stale'],
      }),
    });
    renderTab();

    const line = await screen.findByTestId('analytics-warnings-summary');
    expect(line).toHaveTextContent('2 data warnings — view');
    const items = within(line).getAllByTestId('analytics-warning-item');
    expect(items.map((li) => li.textContent)).toEqual([
      'Fund A has no snapshot',
      'Fund B is stale',
    ]);
  });

  it('shows no warning line when the data is clean', async () => {
    serve();
    renderTab();
    await screen.findByTestId('investing-exposure-summary');
    expect(screen.queryByTestId('analytics-warnings-summary')).not.toBeInTheDocument();
  });

  it('shows themes from the latest report with readable names and the gap explained', async () => {
    serve();
    renderTab();

    const card = await screen.findByTestId('theme-split-card');
    expect(within(card).getAllByText('Semis & AI').length).toBeGreaterThan(0);
    expect(within(card).queryByText('semis_ai')).not.toBeInTheDocument();
    expect(within(card).getByTestId('theme-gap')).toHaveTextContent(
      '84% grouped, 16% not itemised',
    );
  });

  it('has no theme card before any report exists', async () => {
    serve({ withReport: false });
    renderTab();
    await screen.findByTestId('investing-exposure-summary');
    expect(screen.queryByTestId('theme-split-card')).not.toBeInTheDocument();
  });

  it('no longer carries the report cards that copy LifeStack numbers, or instrument admin', async () => {
    serve();
    renderTab();
    await screen.findByTestId('investing-exposure-summary');

    expect(screen.queryByTestId('portfolio-report-cards')).not.toBeInTheDocument();
    expect(screen.queryByText(/Create Instrument/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Seed Constituents/)).not.toBeInTheDocument();
    expect(screen.getByTestId('exposure-settings-link')).toHaveAttribute(
      'href',
      '/settings/instruments',
    );
  });

  it('scopes the coverage and status labels to look-through decomposition (#183)', async () => {
    serve();
    renderTab();

    expect(await screen.findByText(/Look-through coverage:/)).toBeInTheDocument();
    expect(screen.getByText(/Decomposition status:/)).toBeInTheDocument();
    expect(screen.queryByText(/^Coverage:/)).not.toBeInTheDocument();
  });
});
