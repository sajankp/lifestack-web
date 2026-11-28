import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { ToastProvider } from '../../components/ui/toast';
import { PerformanceTab } from './PerformanceTab';
import { server } from '../../test/setup';
import { useWorkspaceStore } from '../../store/workspaceStore';

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const REPORT_ID = '550e8400-e29b-41d4-a716-446655440000';

const serve = (actionsMd: string | null) => {
  useWorkspaceStore.getState().setActiveWorkspaceId('ws-1');
  const report = {
    public_id: REPORT_ID,
    as_of: '2026-11-28',
    run_id: 'r',
    created_at: '2026-11-28T00:00:00Z',
  };
  server.use(
    http.get('*/v1/platform/workspaces/', () =>
      HttpResponse.json({
        items: [
          { public_id: 'ws-1', name: 'Default', description: null, is_active: true, role: 'owner' },
        ],
      }),
    ),
    http.get('*/v1/investing/portfolio-reports', () =>
      HttpResponse.json({ total: 1, next_cursor: null, items: [report] }),
    ),
    http.get(`*/v1/investing/portfolio-reports/${REPORT_ID}`, () =>
      HttpResponse.json({ ...report, actions_md: actionsMd }),
    ),
    http.get('*/v1/investing/performance/returns', () =>
      HttpResponse.json({
        currency: 'INR',
        valuation_status: 'current',
        overall: {
          xirr: '0.12',
          annualized_return_pct: '12.0',
          annualization_reliable: true,
          holding_days: 800,
          total_return_pct: '30',
          realized: '0',
          unrealized: '100',
          data_quality: 'complete',
          open: {
            xirr: '0.12',
            annualized_return_pct: '12.0',
            annualization_reliable: true,
            holding_days: 800,
            total_return_pct: '30',
            realized: '0',
            unrealized: '100',
            market_value: '1100',
            invested: '1000',
          },
          closed: {
            xirr: null,
            annualized_return_pct: null,
            annualization_reliable: false,
            holding_days: null,
            total_return_pct: null,
            realized: '0',
            unrealized: '0',
            market_value: '0',
            invested: '0',
          },
          max_drawdown: null,
        },
        by_account: [],
        by_currency: [],
      }),
    ),
    http.get('*/v1/investing/performance/history', () =>
      HttpResponse.json({ currency: 'INR', points: [], net_change: '0', net_change_pct: '0' }),
    ),
    http.get('*/v1/investing/dividends/history', () =>
      HttpResponse.json({
        currency: 'INR',
        trailing_12m_total: '0',
        all_time_total: '0',
        points: [],
      }),
    ),
    http.get('*/v1/investing/dividends', () =>
      HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
    ),
    http.get('*/v1/finance/accounts', () =>
      HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
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

const renderTab = () =>
  render(
    <MemoryRouter>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <ToastProvider>
          <PerformanceTab currencyDisplayPreference="symbol" />
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

describe('PerformanceTab', () => {
  it('puts the Hermes note first, then the labelled returns', async () => {
    serve('- Trim INFY');
    renderTab();

    const note = await screen.findByTestId('hermes-note');
    const returns = await screen.findByTestId('investing-xirr-overall');
    expect(note.compareDocumentPosition(returns) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('investing-return-label')).toHaveTextContent(
      'Annualised return (XIRR)',
    );
  });

  it('shows returns without a note when the report has none', async () => {
    serve(null);
    renderTab();

    expect(await screen.findByTestId('investing-xirr-overall')).toBeInTheDocument();
    expect(screen.queryByTestId('hermes-note')).not.toBeInTheDocument();
  });

  it('does not carry the exposure or instrument-admin blocks', async () => {
    serve(null);
    renderTab();
    await screen.findByTestId('investing-xirr-overall');

    expect(screen.queryByTestId('investing-exposure')).not.toBeInTheDocument();
    expect(screen.queryByText(/Exposure \(Look-through\)/)).not.toBeInTheDocument();
  });
});
