import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '../test/setup';
import { ToastProvider } from '../components/ui/toast';
import { MoneyFlowPage } from './MoneyFlowPage';

const renderMoneyFlow = (initialUrl = '/money') => {
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
        <MemoryRouter initialEntries={[initialUrl]}>
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

  it('supports adding a new transaction from the top-level PageHero action', async () => {
    let createdPayload: unknown = null;

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
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/finance/net-worth', () =>
        HttpResponse.json({
          reporting_currency: 'INR',
          spending_accounts: [],
          spending_total: '0.00',
          investing_accounts: [],
          investing_cash_total: '0.00',
          holdings_value: '0.00',
          total_net_worth: '0.00',
          valuation_status: 'ok',
        }),
      ),
      http.get('*/v1/finance/net-worth/history', () => HttpResponse.json([])),
      http.get('*/v1/investing/holdings', () => HttpResponse.json({ items: [], total: 0 })),
      http.get('*/v1/investing/summary', () =>
        HttpResponse.json({
          portfolio_value: '0.00',
          reporting_currency: 'INR',
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
      http.get('*/v1/spending/categories', () =>
        HttpResponse.json({
          items: [{ public_id: 'cat-food', name: 'Food & Dining' }],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/spending/tags', () =>
        HttpResponse.json({
          items: [],
          total: 0,
          limit: 100,
          offset: 0,
        }),
      ),
      http.post('*/v1/spending/transactions', async ({ request }) => {
        createdPayload = await request.json();
        return HttpResponse.json({
          public_id: 'tx-new-1',
          amount: 250,
          type: 'expense',
          category_id: 'cat-food',
          account_id: 'acc-bank-inr',
          occurred_at: '2026-09-26T00:00:00.000Z',
          description: 'Lunch with team',
          tags: [],
        });
      }),
    );

    const { fireEvent, waitFor } = await import('@testing-library/react');
    renderMoneyFlow();

    // Click "+ Transaction" in header
    const addBtn = await screen.findByText('+ Transaction');
    fireEvent.click(addBtn);

    // Modal opens
    expect(await screen.findByText('New Transaction')).toBeInTheDocument();

    // Fill amount and description
    const amountInput = screen.getByTestId('transaction-amount-input');
    fireEvent.change(amountInput, { target: { value: '250.00' } });

    const descInput = screen.getByTestId('transaction-description-input');
    fireEvent.change(descInput, { target: { value: 'Lunch with team' } });

    // Submit form once ready
    const submitBtn = screen.getByTestId('transaction-submit-btn');
    await waitFor(() => expect(submitBtn).not.toBeDisabled());
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createdPayload).toEqual(
        expect.objectContaining({
          amount: 250,
          type: 'expense',
          category_id: 'cat-food',
          account_id: 'acc-bank-inr',
          description: 'Lunch with team',
        }),
      );
    });
  });

  it('supports editing and deleting transactions from the unified activity stream', async () => {
    let patchedPayload: unknown = null;
    let deletedId: string | null = null;

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
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/finance/net-worth', () =>
        HttpResponse.json({
          reporting_currency: 'INR',
          spending_accounts: [],
          total_net_worth: '1000.00',
          valuation_status: 'ok',
        }),
      ),
      http.get('*/v1/finance/net-worth/history', () => HttpResponse.json([])),
      http.get('*/v1/investing/holdings', () => HttpResponse.json({ items: [], total: 0 })),
      http.get('*/v1/investing/summary', () =>
        HttpResponse.json({
          portfolio_value: '0.00',
          reporting_currency: 'INR',
          valuation_status: 'ok',
        }),
      ),
      http.get('*/v1/finance/activity-feed', () =>
        HttpResponse.json({
          items: [
            {
              id: 'tx-123',
              event_type: 'spend',
              date: '2026-09-26T10:00:00Z',
              description: 'Supermarket Groceries',
              amount: '-150.00',
              currency: 'INR',
              account_id: 'acc-bank-inr',
              account_name: 'HDFC Savings',
              account_type: 'bank',
              category_name: 'Groceries',
              source_ref: 'tx-123',
            },
          ],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      ),
      http.get('*/v1/spending/categories', () =>
        HttpResponse.json({
          items: [{ public_id: 'cat-groc', name: 'Groceries' }],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/spending/tags', () =>
        HttpResponse.json({
          items: [],
          total: 0,
          limit: 100,
          offset: 0,
        }),
      ),
      http.get('*/v1/spending/transactions/tx-123', () =>
        HttpResponse.json({
          public_id: 'tx-123',
          amount: 150,
          type: 'expense',
          category_id: 'cat-groc',
          account_id: 'acc-bank-inr',
          occurred_at: '2026-09-26T10:00:00Z',
          description: 'Supermarket Groceries',
          tags: [],
        }),
      ),
      http.patch('*/v1/spending/transactions/:id', async ({ request, params }) => {
        patchedPayload = { id: params.id, body: await request.json() };
        return HttpResponse.json({
          public_id: 'tx-123',
          amount: 180,
          type: 'expense',
          category_id: 'cat-groc',
          account_id: 'acc-bank-inr',
          occurred_at: '2026-09-26T10:00:00Z',
          description: 'Supermarket Groceries & Snacks',
          tags: [],
        });
      }),
      http.delete('*/v1/spending/transactions/:id', ({ params }) => {
        deletedId = String(params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { fireEvent, waitFor } = await import('@testing-library/react');
    renderMoneyFlow();

    // Verify row rendered in stream
    expect(await screen.findByText('Supermarket Groceries')).toBeInTheDocument();

    // Test Edit
    const editBtn = screen.getByTitle('Edit transaction');
    fireEvent.click(editBtn);

    expect(await screen.findByText('Edit Transaction')).toBeInTheDocument();

    const descInput = await screen.findByDisplayValue('Supermarket Groceries');
    fireEvent.change(descInput, { target: { value: 'Supermarket Groceries & Snacks' } });

    // Wait until submit button is active
    const submitBtn = screen.getByTestId('transaction-submit-btn');
    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled();
    });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(patchedPayload).toEqual(
        expect.objectContaining({
          id: 'tx-123',
          body: expect.objectContaining({
            description: 'Supermarket Groceries & Snacks',
          }),
        }),
      );
    });

    // Test Delete
    const deleteBtn = screen.getByTitle('Delete transaction');
    fireEvent.click(deleteBtn);

    expect(await screen.findByText('Delete Transaction')).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete this/i),
    ).toBeInTheDocument();

    // Confirm deletion
    const confirmBtn = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deletedId).toBe('tx-123');
    });
  });

  it('renders pagination and calculates offset-aware running balances in AccountDetailView', async () => {
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
          ],
          total: 1,
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
              balance: '10000.00',
              balance_in_reporting_currency: '10000.00',
            },
          ],
          spending_total: '10000.00',
          investing_accounts: [],
          investing_cash_total: '0.00',
          holdings_value: '0.00',
          total_net_worth: '10000.00',
        }),
      ),
      http.get('*/v1/investing/holdings', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/investing/summary', () =>
        HttpResponse.json({
          reporting_currency: 'INR',
          portfolio_value: '0.00',
          holdings_count: 0,
        }),
      ),
      http.get('*/v1/finance/activity-feed', ({ request }) => {
        const url = new URL(request.url);
        const offset = Number(url.searchParams.get('offset') || '0');
        const limit = Number(url.searchParams.get('limit') || '50');

        if (offset === 0 && limit < 50) {
          return HttpResponse.json({
            items: [
              {
                id: 'tx-p1-1',
                event_type: 'spend',
                date: '2026-03-01T00:00:00Z',
                description: 'Recent Expense Page 1',
                amount: '-1000.00',
                currency: 'INR',
                account_id: 'acc-bank-inr',
                account_name: 'HDFC Savings',
                account_type: 'bank',
              },
            ],
            total: 2,
            limit,
            offset: 0,
          });
        }

        if (offset === 0) {
          return HttpResponse.json({
            items: [
              {
                id: 'tx-p1-1',
                event_type: 'spend',
                date: '2026-03-01T00:00:00Z',
                description: 'Recent Expense Page 1',
                amount: '-1000.00',
                currency: 'INR',
                account_id: 'acc-bank-inr',
                account_name: 'HDFC Savings',
                account_type: 'bank',
              },
            ],
            total: 75,
            limit: 50,
            offset: 0,
          });
        } else {
          return HttpResponse.json({
            items: [
              {
                id: 'tx-p2-1',
                event_type: 'spend',
                date: '2026-01-01T00:00:00Z',
                description: 'Older Expense Page 2',
                amount: '-500.00',
                currency: 'INR',
                account_id: 'acc-bank-inr',
                account_name: 'HDFC Savings',
                account_type: 'bank',
              },
            ],
            total: 75,
            limit: 50,
            offset: 50,
          });
        }
      }),
    );

    renderMoneyFlow('/money?account=acc-bank-inr');

    expect(await screen.findByText('Account Ledger & History')).toBeInTheDocument();
    expect(await screen.findByText('Recent Expense Page 1')).toBeInTheDocument();

    // Verify pagination footer on page 1
    const summary = await screen.findByTestId('account-detail-pagination-summary');
    expect(summary).toHaveTextContent('Showing 1 - 50 of 75');

    const prevBtn = screen.getByTestId('account-detail-prev-btn');
    const nextBtn = screen.getByTestId('account-detail-next-btn');

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    // Click Next
    fireEvent.click(nextBtn);

    // Page 2 should load with older expense and previous button enabled
    expect(await screen.findByText('Older Expense Page 2')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('account-detail-prev-btn')).toBeEnabled();
    });
  });

  it('deletes transfer using source_ref instead of synthetic feed id', async () => {
    let deletedTransferId: string | null = null;

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
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/finance/net-worth', () =>
        HttpResponse.json({
          reporting_currency: 'INR',
          spending_accounts: [],
          spending_total: '0.00',
          investing_accounts: [],
          investing_total: '0.00',
          net_worth: '0.00',
        }),
      ),
      http.get('*/v1/finance/activity-feed', () =>
        HttpResponse.json({
          items: [
            {
              id: 'synthetic-uuid-outflow-12345',
              event_type: 'transfer',
              date: '2026-09-26T10:00:00Z',
              description: 'Transfer to Brokerage',
              amount: '-5000.00',
              currency: 'INR',
              account_id: 'acc-bank-inr',
              account_name: 'HDFC Savings',
              account_type: 'bank',
              counterpart_account_id: 'acc-brokerage-usd',
              counterpart_account_name: 'Charles Schwab',
              source_ref: 'tf-real-public-id-999',
            },
          ],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      ),
      http.delete('*/v1/finance/transfers/:id', ({ params }) => {
        deletedTransferId = String(params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderMoneyFlow();

    // Verify transfer row rendered in stream
    expect(await screen.findByText('Transfer to Brokerage')).toBeInTheDocument();

    // Click Delete transfer button
    const deleteBtn = screen.getByTitle('Delete transfer');
    fireEvent.click(deleteBtn);

    expect(await screen.findByText('Delete Transfer')).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete this/i),
    ).toBeInTheDocument();

    // Confirm deletion
    const confirmBtn = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      // Must delete with the actual transfer public_id from source_ref, not the synthetic feed item id
      expect(deletedTransferId).toBe('tf-real-public-id-999');
    });
  });
});

