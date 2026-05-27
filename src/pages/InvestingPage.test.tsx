import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

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
      http.get('*/v1/investing/instruments', () => HttpResponse.json([])),
    );

    renderWithQuery(<InvestingPage />);

    expect(await screen.findByText('Investing')).toBeInTheDocument();
    const naValues = await screen.findAllByText('N/A');
    expect(naValues.length).toBeGreaterThan(0);
    expect(screen.getByText(/Multiple currencies detected/)).toBeInTheDocument();
    expect(screen.getByText('Not configured')).toBeInTheDocument();
  });

  it('creates an account and submits a holding using selected account/currency', async () => {
    let accountList = {
      items: [] as Array<{
        public_id: string;
        name: string;
        account_type: 'bank' | 'brokerage' | 'wallet';
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
      http.get('*/v1/investing/instruments', () => HttpResponse.json([])),
      http.post('*/v1/finance/accounts', async ({ request }) => {
        const body = (await request.json()) as {
          name: string;
          account_type: 'bank' | 'brokerage' | 'wallet';
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
    fireEvent.click(screen.getByRole('button', { name: 'Add holding' }));

    await waitFor(() => {
      expect(holdingPayload).not.toBeNull();
    });
    expect(holdingPayload).toMatchObject({
      symbol: 'AAPL',
      account_name: 'Primary Brokerage',
      quantity: 10,
      avg_cost: 150.25,
      currency: 'USD',
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
    const analyticsTab = await screen.findByRole('tab', { name: 'Look-through Analytics' });
    analyticsTab.focus();
    fireEvent.keyDown(analyticsTab, { key: 'Enter', code: 'Enter' });

    expect(await screen.findByText('Exposure (Look-through)')).toBeInTheDocument();
    expect(await screen.findByText('Overlap')).toBeInTheDocument();
    const aaplRows = await screen.findAllByText('AAPL');
    expect(aaplRows.length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText(/Top 5 concentration/)).toBeInTheDocument();
  });
});
