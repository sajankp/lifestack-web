import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '../test/setup';
import { ToastProvider } from '../components/ui/toast';
import { MoneyFlowPage } from './MoneyFlowPage';

const renderMoneyFlow = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/money']}>
          <Routes>
            <Route path="/money" element={<MoneyFlowPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
};

describe('MoneyFlowPage', () => {
  it('correctly handles multi-currency brokerage holdings and converts to reporting currency on initial load', async () => {
    server.use(
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          effective_locale: 'en-US',
          effective_decimal_places: 2,
          effective_currency_display_preference: 'symbol',
        }),
      ),
      http.get('*/v1/finance/accounts', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'acc-bank-inr',
              name: 'HDFC Savings',
              account_type: 'bank',
              default_currency_code: 'INR',
              is_active: true,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
            {
              public_id: 'acc-brokerage-usd',
              name: 'Charles Schwab',
              account_type: 'brokerage',
              default_currency_code: 'USD',
              is_active: true,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
            {
              public_id: 'acc-brokerage-inr',
              name: 'Zerodha Demat',
              account_type: 'brokerage',
              default_currency_code: 'INR',
              is_active: true,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
          ],
          total: 3,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/finance/net-worth', () =>
        HttpResponse.json({
          reporting_currency: 'INR',
          spending_accounts: [
            {
              account_public_id: 'acc-bank-inr',
              account_name: 'HDFC Savings',
              account_type: 'bank',
              currency_code: 'INR',
              balance: '50000.00',
              balance_in_reporting_currency: '50000.00',
            },
          ],
          spending_total: '50000.00',
          investing_accounts: [
            {
              account_public_id: 'acc-brokerage-usd',
              account_name: 'Charles Schwab',
              currency_code: 'USD',
              balance: '500.00',
              balance_in_reporting_currency: '42000.00',
            },
            {
              account_public_id: 'acc-brokerage-inr',
              account_name: 'Zerodha Demat',
              currency_code: 'INR',
              balance: '10000.00',
              balance_in_reporting_currency: '10000.00',
            },
          ],
          investing_cash_total: '52000.00',
          holdings_value: '104000.00',
          investing_total: '156000.00',
          total_net_worth: '206000.00',
          valuation_status: 'ok',
          fx_as_of: '2026-09-26T00:00:00Z',
        }),
      ),
      http.get('*/v1/investing/holdings', ({ request }) => {
        const url = new URL(request.url);
        const limit = Number(url.searchParams.get('limit') ?? '50');
        if (limit > 200) {
          return new HttpResponse(JSON.stringify({ detail: 'limit must be <= 200' }), {
            status: 422,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return HttpResponse.json({
          items: [
            {
              public_id: 'h-aapl',
              symbol: 'AAPL',
              instrument_type: 'stock',
              account_id: 'acc-brokerage-usd',
              account_name: 'Charles Schwab',
              currency: 'USD',
              quantity: '10',
              avg_cost: '100.00',
              current_price: '100.00',
              current_value: '1000.00',
              book_value: '1000.00',
              gain_loss: '0',
              gain_loss_pct: '0',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
            {
              public_id: 'h-rel',
              symbol: 'RELIANCE',
              instrument_type: 'stock',
              account_id: 'acc-brokerage-inr',
              account_name: 'Zerodha Demat',
              currency: 'INR',
              quantity: '10',
              avg_cost: '2000.00',
              current_price: '2000.00',
              current_value: '20000.00',
              book_value: '20000.00',
              gain_loss: '0',
              gain_loss_pct: '0',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
          ],
          total: 2,
          limit: 200,
          offset: 0,
        });
      }),
      http.get('*/v1/investing/summary', () =>
        HttpResponse.json({
          portfolio_value: '104000.00',
          holdings_count: 2,
          cash_total: '52000.00',
          currency_breakdown: { USD: '84000.00', INR: '20000.00' },
          daily_change: '0',
          reporting_currency: 'INR',
          fx_rates_used: { USD: '84.0' },
          valuation_status: 'ok',
        }),
      ),
      http.get('*/v1/finance/activity-feed', () =>
        HttpResponse.json({
          items: [],
          total: 0,
          limit: 50,
          offset: 0,
        }),
      ),
    );

    renderMoneyFlow();

    // Verify Hero Metrics rendered in reporting currency
    expect(await screen.findByText('Total Liquid Cash')).toBeInTheDocument();
    expect(screen.getByText('Brokerage Cash Balance')).toBeInTheDocument();
    expect(screen.getByText('Total Liquid & Invested')).toBeInTheDocument();

    // Check Brokerage Account Holdings in Lane 3
    expect(await screen.findByText('Charles Schwab Holdings')).toBeInTheDocument();
    expect(screen.getByText('Zerodha Demat Holdings')).toBeInTheDocument();

    // Charles Schwab card displays native USD $1,000.00 and converted INR ≈ ₹84,000.00
    expect(await screen.findByText('$1,000.00')).toBeInTheDocument();
    expect(await screen.findByText(/≈.*84,000.00/)).toBeInTheDocument();

    // Zerodha Demat card displays native INR ₹20,000.00
    expect(screen.getByText('₹20,000.00')).toBeInTheDocument();
  });
});
