import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../components/ui/toast';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { InvestingPage } from './InvestingPage';
import { server } from '../test/setup';

const renderWithQuery = (ui: React.ReactNode) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
};

const renderAtPath = (ui: React.ReactNode, path: string) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
};

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('InvestingPage', () => {
  it('shows valuation status and N/A totals for multi-currency unconverted summary', async () => {
    server.use(
      http.get('*/v1/investing/holdings', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/investing/cash-balances', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/finance/accounts', () =>
        HttpResponse.json({
          items: [
            {
              public_id: '11111111-1111-1111-1111-111111111111',
              name: 'Brokerage A',
              account_type: 'brokerage',
              default_currency_code: 'USD',
              is_active: true,
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/finance/currencies', () =>
        HttpResponse.json([
          { code: 'USD', name: 'US Dollar', symbol: '$', minor_unit: 2, is_active: true },
          { code: 'INR', name: 'Indian Rupee', symbol: 'Rs', minor_unit: 2, is_active: true },
          { code: 'GBP', name: 'Pound Sterling', symbol: '£', minor_unit: 2, is_active: true },
        ]),
      ),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          reporting_currency_override_code: null,
          currency_display_preference_override: null,
          workspace_reporting_currency_code: 'USD',
          workspace_currency_display_preference: 'symbol',
          effective_reporting_currency_code: 'USD',
          effective_currency_display_preference: 'symbol',
          updated_at: '2026-05-24T00:00:00Z',
        }),
      ),
      http.get('*/v1/investing/summary', () =>
        HttpResponse.json({
          portfolio_value: null,
          holdings_count: 2,
          cash_total: null,
          currency_breakdown: { USD: '2500.00', GBP: '1000.00' },
          daily_change: null,
          reporting_currency: null,
          valuation_status: 'multi_currency_unconverted',
        }),
      ),
      http.get('*/v1/investing/performance/summary', () =>
        HttpResponse.json({
          total_value: '0',
          total_cost: '0',
          total_gain_loss: '0',
          total_gain_loss_pct: '0',
          snapshot_date: '2026-05-24',
          currency: 'USD',
        }),
      ),
      http.get('*/v1/investing/instruments', () => HttpResponse.json([])),
    );

    renderWithQuery(<InvestingPage />);

    expect(await screen.findByText('Investing')).toBeInTheDocument();
    const naValues = await screen.findAllByText('N/A');
    expect(naValues.length).toBeGreaterThan(0);
    expect(screen.getByText(/Multiple currencies detected/)).toBeInTheDocument();
    expect(screen.getByText('Not configured')).toBeInTheDocument();
    expect(screen.getByTestId('investing-portfolio-value')).toHaveTextContent('N/A');

    const holdingsHeading = screen.getByTestId('investing-holdings-heading');
    expect(holdingsHeading).toHaveClass('flex-col', 'sm:flex-row');

    const cashTab = screen.getByTestId('investing-tab-cash');
    cashTab.focus();
    fireEvent.keyDown(cashTab, { key: 'Enter', code: 'Enter' });
    expect(await screen.findByTestId('investing-cash-heading')).toHaveClass(
      'flex-col',
      'sm:flex-row',
    );

    const analyticsTab = screen.getByTestId('investing-tab-analytics');
    analyticsTab.focus();
    fireEvent.keyDown(analyticsTab, { key: 'Enter', code: 'Enter' });
    // Create Instrument / Seed Constituents moved behind an Advanced
    // disclosure (UX-REVIEW D5), so the heading row is just the title now.
    expect(await screen.findByTestId('investing-analytics-heading')).toHaveTextContent('Analytics');

    // First-run: empty Holdings links straight into the order flow instead
    // of leaving the user to hunt for "Place Order" on another tab.
    const holdingsTabTrigger = screen.getByTestId('investing-tab-holdings');
    holdingsTabTrigger.focus();
    fireEvent.keyDown(holdingsTabTrigger, { key: 'Enter', code: 'Enter' });
    const placeOrderLinks = await screen.findAllByRole('link', { name: /place your first order/i });
    expect(placeOrderLinks[0]).toHaveAttribute('href', '/investing?tab=orders&order=1');
  });

  it.skip('creates an account and submits a holding using selected account/currency', async () => {
    let accountList = {
      items: [] as Array<{
        public_id: string;
        name: string;
        account_type: 'bank' | 'brokerage' | 'wallet' | 'card' | 'gift_card';
        default_currency_code: string;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>,
      total: 0,
      limit: 200,
      offset: 0,
    };
    let holdingPayload: Record<string, unknown> | null = null;

    server.use(
      http.get('*/v1/investing/holdings', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/investing/cash-balances', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/finance/accounts', () => HttpResponse.json(accountList)),
      http.get('*/v1/finance/currencies', () =>
        HttpResponse.json([
          { code: 'USD', name: 'US Dollar', symbol: '$', minor_unit: 2, is_active: true },
          { code: 'INR', name: 'Indian Rupee', symbol: 'Rs', minor_unit: 2, is_active: true },
          { code: 'GBP', name: 'Pound Sterling', symbol: '£', minor_unit: 2, is_active: true },
        ]),
      ),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          reporting_currency_override_code: null,
          currency_display_preference_override: null,
          workspace_reporting_currency_code: 'USD',
          workspace_currency_display_preference: 'symbol',
          effective_reporting_currency_code: 'USD',
          effective_currency_display_preference: 'symbol',
          updated_at: '2026-05-24T00:00:00Z',
        }),
      ),
      http.get('*/v1/investing/summary', () =>
        HttpResponse.json({
          portfolio_value: '0',
          holdings_count: 0,
          cash_total: '0',
          currency_breakdown: {},
          daily_change: null,
          reporting_currency: 'USD',
          valuation_status: 'single_currency_native',
        }),
      ),
      http.get('*/v1/investing/performance/summary', () =>
        HttpResponse.json({
          total_value: '0',
          total_cost: '0',
          total_gain_loss: '0',
          total_gain_loss_pct: '0',
          snapshot_date: '2026-05-24',
          currency: 'USD',
        }),
      ),
      http.get('*/v1/investing/instruments', () => HttpResponse.json([])),
      http.post('*/v1/finance/accounts', async ({ request }) => {
        const body = (await request.json()) as {
          name: string;
          account_type: 'bank' | 'brokerage' | 'wallet' | 'card' | 'gift_card';
          default_currency_code: string;
        };
        accountList = {
          ...accountList,
          items: [
            {
              public_id: '22222222-2222-2222-2222-222222222222',
              name: body.name,
              account_type: body.account_type,
              default_currency_code: body.default_currency_code,
              is_active: true,
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
          ],
          total: 1,
        };
        return HttpResponse.json(accountList.items[0], { status: 201 });
      }),
      http.post('*/v1/investing/holdings', async ({ request }) => {
        holdingPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            public_id: '33333333-3333-3333-3333-333333333333',
            symbol: holdingPayload.symbol,
            account_name: holdingPayload.account_name,
            quantity: holdingPayload.quantity,
            avg_cost: holdingPayload.avg_cost,
            currency: holdingPayload.currency,
            created_at: '2026-05-24T00:00:00Z',
            updated_at: '2026-05-24T00:00:00Z',
          },
          { status: 201 },
        );
      }),
    );

    renderWithQuery(<InvestingPage />);

    await screen.findByText('Investing');
    
    // Open the Add Holding Modal
    fireEvent.click(await screen.findByRole('button', { name: /Add Holding/i }));

    fireEvent.change(await screen.findByPlaceholderText('Account name'), {
      target: { value: 'Primary Brokerage' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Primary Brokerage')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Symbol (e.g. AAPL)'), {
      target: { value: 'AAPL' },
    });
    fireEvent.change(screen.getByPlaceholderText('Quantity'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByPlaceholderText('Avg cost'), {
      target: { value: '150.25' },
    });
    fireEvent.click(screen.getByTestId('investing-holding-submit'));

    await waitFor(() => {
      expect(holdingPayload).not.toBeNull();
    });
    expect(holdingPayload).toMatchObject({
      symbol: 'AAPL',
      account_id: '22222222-2222-2222-2222-222222222222',
      quantity: 10,
      avg_cost: 150.25,
      currency: 'USD',
      instrument_type: 'stock',
    });
  });

  it('loads look-through analytics tab with exposure and overlap data', async () => {
    server.use(
      http.get('*/v1/investing/holdings', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/investing/cash-balances', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/finance/accounts', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/finance/currencies', () =>
        HttpResponse.json([
          { code: 'USD', name: 'US Dollar', symbol: '$', minor_unit: 2, is_active: true },
        ]),
      ),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          reporting_currency_override_code: null,
          currency_display_preference_override: null,
          workspace_reporting_currency_code: 'USD',
          workspace_currency_display_preference: 'symbol',
          effective_reporting_currency_code: 'USD',
          effective_currency_display_preference: 'symbol',
          updated_at: '2026-05-24T00:00:00Z',
        }),
      ),
      http.get('*/v1/investing/summary', () =>
        HttpResponse.json({
          portfolio_value: '0',
          holdings_count: 0,
          cash_total: '0',
          currency_breakdown: {},
          daily_change: null,
          reporting_currency: 'USD',
          valuation_status: 'single_currency_native',
        }),
      ),
      http.get('*/v1/investing/performance/summary', () =>
        HttpResponse.json({
          total_gain_loss: '0.00',
          total_gain_loss_pct: '0.00',
          holdings_count: 0,
        }),
      ),
      http.get('*/v1/investing/instruments', () =>
        HttpResponse.json([
          {
            public_id: '44444444-4444-4444-4444-444444444444',
            symbol: 'VTI',
            name: 'Vanguard Total Market ETF',
            instrument_type: 'etf',
            company_id: null,
            is_active: true,
            created_at: '2026-05-24T00:00:00Z',
            updated_at: '2026-05-24T00:00:00Z',
          },
        ]),
      ),
      http.get('*/v1/investing/analytics/exposure', () =>
        HttpResponse.json({
          as_of_date: '2026-05-24',
          analysis_status: 'complete',
          currency: 'USD',
          fx_as_of: '2026-05-24T00:00:00Z',
          fx_rates_used: { GBP: '1.25' },
          snapshot_coverage: '1',
          staleness_days: 30,
          warnings: [],
          exposure: [
            {
              company_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
              company_name: 'Apple Inc',
              company_ticker: 'AAPL',
              direct_exposure: '300.00',
              lookthrough_exposure: '900.00',
            },
          ],
          total_direct_exposure: '300.00',
          total_lookthrough_exposure: '1000.00',
        }),
      ),
      http.get('*/v1/investing/analytics/overlap', () =>
        HttpResponse.json({
          as_of_date: '2026-05-24',
          analysis_status: 'complete',
          currency: 'USD',
          fx_as_of: '2026-05-24T00:00:00Z',
          fx_rates_used: { GBP: '1.25' },
          snapshot_coverage: '1',
          warnings: [],
          top_5_concentration_pct: '0.90',
          top_10_concentration_pct: '1.00',
          duplicate_exposure_index: '0.70',
          overlaps: [
            {
              company_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
              company_name: 'Apple Inc',
              company_ticker: 'AAPL',
              overlap_exposure: '900.00',
              portfolio_share: '0.90',
            },
          ],
        }),
      ),
    );

    renderWithQuery(<InvestingPage />);

    await screen.findByText('Investing');
    const analyticsTab = await screen.findByRole('tab', { name: 'Analytics' });
    analyticsTab.focus();
    fireEvent.keyDown(analyticsTab, { key: 'Enter', code: 'Enter' });

    expect(await screen.findByText('Exposure (Look-through)')).toBeInTheDocument();
    expect(await screen.findByText('Overlap')).toBeInTheDocument();
    expect(screen.getByTestId('investing-total-direct')).toHaveTextContent('$300.00');
    expect(screen.getByTestId('investing-total-lookthrough')).toHaveTextContent('$1,000.00');
    const aaplRows = await screen.findAllByText('AAPL');
    expect(aaplRows.length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText(/Top 5 concentration/)).toBeInTheDocument();
  });

  it('renders unit price, current value, gain/loss, and handles refresh and manual edit price actions', async () => {
    let refreshCalled = false;
    let submitPayload: {
      price_date: string;
      prices: Array<{ holding_public_id: string; unit_price: number }>;
    } | null = null;

    server.use(
      http.get('*/v1/investing/holdings', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'holding-aapl-id',
              symbol: 'AAPL',
              account_id: '11111111-1111-1111-1111-111111111111',
              account_name: 'Brokerage A',
              quantity: '10.00000000',
              avg_cost: '150.00',
              currency: 'USD',
              current_price: '180.00',
              current_value: '1800.00',
              gain_loss: '300.00',
              gain_loss_pct: '20.00',
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/investing/cash-balances', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/finance/accounts', () =>
        HttpResponse.json({
          items: [
            {
              public_id: '11111111-1111-1111-1111-111111111111',
              name: 'Brokerage A',
              account_type: 'brokerage',
              default_currency_code: 'USD',
              is_active: true,
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/finance/currencies', () =>
        HttpResponse.json([
          { code: 'USD', name: 'US Dollar', symbol: '$', minor_unit: 2, is_active: true },
        ]),
      ),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          reporting_currency_override_code: null,
          currency_display_preference_override: null,
          workspace_reporting_currency_code: 'USD',
          workspace_currency_display_preference: 'symbol',
          effective_reporting_currency_code: 'USD',
          effective_currency_display_preference: 'symbol',
          updated_at: '2026-05-24T00:00:00Z',
        }),
      ),
      http.get('*/v1/investing/summary', () =>
        HttpResponse.json({
          portfolio_value: '1800.00',
          holdings_count: 1,
          cash_total: '0',
          currency_breakdown: { USD: '1500.00' },
          daily_change: null,
          reporting_currency: 'USD',
          valuation_status: 'single_currency_native',
        }),
      ),
      http.get('*/v1/investing/instruments', () => HttpResponse.json([])),
      http.get('*/v1/investing/performance/summary', () =>
        HttpResponse.json({
          total_value: '1800.00',
          total_cost: '1500.00',
          total_gain_loss: '300.00',
          total_gain_loss_pct: '20.00',
          snapshot_date: '2026-05-24',
          currency: 'USD',
        }),
      ),
      http.post('*/v1/investing/prices/refresh', () => {
        refreshCalled = true;
        return HttpResponse.json({ updated: ['AAPL'] });
      }),
      http.post('*/v1/investing/prices', async ({ request }) => {
        submitPayload = (await request.json()) as {
          price_date: string;
          prices: Array<{ holding_public_id: string; unit_price: number }>;
        };
        return HttpResponse.json({ ok: true });
      }),
    );

    renderWithQuery(<InvestingPage />);

    // Wait for holding row to render
    const holdingRow = await screen.findByTestId('investing-holding-row-holding-aapl-id');
    expect(holdingRow).toBeInTheDocument();

    // Verify headers and row values
    expect(screen.getByText('Unit Price')).toBeInTheDocument();
    expect(screen.getByText('Current Value')).toBeInTheDocument();
    expect(screen.getByText('Gain / Loss')).toBeInTheDocument();

    // Holdings render in two responsive layouts (mobile cards + desktop table),
    // so per-holding values appear more than once in the DOM.
    expect(screen.getAllByText('$180.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$1,800.00').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId('investing-total-gain-loss')).toHaveTextContent('+$300.00 (+20.00%)');

    // Mobile sort control — the desktop layout sorts via column-header clicks,
    // which the card layout has no room for, so mobile gets a Sort by dropdown
    // plus a direction toggle that share the same sort state.
    expect(screen.getByTestId('investing-holdings-sort-mobile')).toBeInTheDocument();
    const sortDirToggle = screen.getByTestId('investing-holdings-sort-dir-mobile');
    expect(sortDirToggle).toHaveTextContent('Asc');
    fireEvent.click(sortDirToggle);
    expect(sortDirToggle).toHaveTextContent('Desc');

    // Test Refresh button
    const refreshBtn = screen.getByTestId('investing-refresh-prices-btn');
    fireEvent.click(refreshBtn);
    await waitFor(() => {
      expect(refreshCalled).toBe(true);
    });

    // Test Inline Price Edit
    const editBtn = screen.getByTestId('investing-edit-price-holding-aapl-id');
    fireEvent.click(editBtn);

    const priceInput = screen.getByTestId('investing-price-input-holding-aapl-id');
    expect(priceInput).toHaveValue(180);

    fireEvent.change(priceInput, { target: { value: '190.50' } });
    const saveBtn = screen.getByTestId('investing-save-price-holding-aapl-id');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(submitPayload).not.toBeNull();
    });
    expect(submitPayload!.prices[0]).toEqual({
      holding_public_id: 'holding-aapl-id',
      unit_price: 190.5,
    });
  });

  it('edits holding economics and linked asset type from the holdings table', async () => {
    let holdingPatchPayload: Record<string, unknown> | null = null;
    let instrumentPatchPayload: Record<string, unknown> | null = null;

    server.use(
      http.get('*/v1/investing/holdings', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'holding-vti-id',
              symbol: 'VTI',
              instrument_type: 'stock',
              account_id: '11111111-1111-1111-1111-111111111111',
              account_name: 'Brokerage A',
              quantity: '10.00000000',
              avg_cost: '150.00',
              currency: 'USD',
              current_price: '180.00',
              current_value: '1800.00',
              gain_loss: '300.00',
              gain_loss_pct: '20.00',
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/investing/cash-balances', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/finance/accounts', () =>
        HttpResponse.json({
          items: [
            {
              public_id: '11111111-1111-1111-1111-111111111111',
              name: 'Brokerage A',
              account_type: 'brokerage',
              default_currency_code: 'USD',
              is_active: true,
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/finance/currencies', () =>
        HttpResponse.json([
          { code: 'USD', name: 'US Dollar', symbol: '$', minor_unit: 2, is_active: true },
          { code: 'INR', name: 'Indian Rupee', symbol: 'Rs', minor_unit: 2, is_active: true },
        ]),
      ),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          reporting_currency_override_code: null,
          currency_display_preference_override: null,
          workspace_reporting_currency_code: 'USD',
          workspace_currency_display_preference: 'symbol',
          effective_reporting_currency_code: 'USD',
          effective_currency_display_preference: 'symbol',
          updated_at: '2026-05-24T00:00:00Z',
        }),
      ),
      http.get('*/v1/investing/summary', () =>
        HttpResponse.json({
          portfolio_value: '1800.00',
          holdings_count: 1,
          cash_total: '0',
          currency_breakdown: { USD: '1500.00' },
          daily_change: null,
          reporting_currency: 'USD',
          valuation_status: 'single_currency_native',
        }),
      ),
      http.get('*/v1/investing/performance/summary', () =>
        HttpResponse.json({
          total_value: '1800.00',
          total_cost: '1500.00',
          total_gain_loss: '300.00',
          total_gain_loss_pct: '20.00',
          snapshot_date: '2026-05-24',
          currency: 'USD',
        }),
      ),
      http.get('*/v1/investing/instruments', () =>
        HttpResponse.json([
          {
            public_id: 'instrument-vti-id',
            symbol: 'VTI',
            name: 'Vanguard Total Market ETF',
            instrument_type: 'stock',
            company_id: 'company-vti-id',
            is_active: true,
            created_at: '2026-05-24T00:00:00Z',
            updated_at: '2026-05-24T00:00:00Z',
          },
        ]),
      ),
      http.patch('*/v1/investing/holdings/holding-vti-id', async ({ request }) => {
        holdingPatchPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          public_id: 'holding-vti-id',
          symbol: 'VTI',
          instrument_type: 'stock',
          account_id: '11111111-1111-1111-1111-111111111111',
          account_name: 'Brokerage A',
          quantity: holdingPatchPayload.quantity,
          avg_cost: holdingPatchPayload.avg_cost,
          currency: holdingPatchPayload.currency,
          created_at: '2026-05-24T00:00:00Z',
          updated_at: '2026-05-24T00:00:00Z',
        });
      }),
      http.patch('*/v1/investing/instruments/instrument-vti-id', async ({ request }) => {
        instrumentPatchPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          public_id: 'instrument-vti-id',
          symbol: 'VTI',
          name: instrumentPatchPayload.name,
          instrument_type: instrumentPatchPayload.instrument_type,
          company_id: null,
          is_active: true,
          created_at: '2026-05-24T00:00:00Z',
          updated_at: '2026-05-24T00:00:00Z',
        });
      }),
    );

    renderWithQuery(<InvestingPage />);

    await screen.findByTestId('investing-holding-row-holding-vti-id');
    fireEvent.click(screen.getByTestId('investing-edit-holding-holding-vti-id'));

    fireEvent.change(await screen.findByTestId('investing-edit-holding-symbol'), {
      target: { value: 'PHARMABEES' },
    });
    fireEvent.change(screen.getByTestId('investing-edit-holding-quantity'), {
      target: { value: '12.5' },
    });
    fireEvent.change(screen.getByTestId('investing-edit-holding-avg-cost'), {
      target: { value: '155.75' },
    });

    fireEvent.click(screen.getByTestId('investing-edit-holding-instrument-type'));
    fireEvent.click(await screen.findByRole('option', { name: 'ETF' }));

    fireEvent.click(screen.getByTestId('investing-edit-holding-submit'));

    await waitFor(() => {
      expect(holdingPatchPayload).not.toBeNull();
    });
    expect(holdingPatchPayload).toEqual({
      symbol: 'PHARMABEES',
      quantity: 12.5,
      avg_cost: 155.75,
      currency: 'USD',
      instrument_type: 'etf',
    });
    expect(instrumentPatchPayload).toBeNull();
  });

  it('renames the symbol of an order-derived holding without sending quantity/avg_cost, with quantity/avg_cost disabled', async () => {
    let holdingPatchPayload: Record<string, unknown> | null = null;

    server.use(
      http.get('*/v1/investing/holdings', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'holding-order-derived-id',
              symbol: '122639',
              instrument_type: 'mutual_fund',
              account_id: '11111111-1111-1111-1111-111111111111',
              account_name: 'Brokerage A',
              quantity: '10.00000000',
              avg_cost: '80.00',
              currency: 'INR',
              source_type: 'order',
              current_price: '90.00',
              current_value: '900.00',
              gain_loss: '100.00',
              gain_loss_pct: '12.50',
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/investing/cash-balances', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/finance/accounts', () =>
        HttpResponse.json({
          items: [
            {
              public_id: '11111111-1111-1111-1111-111111111111',
              name: 'Brokerage A',
              account_type: 'brokerage',
              default_currency_code: 'USD',
              is_active: true,
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/finance/currencies', () =>
        HttpResponse.json([
          { code: 'USD', name: 'US Dollar', symbol: '$', minor_unit: 2, is_active: true },
          { code: 'INR', name: 'Indian Rupee', symbol: 'Rs', minor_unit: 2, is_active: true },
        ]),
      ),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          reporting_currency_override_code: null,
          currency_display_preference_override: null,
          workspace_reporting_currency_code: 'USD',
          workspace_currency_display_preference: 'symbol',
          effective_reporting_currency_code: 'USD',
          effective_currency_display_preference: 'symbol',
          updated_at: '2026-05-24T00:00:00Z',
        }),
      ),
      http.get('*/v1/investing/summary', () =>
        HttpResponse.json({
          portfolio_value: '900.00',
          holdings_count: 1,
          cash_total: '0',
          currency_breakdown: { INR: '900.00' },
          daily_change: null,
          reporting_currency: 'USD',
          valuation_status: 'single_currency_native',
        }),
      ),
      http.get('*/v1/investing/performance/summary', () =>
        HttpResponse.json({
          total_value: '900.00',
          total_cost: '800.00',
          total_gain_loss: '100.00',
          total_gain_loss_pct: '12.50',
          snapshot_date: '2026-05-24',
          currency: 'INR',
        }),
      ),
      http.get('*/v1/investing/instruments', () => HttpResponse.json([])),
      http.patch('*/v1/investing/holdings/holding-order-derived-id', async ({ request }) => {
        holdingPatchPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          public_id: 'holding-order-derived-id',
          symbol: holdingPatchPayload.symbol,
          instrument_type: holdingPatchPayload.instrument_type,
          account_id: '11111111-1111-1111-1111-111111111111',
          account_name: 'Brokerage A',
          quantity: '10.00000000',
          avg_cost: '80.00',
          currency: holdingPatchPayload.currency,
          source_type: 'order',
          created_at: '2026-05-24T00:00:00Z',
          updated_at: '2026-05-24T00:00:00Z',
        });
      }),
    );

    renderWithQuery(<InvestingPage />);

    await screen.findByTestId('investing-holding-row-holding-order-derived-id');
    fireEvent.click(screen.getByTestId('investing-edit-holding-holding-order-derived-id'));

    const quantityInput = await screen.findByTestId('investing-edit-holding-quantity');
    const avgCostInput = screen.getByTestId('investing-edit-holding-avg-cost');
    expect(quantityInput).toBeDisabled();
    expect(avgCostInput).toBeDisabled();

    fireEvent.change(screen.getByTestId('investing-edit-holding-symbol'), {
      target: { value: '122640' },
    });

    fireEvent.click(screen.getByTestId('investing-edit-holding-submit'));

    await waitFor(() => {
      expect(holdingPatchPayload).not.toBeNull();
    });
    expect(holdingPatchPayload).toEqual({
      symbol: '122640',
      currency: 'INR',
      instrument_type: 'mutual_fund',
    });
  });

  it('calculates converted table totals and shows portfolio value with date under multi-currency converted summary', async () => {
    server.use(
      http.get('*/v1/investing/holdings', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'holding-usd',
              symbol: 'AAPL',
              account_id: '11111111-1111-1111-1111-111111111111',
              account_name: 'Brokerage A',
              quantity: '10.00000000',
              avg_cost: '150.00',
              currency: 'USD',
              current_price: '180.00',
              current_value: '1800.00',
              gain_loss: '300.00',
              gain_loss_pct: '20.00',
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
            {
              public_id: 'holding-cad',
              symbol: 'SHOP',
              account_id: '11111111-1111-1111-1111-111111111111',
              account_name: 'Brokerage A',
              quantity: '20.00000000',
              avg_cost: '80.00',
              currency: 'CAD',
              current_price: '90.00',
              current_value: '1800.00',
              gain_loss: '200.00',
              gain_loss_pct: '12.50',
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
          ],
          total: 2,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/investing/cash-balances', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/finance/accounts', () =>
        HttpResponse.json({
          items: [
            {
              public_id: '11111111-1111-1111-1111-111111111111',
              name: 'Brokerage A',
              account_type: 'brokerage',
              default_currency_code: 'USD',
              is_active: true,
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/finance/currencies', () =>
        HttpResponse.json([
          { code: 'USD', name: 'US Dollar', symbol: '$', minor_unit: 2, is_active: true },
          { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', minor_unit: 2, is_active: true },
        ]),
      ),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          reporting_currency_override_code: null,
          currency_display_preference_override: null,
          workspace_reporting_currency_code: 'USD',
          workspace_currency_display_preference: 'symbol',
          effective_reporting_currency_code: 'USD',
          effective_currency_display_preference: 'symbol',
          updated_at: '2026-05-24T00:00:00Z',
        }),
      ),
      http.get('*/v1/investing/summary', () =>
        HttpResponse.json({
          portfolio_value: '2668.00',
          holdings_count: 2,
          cash_total: '0.00',
          currency_breakdown: { USD: '1500.00', CAD: '1600.00' },
          daily_change: null,
          reporting_currency: 'USD',
          valuation_status: 'converted_available',
          fx_rates_used: { CAD: '0.73' },
        }),
      ),
      http.get('*/v1/investing/performance/summary', () =>
        HttpResponse.json({
          total_value: '3114.00',
          total_cost: '2668.00',
          total_gain_loss: '446.00',
          total_gain_loss_pct: '16.72',
          snapshot_date: '2026-06-13',
          currency: 'USD',
          fx_rates_used: { CAD: '0.73' },
        }),
      ),
      http.get('*/v1/investing/instruments', () => HttpResponse.json([])),
    );

    renderWithQuery(<InvestingPage />);

    // Wait for the rows to render
    expect((await screen.findAllByText('AAPL')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('SHOP').length).toBeGreaterThanOrEqual(1);

    // Verify converted table footer totals:
    // Book Cost: 10 * 150 (USD) + 20 * 80 * 0.73 (CAD -> USD) = 1500 + 1168 = 2668.00 USD
    // Current Value: 10 * 180 (USD) + 20 * 90 * 0.73 (CAD -> USD) = 1800 + 1314 = 3114.00 USD
    expect(screen.getByTestId('investing-invested-value')).toHaveTextContent('$2,668.00');
    expect(screen.getAllByText('$3,114.00').length).toBe(2);

    // Verify Portfolio value card uses performance summary current market value and contains the snapshot date
    const portfolioCardHeader = screen.getByText(/Portfolio value \(as of 2026-06-13\)/i);
    expect(portfolioCardHeader).toBeInTheDocument();

    const portfolioCardValue = screen.getByTestId('investing-portfolio-value');
    expect(portfolioCardValue).toHaveTextContent('$3,114.00');
  });

  it('shows a holding\'s trade history even when the order is outside the main Orders list page', async () => {
    // Regression test: Trade History must call the dedicated unlimited
    // /orders/by-holding endpoint, not filter the paginated /orders list.
    // A historical order can fall off the (limited, occurred_at-desc-sorted)
    // /orders page while still being a valid part of a holding's history.
    server.use(
      http.get('*/v1/investing/holdings', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'holding-old-order-id',
              symbol: 'GMMPFAUDLR',
              account_id: '11111111-1111-1111-1111-111111111111',
              account_name: 'Groww',
              quantity: '2.00000000',
              avg_cost: '4540.00',
              currency: 'INR',
              current_price: '4540.00',
              current_value: '9080.00',
              gain_loss: '0.00',
              gain_loss_pct: '0.00',
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/investing/cash-balances', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/finance/accounts', () =>
        HttpResponse.json({
          items: [
            {
              public_id: '11111111-1111-1111-1111-111111111111',
              name: 'Groww',
              account_type: 'brokerage',
              default_currency_code: 'INR',
              is_active: true,
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/finance/currencies', () =>
        HttpResponse.json([
          { code: 'USD', name: 'US Dollar', symbol: '$', minor_unit: 2, is_active: true },
          { code: 'INR', name: 'Indian Rupee', symbol: 'Rs', minor_unit: 2, is_active: true },
        ]),
      ),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          reporting_currency_override_code: null,
          currency_display_preference_override: null,
          workspace_reporting_currency_code: 'USD',
          workspace_currency_display_preference: 'symbol',
          effective_reporting_currency_code: 'USD',
          effective_currency_display_preference: 'symbol',
          updated_at: '2026-05-24T00:00:00Z',
        }),
      ),
      http.get('*/v1/investing/summary', () =>
        HttpResponse.json({
          portfolio_value: null,
          holdings_count: 1,
          cash_total: null,
          currency_breakdown: { INR: '9080.00' },
          daily_change: null,
          reporting_currency: null,
          valuation_status: 'multi_currency_unconverted',
        }),
      ),
      http.get('*/v1/investing/performance/summary', () =>
        HttpResponse.json({
          total_value: '0',
          total_cost: '0',
          total_gain_loss: '0',
          total_gain_loss_pct: '0',
          snapshot_date: '2026-05-24',
          currency: 'USD',
        }),
      ),
      http.get('*/v1/investing/instruments', () => HttpResponse.json([])),
      // Simulate the order having fallen off the capped/paginated main list —
      // this is the exact condition that caused it to "vanish" in production.
      http.get('*/v1/investing/orders', () =>
        HttpResponse.json({ items: [], total: 250, limit: 50, offset: 0 }),
      ),
      // The dedicated by-holding endpoint has no limit, so it still returns it.
      http.get('*/v1/investing/orders/by-holding/GMMPFAUDLR', () =>
        HttpResponse.json([
          {
            public_id: 'order-old-id',
            account_id: '11111111-1111-1111-1111-111111111111',
            account_name: 'Groww',
            order_type: 'buy',
            symbol: 'GMMPFAUDLR',
            instrument_type: null,
            quantity: '2.00000000',
            price_per_unit: '4540.000000',
            gross_amount: '9080.00',
            brokerage_fee: '0.00',
            tax_amount: '0.00',
            other_fees: '0.00',
            net_amount: '9080.00',
            currency: 'INR',
            exchange_name: null,
            occurred_at: '2021-10-21T03:57:00Z',
            notes: null,
            realized_gain_loss: null,
            avg_cost_at_sale: null,
            source_type: 'manual',
            created_at: '2026-06-30T04:12:12.028065Z',
          },
        ]),
      ),
    );

    renderWithQuery(<InvestingPage />);

    await screen.findByTestId('investing-holding-row-holding-old-order-id');
    fireEvent.click(screen.getByTestId('investing-holding-trade-history-holding-old-order-id'));

    const row = await screen.findByTestId('investing-trade-history-row-order-old-id');
    expect(row).toHaveTextContent(/buy/i);
    expect(row).toHaveTextContent('2');
  });

  it('opens the Edit Order modal from Trade History without ever visiting the Orders tab', async () => {
    // Regression test: the Edit Order modal used to be nested inside
    // <TabsContent value="orders">, which Radix unmounts when the Orders
    // tab isn't active. Trade History opens from the Holdings tab, so
    // clicking Edit there set state but rendered nothing.
    server.use(
      http.get('*/v1/investing/holdings', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'holding-old-order-id',
              symbol: 'GMMPFAUDLR',
              account_id: '11111111-1111-1111-1111-111111111111',
              account_name: 'Groww',
              quantity: '2.00000000',
              avg_cost: '4540.00',
              currency: 'INR',
              current_price: '4540.00',
              current_value: '9080.00',
              gain_loss: '0.00',
              gain_loss_pct: '0.00',
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/investing/cash-balances', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/finance/accounts', () =>
        HttpResponse.json({
          items: [
            {
              public_id: '11111111-1111-1111-1111-111111111111',
              name: 'Groww',
              account_type: 'brokerage',
              default_currency_code: 'INR',
              is_active: true,
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/finance/currencies', () =>
        HttpResponse.json([
          { code: 'INR', name: 'Indian Rupee', symbol: 'Rs', minor_unit: 2, is_active: true },
        ]),
      ),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          reporting_currency_override_code: null,
          currency_display_preference_override: null,
          workspace_reporting_currency_code: 'USD',
          workspace_currency_display_preference: 'symbol',
          effective_reporting_currency_code: 'USD',
          effective_currency_display_preference: 'symbol',
          updated_at: '2026-05-24T00:00:00Z',
        }),
      ),
      http.get('*/v1/investing/summary', () =>
        HttpResponse.json({
          portfolio_value: null,
          holdings_count: 1,
          cash_total: null,
          currency_breakdown: { INR: '9080.00' },
          daily_change: null,
          reporting_currency: null,
          valuation_status: 'multi_currency_unconverted',
        }),
      ),
      http.get('*/v1/investing/performance/summary', () =>
        HttpResponse.json({
          total_value: '0',
          total_cost: '0',
          total_gain_loss: '0',
          total_gain_loss_pct: '0',
          snapshot_date: '2026-05-24',
          currency: 'USD',
        }),
      ),
      http.get('*/v1/investing/instruments', () => HttpResponse.json([])),
      http.get('*/v1/investing/orders', () =>
        HttpResponse.json({ items: [], total: 0, limit: 50, offset: 0 }),
      ),
      http.get('*/v1/investing/orders/by-holding/GMMPFAUDLR', () =>
        HttpResponse.json([
          {
            public_id: 'order-old-id',
            account_id: '11111111-1111-1111-1111-111111111111',
            account_name: 'Groww',
            order_type: 'buy',
            symbol: 'GMMPFAUDLR',
            instrument_type: null,
            quantity: '2.00000000',
            price_per_unit: '4540.000000',
            gross_amount: '9080.00',
            brokerage_fee: '0.00',
            tax_amount: '0.00',
            other_fees: '0.00',
            net_amount: '9080.00',
            currency: 'INR',
            exchange_name: null,
            occurred_at: '2021-10-21T03:57:00Z',
            notes: null,
            realized_gain_loss: null,
            avg_cost_at_sale: null,
            source_type: 'manual',
            created_at: '2026-06-30T04:12:12.028065Z',
          },
        ]),
      ),
    );

    renderWithQuery(<InvestingPage />);

    // Stay on the Holdings tab (the default) the whole time — never click
    // the Orders tab trigger, which is what makes this a regression test.
    await screen.findByTestId('investing-holding-row-holding-old-order-id');
    fireEvent.click(screen.getByTestId('investing-holding-trade-history-holding-old-order-id'));

    await screen.findByTestId('investing-trade-history-row-order-old-id');
    fireEvent.click(screen.getByTestId('investing-trade-history-edit-order-old-id'));

    expect(await screen.findByText('Edit Order — GMMPFAUDLR')).toBeInTheDocument();
  });

  it('blocks Edit Order submission and shows an inline error for invalid numeric fees, and for an unparsable trade date', async () => {
    let updateCalled = false;
    server.use(
      http.get('*/v1/investing/holdings', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'holding-1',
              symbol: 'AAPL',
              account_id: '11111111-1111-1111-1111-111111111111',
              account_name: 'Groww',
              quantity: '2.00000000',
              avg_cost: '100.00',
              currency: 'USD',
              current_price: '100.00',
              current_value: '200.00',
              gain_loss: '0.00',
              gain_loss_pct: '0.00',
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/investing/cash-balances', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/finance/accounts', () =>
        HttpResponse.json({
          items: [
            {
              public_id: '11111111-1111-1111-1111-111111111111',
              name: 'Groww',
              account_type: 'brokerage',
              default_currency_code: 'USD',
              is_active: true,
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/finance/currencies', () =>
        HttpResponse.json([
          { code: 'USD', name: 'US Dollar', symbol: '$', minor_unit: 2, is_active: true },
        ]),
      ),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          reporting_currency_override_code: null,
          currency_display_preference_override: null,
          workspace_reporting_currency_code: 'USD',
          workspace_currency_display_preference: 'symbol',
          effective_reporting_currency_code: 'USD',
          effective_currency_display_preference: 'symbol',
          updated_at: '2026-05-24T00:00:00Z',
        }),
      ),
      http.get('*/v1/investing/summary', () =>
        HttpResponse.json({
          portfolio_value: '200.00',
          holdings_count: 1,
          cash_total: null,
          currency_breakdown: { USD: '200.00' },
          daily_change: null,
          reporting_currency: 'USD',
          valuation_status: 'single_currency_native',
        }),
      ),
      http.get('*/v1/investing/performance/summary', () =>
        HttpResponse.json({
          total_value: '200',
          total_cost: '200',
          total_gain_loss: '0',
          total_gain_loss_pct: '0',
          snapshot_date: '2026-05-24',
          currency: 'USD',
        }),
      ),
      http.get('*/v1/investing/instruments', () => HttpResponse.json([])),
      http.get('*/v1/investing/orders', () =>
        HttpResponse.json({ items: [], total: 0, limit: 50, offset: 0 }),
      ),
      http.get('*/v1/investing/orders/by-holding/AAPL', () =>
        HttpResponse.json([
          {
            public_id: 'order-1',
            account_id: '11111111-1111-1111-1111-111111111111',
            account_name: 'Groww',
            order_type: 'buy',
            symbol: 'AAPL',
            instrument_type: null,
            quantity: '2.00000000',
            price_per_unit: '100.000000',
            gross_amount: '200.00',
            brokerage_fee: '0.00',
            tax_amount: '0.00',
            other_fees: '0.00',
            net_amount: '200.00',
            currency: 'USD',
            exchange_name: null,
            occurred_at: '2026-05-24T00:00:00Z',
            notes: null,
            realized_gain_loss: null,
            avg_cost_at_sale: null,
            source_type: 'manual',
            created_at: '2026-06-30T04:12:12.028065Z',
          },
        ]),
      ),
      http.patch('*/v1/investing/orders/order-1', () => {
        updateCalled = true;
        return HttpResponse.json({});
      }),
    );

    renderWithQuery(<InvestingPage />);

    await screen.findByTestId('investing-holding-row-holding-1');
    fireEvent.click(screen.getByTestId('investing-holding-trade-history-holding-1'));

    await screen.findByTestId('investing-trade-history-row-order-1');
    fireEvent.click(screen.getByTestId('investing-trade-history-edit-order-1'));

    const modalHeading = await screen.findByText('Edit Order — AAPL');
    const modal = modalHeading.closest('[role="dialog"]') as HTMLElement;
    expect(modal).not.toBeNull();
    const form = modal.querySelector('form') as HTMLFormElement;
    expect(form).not.toBeNull();

    // Invalid brokerage fee should block submission with an inline error.
    const brokerageFeeLabel = within(modal).getByText('Brokerage fee');
    const brokerageFeeInput = brokerageFeeLabel.nextElementSibling as HTMLInputElement;
    fireEvent.change(brokerageFeeInput, { target: { value: '-5' } });
    fireEvent.submit(form);

    expect(await screen.findByText('Brokerage fee must be a non-negative number.')).toBeInTheDocument();
    expect(updateCalled).toBe(false);

    // Fix the fee, but break the trade date instead -- still should not submit.
    fireEvent.change(brokerageFeeInput, { target: { value: '0' } });
    const dateLabel = within(modal).getByText('Trade date & time');
    const dateInput = dateLabel.nextElementSibling as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '' } });
    fireEvent.submit(form);

    expect(await screen.findByText('Trade date & time is invalid.')).toBeInTheDocument();
    expect(updateCalled).toBe(false);
  });

  it('requires confirmation before deleting a holding, and does not call delete until confirmed', async () => {
    let deleteCalled = false;

    server.use(
      http.get('*/v1/investing/holdings', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'holding-aapl-id',
              symbol: 'AAPL',
              account_id: '11111111-1111-1111-1111-111111111111',
              account_name: 'Brokerage A',
              quantity: '10.00000000',
              avg_cost: '150.00',
              currency: 'USD',
              source_type: 'imported',
              current_price: '180.00',
              current_value: '1800.00',
              gain_loss: '300.00',
              gain_loss_pct: '20.00',
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/investing/cash-balances', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/finance/accounts', () =>
        HttpResponse.json({
          items: [
            {
              public_id: '11111111-1111-1111-1111-111111111111',
              name: 'Brokerage A',
              account_type: 'brokerage',
              default_currency_code: 'USD',
              is_active: true,
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/finance/currencies', () =>
        HttpResponse.json([
          { code: 'USD', name: 'US Dollar', symbol: '$', minor_unit: 2, is_active: true },
        ]),
      ),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          reporting_currency_override_code: null,
          currency_display_preference_override: null,
          workspace_reporting_currency_code: 'USD',
          workspace_currency_display_preference: 'symbol',
          effective_reporting_currency_code: 'USD',
          effective_currency_display_preference: 'symbol',
          updated_at: '2026-05-24T00:00:00Z',
        }),
      ),
      http.get('*/v1/investing/summary', () =>
        HttpResponse.json({
          portfolio_value: '1800.00',
          holdings_count: 1,
          cash_total: '0',
          currency_breakdown: { USD: '1500.00' },
          daily_change: null,
          reporting_currency: 'USD',
          valuation_status: 'single_currency_native',
        }),
      ),
      http.get('*/v1/investing/instruments', () => HttpResponse.json([])),
      http.get('*/v1/investing/performance/summary', () =>
        HttpResponse.json({
          total_value: '1800.00',
          total_cost: '1500.00',
          total_gain_loss: '300.00',
          total_gain_loss_pct: '20.00',
          snapshot_date: '2026-05-24',
          currency: 'USD',
        }),
      ),
      http.delete('*/v1/investing/holdings/holding-aapl-id', () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderWithQuery(<InvestingPage />);

    await screen.findByTestId('investing-holding-row-holding-aapl-id');
    fireEvent.click(screen.getAllByTitle('Delete holding')[0]);

    // Clicking the row action only opens a confirmation dialog — no request yet
    expect(deleteCalled).toBe(false);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/delete the AAPL holding/i);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(deleteCalled).toBe(true);
    });
  });

  it('hides zero book value holdings when the toggle is checked', async () => {
    server.use(
      http.get('*/v1/investing/holdings', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'holding-live-id',
              symbol: 'AAPL',
              account_id: '11111111-1111-1111-1111-111111111111',
              account_name: 'Brokerage A',
              quantity: '10.00000000',
              avg_cost: '150.00',
              currency: 'USD',
              current_price: '180.00',
              current_value: '1800.00',
              book_value: '1500.00',
              gain_loss: '300.00',
              gain_loss_pct: '20.00',
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
            {
              public_id: 'holding-zeroed-out-id',
              symbol: 'MSFT',
              account_id: '11111111-1111-1111-1111-111111111111',
              account_name: 'Brokerage A',
              quantity: '0.00000000',
              avg_cost: '300.00',
              currency: 'USD',
              current_price: '0',
              current_value: '0',
              book_value: '0',
              gain_loss: '0',
              gain_loss_pct: '0',
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
          ],
          total: 2,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/investing/cash-balances', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/finance/accounts', () =>
        HttpResponse.json({
          items: [
            {
              public_id: '11111111-1111-1111-1111-111111111111',
              name: 'Brokerage A',
              account_type: 'brokerage',
              default_currency_code: 'USD',
              is_active: true,
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/finance/currencies', () =>
        HttpResponse.json([
          { code: 'USD', name: 'US Dollar', symbol: '$', minor_unit: 2, is_active: true },
        ]),
      ),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          reporting_currency_override_code: null,
          currency_display_preference_override: null,
          workspace_reporting_currency_code: 'USD',
          workspace_currency_display_preference: 'symbol',
          effective_reporting_currency_code: 'USD',
          effective_currency_display_preference: 'symbol',
          updated_at: '2026-05-24T00:00:00Z',
        }),
      ),
      http.get('*/v1/investing/summary', () =>
        HttpResponse.json({
          portfolio_value: '1800.00',
          holdings_count: 2,
          cash_total: '0',
          currency_breakdown: { USD: '1500.00' },
          daily_change: null,
          reporting_currency: 'USD',
          valuation_status: 'single_currency_native',
        }),
      ),
      http.get('*/v1/investing/instruments', () => HttpResponse.json([])),
      http.get('*/v1/investing/performance/summary', () =>
        HttpResponse.json({
          total_value: '1800.00',
          total_cost: '1500.00',
          total_gain_loss: '300.00',
          total_gain_loss_pct: '20.00',
          snapshot_date: '2026-05-24',
          currency: 'USD',
        }),
      ),
    );

    renderWithQuery(<InvestingPage />);

    await screen.findByTestId('investing-holding-row-holding-live-id');
    expect(screen.getByTestId('investing-holding-row-holding-zeroed-out-id')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('investing-holdings-hide-zero-book-value'));

    expect(screen.getByTestId('investing-holding-row-holding-live-id')).toBeInTheDocument();
    expect(screen.queryByTestId('investing-holding-row-holding-zeroed-out-id')).not.toBeInTheDocument();
  });

  it('shows the account name for each order in the Orders tab', async () => {
    server.use(
      http.get('*/v1/investing/holdings', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/investing/cash-balances', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/finance/accounts', () =>
        HttpResponse.json({
          items: [
            {
              public_id: '11111111-1111-1111-1111-111111111111',
              name: 'Groww',
              account_type: 'brokerage',
              default_currency_code: 'INR',
              is_active: true,
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
            {
              public_id: '22222222-2222-2222-2222-222222222222',
              name: 'Zerodha',
              account_type: 'brokerage',
              default_currency_code: 'INR',
              is_active: true,
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
          ],
          total: 2,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/finance/currencies', () =>
        HttpResponse.json([
          { code: 'INR', name: 'Indian Rupee', symbol: 'Rs', minor_unit: 2, is_active: true },
        ]),
      ),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          reporting_currency_override_code: null,
          currency_display_preference_override: null,
          workspace_reporting_currency_code: 'USD',
          workspace_currency_display_preference: 'symbol',
          effective_reporting_currency_code: 'USD',
          effective_currency_display_preference: 'symbol',
          updated_at: '2026-05-24T00:00:00Z',
        }),
      ),
      http.get('*/v1/investing/summary', () =>
        HttpResponse.json({
          portfolio_value: null,
          holdings_count: 0,
          cash_total: null,
          currency_breakdown: {},
          daily_change: null,
          reporting_currency: null,
          valuation_status: 'single_currency_native',
        }),
      ),
      http.get('*/v1/investing/performance/summary', () =>
        HttpResponse.json({
          total_value: '0',
          total_cost: '0',
          total_gain_loss: '0',
          total_gain_loss_pct: '0',
          snapshot_date: '2026-05-24',
          currency: 'USD',
        }),
      ),
      http.get('*/v1/investing/instruments', () => HttpResponse.json([])),
      http.get('*/v1/investing/orders', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'order-groww-id',
              account_id: '11111111-1111-1111-1111-111111111111',
              account_name: 'Groww',
              order_type: 'buy',
              symbol: 'GMMPFAUDLR',
              instrument_type: null,
              quantity: '2.00000000',
              price_per_unit: '4540.000000',
              gross_amount: '9080.00',
              brokerage_fee: '0.00',
              tax_amount: '0.00',
              other_fees: '0.00',
              net_amount: '9080.00',
              currency: 'INR',
              exchange_name: null,
              occurred_at: '2021-10-21T03:57:00Z',
              notes: null,
              realized_gain_loss: null,
              avg_cost_at_sale: null,
              source_type: 'manual',
              created_at: '2026-06-30T04:12:12.028065Z',
            },
            {
              public_id: 'order-zerodha-id',
              account_id: '22222222-2222-2222-2222-222222222222',
              account_name: 'Zerodha',
              order_type: 'buy',
              symbol: 'GMMPFAUDLR',
              instrument_type: null,
              quantity: '1.00000000',
              price_per_unit: '4500.000000',
              gross_amount: '4500.00',
              brokerage_fee: '0.00',
              tax_amount: '0.00',
              other_fees: '0.00',
              net_amount: '4500.00',
              currency: 'INR',
              exchange_name: null,
              occurred_at: '2022-01-15T03:57:00Z',
              notes: null,
              realized_gain_loss: null,
              avg_cost_at_sale: null,
              source_type: 'manual',
              created_at: '2026-06-30T04:12:12.028065Z',
            },
          ],
          total: 2,
          limit: 50,
          offset: 0,
        }),
      ),
    );

    renderWithQuery(<InvestingPage />);

    await screen.findByText('Investing');
    const ordersTab = screen.getByTestId('investing-tab-orders');
    ordersTab.focus();
    fireEvent.keyDown(ordersTab, { key: 'Enter', code: 'Enter' });

    const growwRow = await screen.findByTestId('investing-order-row-order-groww-id');
    expect(growwRow).toHaveTextContent('Groww');
    const zerodhaRow = await screen.findByTestId('investing-order-row-order-zerodha-id');
    expect(zerodhaRow).toHaveTextContent('Zerodha');
  });

  it('surfaces transfers on the unified Cash tab with a link to manage them in Spending', async () => {
    server.use(
      http.get('*/v1/investing/holdings', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/investing/cash-balances', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/finance/accounts', () =>
        HttpResponse.json({
          items: [
            {
              public_id: '11111111-1111-1111-1111-111111111111',
              name: 'Groww',
              account_type: 'brokerage',
              default_currency_code: 'INR',
              is_active: true,
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/finance/currencies', () =>
        HttpResponse.json([
          { code: 'INR', name: 'Indian Rupee', symbol: 'Rs', minor_unit: 2, is_active: true },
        ]),
      ),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          reporting_currency_override_code: null,
          currency_display_preference_override: null,
          workspace_reporting_currency_code: 'USD',
          workspace_currency_display_preference: 'symbol',
          effective_reporting_currency_code: 'USD',
          effective_currency_display_preference: 'symbol',
          updated_at: '2026-05-24T00:00:00Z',
        }),
      ),
      http.get('*/v1/investing/summary', () =>
        HttpResponse.json({
          portfolio_value: null,
          holdings_count: 0,
          cash_total: null,
          currency_breakdown: {},
          daily_change: null,
          reporting_currency: null,
          valuation_status: 'single_currency_native',
        }),
      ),
      http.get('*/v1/investing/performance/summary', () =>
        HttpResponse.json({
          total_value: '0',
          total_cost: '0',
          total_gain_loss: '0',
          total_gain_loss_pct: '0',
          snapshot_date: '2026-05-24',
          currency: 'USD',
        }),
      ),
      http.get('*/v1/investing/instruments', () => HttpResponse.json([])),
      http.get('*/v1/investing/orders', () =>
        HttpResponse.json({ items: [], total: 0, limit: 50, offset: 0 }),
      ),
      http.get('*/v1/finance/transfers', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'transfer-1',
              from_module: 'spending',
              to_module: 'investing',
              from_account_id: 1,
              to_account_id: 2,
              from_account_public_id: '99999999-9999-9999-9999-999999999999',
              to_account_public_id: '11111111-1111-1111-1111-111111111111',
              from_account_name: 'HDFC Bank',
              to_account_name: 'Groww',
              from_account_type: 'bank',
              to_account_type: 'brokerage',
              from_currency_code: 'INR',
              to_currency_code: 'INR',
              gross_amount: '50000.00',
              fx_rate_used: null,
              fx_fee_amount: '0.00',
              platform_fee_amount: '0.00',
              tax_amount: '0.00',
              net_amount_received: '50000.00',
              occurred_at: '2026-06-01T00:00:00Z',
              notes: null,
              created_at: '2026-06-01T00:00:00Z',
              updated_at: '2026-06-01T00:00:00Z',
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
    );

    renderWithQuery(<InvestingPage />);

    await screen.findByText('Investing');
    const cashTab = screen.getByTestId('investing-tab-cash');
    cashTab.focus();
    fireEvent.keyDown(cashTab, { key: 'Enter', code: 'Enter' });

    const transferRow = await screen.findByTestId('investing-transfer-row-transfer-1');
    expect(transferRow).toHaveTextContent('HDFC Bank');
    expect(transferRow).toHaveTextContent('Groww');
    expect(screen.getByTestId('investing-transfers-manage-link')).toHaveAttribute('href', '/spending?tab=ledger');
  });

  it('opens the Orders tab and the Place Order modal directly from a ?tab=orders&order=1 deep link', async () => {
    server.use(
      http.get('*/v1/investing/holdings', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/investing/cash-balances', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/finance/accounts', () =>
        HttpResponse.json({
          items: [
            {
              public_id: '11111111-1111-1111-1111-111111111111',
              name: 'Groww',
              account_type: 'brokerage',
              default_currency_code: 'INR',
              is_active: true,
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/finance/currencies', () =>
        HttpResponse.json([
          { code: 'INR', name: 'Indian Rupee', symbol: 'Rs', minor_unit: 2, is_active: true },
        ]),
      ),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          reporting_currency_override_code: null,
          currency_display_preference_override: null,
          workspace_reporting_currency_code: 'USD',
          workspace_currency_display_preference: 'symbol',
          effective_reporting_currency_code: 'USD',
          effective_currency_display_preference: 'symbol',
          updated_at: '2026-05-24T00:00:00Z',
        }),
      ),
      http.get('*/v1/investing/summary', () =>
        HttpResponse.json({
          portfolio_value: null,
          holdings_count: 0,
          cash_total: null,
          currency_breakdown: {},
          daily_change: null,
          reporting_currency: null,
          valuation_status: 'single_currency_native',
        }),
      ),
      http.get('*/v1/investing/performance/summary', () =>
        HttpResponse.json({
          total_value: '0',
          total_cost: '0',
          total_gain_loss: '0',
          total_gain_loss_pct: '0',
          snapshot_date: '2026-05-24',
          currency: 'USD',
        }),
      ),
      http.get('*/v1/investing/instruments', () => HttpResponse.json([])),
      http.get('*/v1/investing/orders', () =>
        HttpResponse.json({ items: [], total: 0, limit: 50, offset: 0 }),
      ),
      http.get('*/v1/finance/transfers', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
    );

    renderAtPath(<InvestingPage />, '/investing?tab=orders&order=1');

    expect(await screen.findByTestId('investing-orders-heading')).toBeInTheDocument();
    expect(await screen.findByTestId('order-symbol')).toBeInTheDocument();
  });

  it('opens the Place Order modal when the "Place your first order" CTA is clicked without a full remount', async () => {
    // Regression test: the deep-link useEffect must react to search-param
    // changes on an already-mounted InvestingPage (in-app navigation via the
    // Holdings empty-state CTA), not only run once on initial mount.
    server.use(
      http.get('*/v1/investing/holdings', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/investing/cash-balances', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/finance/accounts', () =>
        HttpResponse.json({
          items: [
            {
              public_id: '11111111-1111-1111-1111-111111111111',
              name: 'Groww',
              account_type: 'brokerage',
              default_currency_code: 'INR',
              is_active: true,
              created_at: '2026-05-24T00:00:00Z',
              updated_at: '2026-05-24T00:00:00Z',
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/finance/currencies', () =>
        HttpResponse.json([
          { code: 'INR', name: 'Indian Rupee', symbol: 'Rs', minor_unit: 2, is_active: true },
        ]),
      ),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          reporting_currency_override_code: null,
          currency_display_preference_override: null,
          workspace_reporting_currency_code: 'USD',
          workspace_currency_display_preference: 'symbol',
          effective_reporting_currency_code: 'USD',
          effective_currency_display_preference: 'symbol',
          updated_at: '2026-05-24T00:00:00Z',
        }),
      ),
      http.get('*/v1/investing/summary', () =>
        HttpResponse.json({
          portfolio_value: null,
          holdings_count: 0,
          cash_total: null,
          currency_breakdown: {},
          daily_change: null,
          reporting_currency: null,
          valuation_status: 'single_currency_native',
        }),
      ),
      http.get('*/v1/investing/performance/summary', () =>
        HttpResponse.json({
          total_value: '0',
          total_cost: '0',
          total_gain_loss: '0',
          total_gain_loss_pct: '0',
          snapshot_date: '2026-05-24',
          currency: 'USD',
        }),
      ),
      http.get('*/v1/investing/instruments', () => HttpResponse.json([])),
      http.get('*/v1/investing/orders', () =>
        HttpResponse.json({ items: [], total: 0, limit: 50, offset: 0 }),
      ),
      http.get('*/v1/finance/transfers', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
    );

    renderAtPath(<InvestingPage />, '/investing');

    const placeOrderLinks = await screen.findAllByRole('link', { name: /place your first order/i });
    fireEvent.click(placeOrderLinks[0]);

    expect(await screen.findByTestId('investing-orders-heading')).toBeInTheDocument();
    expect(await screen.findByTestId('order-symbol')).toBeInTheDocument();
  });
});
