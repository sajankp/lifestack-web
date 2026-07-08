import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../components/ui/toast';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { SpendingPage } from './SpendingPage';
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

const CATEGORY = {
  public_id: 'cat-food-id',
  name: 'Food',
  is_system: false,
  color: '#22c55e',
  icon: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const ACCOUNT = {
  public_id: 'acc-wallet-id',
  name: 'My Wallet',
  account_type: 'wallet' as const,
  default_currency_code: 'USD',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const USER_SETTINGS = {
  reporting_currency_override_code: null,
  currency_display_preference_override: null,
  workspace_reporting_currency_code: 'USD',
  workspace_currency_display_preference: 'symbol',
  effective_reporting_currency_code: 'USD',
  effective_currency_display_preference: 'symbol',
  updated_at: '2026-01-01T00:00:00Z',
};

const WORKSPACE_SETTINGS = {
  reporting_currency_code: 'USD',
  currency_display_preference: 'symbol',
  lookthrough_min_weight_pct: '0.5',
  default_spending_account_id: null,
  updated_at: '2026-01-01T00:00:00Z',
};

const EMPTY_PAGE = { items: [], total: 0, limit: 50, offset: 0 };
const EMPTY_SUMMARY = { income_total: 0, expense_total: 0, net_total: 0, category_totals: [] };
const EMPTY_LEDGER = {
  account_public_id: ACCOUNT.public_id,
  account_name: ACCOUNT.name,
  account_currency: 'USD',
  opening_balance: '0',
  closing_balance: '0',
  total_entries: 0,
  items: [],
};

// baseHandlers is used as fallback — always pass custom overrides FIRST in server.use()
const baseHandlers = [
  http.get('*/v1/spending/categories', () =>
    HttpResponse.json({ items: [CATEGORY], total: 1, limit: 200, offset: 0 }),
  ),
  http.get('*/v1/finance/accounts', () =>
    HttpResponse.json({ items: [ACCOUNT], total: 1, limit: 200, offset: 0 }),
  ),
  http.get('*/v1/spending/transactions', () => HttpResponse.json(EMPTY_PAGE)),
  http.get('*/v1/spending/transactions/summary', () => HttpResponse.json(EMPTY_SUMMARY)),
  http.get('*/v1/spending/budgets', () => HttpResponse.json(EMPTY_PAGE)),
  http.get('*/v1/spending/recurring', () => HttpResponse.json(EMPTY_PAGE)),
  http.get('*/v1/finance/transfers', () => HttpResponse.json(EMPTY_PAGE)),
  http.get('*/v1/finance/settings/user', () => HttpResponse.json(USER_SETTINGS)),
  http.get('*/v1/finance/settings', () => HttpResponse.json(WORKSPACE_SETTINGS)),
  http.get('*/v1/spending/accounts/*/ledger', () => HttpResponse.json(EMPTY_LEDGER)),
  http.get('*/v1/finance/accounts/*/balance', () =>
    HttpResponse.json({
      account_public_id: ACCOUNT.public_id,
      account_name: ACCOUNT.name,
      account_type: ACCOUNT.account_type,
      currency_code: 'USD',
      spending_balance: '0',
      transaction_count: 0,
      transfer_count: 0,
    }),
  ),
  http.get('*/v1/finance/accounts/*/reconciliation', () =>
    HttpResponse.json({
      projected_balance: '0',
      snapshot_balance: null,
      discrepancy: null,
      snapshot_as_of: null,
    }),
  ),
];

// jsdom doesn't implement these browser APIs used by Radix/cmdk
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = vi.fn();
});

// The transaction form's "last used account" pre-fill (spec-054) persists
// across renders via localStorage — reset it so tests don't leak state.
beforeEach(() => {
  window.localStorage.clear();
});

describe('SpendingPage', () => {
  it('renders page hero and summary cards', async () => {
    server.use(...baseHandlers);
    renderWithQuery(<SpendingPage />);

    expect(await screen.findByText('Spending Overview')).toBeInTheDocument();
    expect(await screen.findByText('Total Income')).toBeInTheDocument();
    expect(screen.getByText('Total Expenses')).toBeInTheDocument();
    expect(screen.getByText('Net Balance')).toBeInTheDocument();
  });

  it('shows correct summary totals from API response', async () => {
    server.use(
      // override goes first — MSW checks in order, first match wins
      http.get('*/v1/spending/transactions/summary', () =>
        HttpResponse.json({
          income_total: 3000,
          expense_total: 1200,
          net_total: 1800,
          category_totals: [],
        }),
      ),
      ...baseHandlers,
    );

    renderWithQuery(<SpendingPage />);

    expect(await screen.findByText('$3,000.00')).toBeInTheDocument();
    expect(await screen.findByText('$1,200.00')).toBeInTheDocument();
    expect(await screen.findByText('$1,800.00')).toBeInTheDocument();
  });

  it('shows empty state when there are no transactions', async () => {
    server.use(...baseHandlers);
    renderWithQuery(<SpendingPage />);

    expect(await screen.findByText('No transactions yet')).toBeInTheDocument();
    expect(
      screen.getByText('Start tracking your spending by adding a new transaction.'),
    ).toBeInTheDocument();
  });

  it('renders transaction rows from API', async () => {
    server.use(
      http.get('*/v1/spending/transactions', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'tx-001',
              category_id: 'cat-food-id',
              account_id: 'acc-wallet-id',
              amount: '42.50',
              type: 'expense',
              occurred_at: '2026-06-15T12:00:00Z',
              description: 'Grocery run',
              wallet_name: null,
              labels: null,
              created_at: '2026-06-15T12:00:00Z',
              updated_at: '2026-06-15T12:00:00Z',
            },
          ],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      ),
      ...baseHandlers,
    );

    renderWithQuery(<SpendingPage />);

    // Transactions render in two responsive layouts (mobile cards + desktop
    // table), so this content appears twice in the DOM — assert on all matches.
    expect((await screen.findAllByText('Grocery run')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Food')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('My Wallet')).length).toBeGreaterThan(0);
  });

  it('opens and closes the new transaction modal', async () => {
    server.use(...baseHandlers);
    renderWithQuery(<SpendingPage />);

    await screen.findByText('Spending Overview');
    fireEvent.click(screen.getByTestId('spending-open-new-transaction'));

    expect(await screen.findByTestId('spending-transaction-amount')).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: /Cancel/i }));
    await waitFor(() => {
      expect(screen.queryByTestId('spending-transaction-amount')).not.toBeInTheDocument();
    });
  });

  it('creates a transaction and closes modal on success', async () => {
    let capturedPayload: Record<string, unknown> | null = null;

    server.use(
      http.post('*/v1/spending/transactions', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        capturedPayload = body;
        return HttpResponse.json(
          {
            public_id: 'tx-new',
            category_id: body.category_id,
            account_id: null,
            amount: body.amount,
            type: body.type,
            occurred_at: body.occurred_at,
            description: null,
            wallet_name: null,
            labels: null,
            created_at: '2026-06-28T00:00:00Z',
            updated_at: '2026-06-28T00:00:00Z',
          },
          { status: 201 },
        );
      }),
      ...baseHandlers,
    );

    renderWithQuery(<SpendingPage />);
    await screen.findByText('Spending Overview');
    fireEvent.click(screen.getByTestId('spending-open-new-transaction'));

    // Fill amount
    const amountInput = await screen.findByTestId('spending-transaction-amount');
    fireEvent.change(amountInput, { target: { value: '55.00' } });

    // Open category dropdown (Popover + cmdk variant)
    fireEvent.click(screen.getByTestId('spending-transaction-category'));
    const foodOption = await screen.findByRole('option', { name: /Food/ });
    fireEvent.click(foodOption);

    // Account is required on create (spec-054)
    fireEvent.click(screen.getByTestId('spending-transaction-account'));
    const walletOption = await screen.findByRole('option', { name: /My Wallet/ });
    fireEvent.click(walletOption);

    // Save button should now be enabled
    const saveBtn = screen.getByTestId('spending-transaction-save');
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(capturedPayload).not.toBeNull();
    });
    expect(capturedPayload).toMatchObject({
      amount: 55,
      type: 'expense',
      category_id: 'cat-food-id',
    });

    // Modal closes on success
    await waitFor(() => {
      expect(screen.queryByTestId('spending-transaction-amount')).not.toBeInTheDocument();
    });
  });

  it('blocks saving a new transaction without an account and shows the inline error', async () => {
    server.use(...baseHandlers);
    renderWithQuery(<SpendingPage />);

    await screen.findByText('Spending Overview');
    fireEvent.click(screen.getByTestId('spending-open-new-transaction'));

    const amountInput = await screen.findByTestId('spending-transaction-amount');
    fireEvent.change(amountInput, { target: { value: '20.00' } });
    fireEvent.click(screen.getByTestId('spending-transaction-category'));
    fireEvent.click(await screen.findByRole('option', { name: /Food/ }));

    // No account selected — save stays disabled and the inline error shows,
    // pointing at Finance Settings (spec-054).
    expect(screen.getByTestId('spending-transaction-save')).toBeDisabled();
    const error = screen.getByTestId('spending-transaction-account-error');
    expect(error).toBeInTheDocument();
    expect(within(error).getByRole('link', { name: /default spending account/i })).toHaveAttribute(
      'href',
      '/settings',
    );
  });

  it('pre-selects the workspace default spending account on a new transaction', async () => {
    server.use(
      http.get('*/v1/finance/settings', () =>
        HttpResponse.json({ ...WORKSPACE_SETTINGS, default_spending_account_id: ACCOUNT.public_id }),
      ),
      ...baseHandlers,
    );
    renderWithQuery(<SpendingPage />);

    await screen.findByText('Spending Overview');
    fireEvent.click(screen.getByTestId('spending-open-new-transaction'));
    await screen.findByTestId('spending-transaction-amount');

    // Pre-selected — no inline error, and the account trigger shows the name.
    expect(screen.queryByTestId('spending-transaction-account-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('spending-transaction-account')).toHaveTextContent('My Wallet');
  });

  it('shows a "No account" filter option with an unassigned count and filters the list', async () => {
    server.use(
      http.get('*/v1/spending/transactions', ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('unassigned') === 'true') {
          return HttpResponse.json({
            items: [
              {
                public_id: 'tx-unassigned',
                category_id: CATEGORY.public_id,
                account_id: null,
                amount: 12,
                type: 'expense',
                occurred_at: '2026-06-01T00:00:00Z',
                description: 'legacy row',
                wallet_name: null,
                labels: null,
                created_at: '2026-06-01T00:00:00Z',
                updated_at: '2026-06-01T00:00:00Z',
              },
            ],
            total: 1,
            limit: 50,
            offset: 0,
          });
        }
        return HttpResponse.json(EMPTY_PAGE);
      }),
      ...baseHandlers,
    );

    renderWithQuery(<SpendingPage />);
    await screen.findByText('Spending Overview');

    fireEvent.click(screen.getByTestId('spending-account-filter'));
    const noAccountOption = await screen.findByRole('option', { name: /No account \(1\)/ });
    fireEvent.click(noAccountOption);

    await screen.findAllByText('legacy row');
  });

  it('defaults transactions sort to newest date and updates the query when changed', async () => {
    const sortValues: (string | null)[] = [];
    server.use(
      http.get('*/v1/spending/transactions', ({ request }) => {
        const url = new URL(request.url);
        // Only record the main list query (the unassigned-count query omits sort).
        if (url.searchParams.get('unassigned') !== 'true') {
          sortValues.push(url.searchParams.get('sort'));
        }
        return HttpResponse.json(EMPTY_PAGE);
      }),
      ...baseHandlers,
    );

    renderWithQuery(<SpendingPage />);
    await screen.findByText('Spending Overview');

    await waitFor(() => expect(sortValues).toContain('date_desc'));

    fireEvent.click(screen.getByTestId('spending-sort'));
    const amountOption = await screen.findByRole('option', { name: /Amount \(high to low\)/ });
    fireEvent.click(amountOption);

    await waitFor(() => expect(sortValues).toContain('amount_desc'));
  });

  it('switches to budgets tab and shows empty state', async () => {
    server.use(...baseHandlers);
    renderWithQuery(<SpendingPage />);

    await screen.findByText('Spending Overview');
    fireEvent.click(screen.getByTestId('spending-tab-budgets'));

    expect(await screen.findByText('No budgets set')).toBeInTheDocument();
    expect(screen.getByText('Set a budget to track your limits.')).toBeInTheDocument();
  });

  it('switches to budgets tab and shows budget cards with progress', async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = `${currentMonth}-01`;

    server.use(
      http.get('*/v1/spending/budgets', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'budget-001',
              category_id: 'cat-food-id',
              amount: '500',
              month_start: monthStart,
              created_at: '2026-06-01T00:00:00Z',
              updated_at: '2026-06-01T00:00:00Z',
            },
          ],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      ),
      http.get('*/v1/spending/transactions/summary', () =>
        HttpResponse.json({
          income_total: 0,
          expense_total: 200,
          net_total: -200,
          category_totals: [{ category_id: 'cat-food-id', total: 200 }],
        }),
      ),
      ...baseHandlers,
    );

    renderWithQuery(<SpendingPage />);
    await screen.findByText('Spending Overview');
    fireEvent.click(screen.getByTestId('spending-tab-budgets'));

    // Budget amount and spent amount both appear; check both are present
    const amounts = await screen.findAllByText(/\$\d+\.\d+/);
    const amountValues = amounts.map((el) => el.textContent);
    expect(amountValues).toContain('$500.00');
    expect(amountValues).toContain('$200.00');
  });

  it('switches to recurring tab and shows empty state', async () => {
    server.use(...baseHandlers);
    renderWithQuery(<SpendingPage />);

    await screen.findByText('Spending Overview');
    fireEvent.click(screen.getByTestId('spending-tab-recurring'));

    expect(await screen.findByText('No recurring rules yet')).toBeInTheDocument();
  });

  it('switches to recurring tab and shows recurring rule cards', async () => {
    server.use(
      http.get('*/v1/spending/recurring', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'rec-001',
              category_id: 'cat-food-id',
              amount: '150.00',
              type: 'expense',
              description: 'Monthly groceries',
              frequency: 'monthly',
              interval: 1,
              anchor_date: '2026-01-01',
              end_date: null,
              is_active: true,
              next_due_date: '2026-07-15',
              last_generated_at: null,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
          ],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      ),
      ...baseHandlers,
    );

    renderWithQuery(<SpendingPage />);
    await screen.findByText('Spending Overview');
    fireEvent.click(screen.getByTestId('spending-tab-recurring'));

    const ruleCard = await screen.findByTestId('spending-recurring-rule-rec-001');
    expect(ruleCard).toBeInTheDocument();
    expect(ruleCard).toHaveTextContent('Monthly groceries');
    expect(ruleCard).toHaveTextContent('Monthly');
  });

  it('deactivate recurring rule shows confirmation dialog then calls delete', async () => {
    let deleteCalled = false;
    server.use(
      http.get('*/v1/spending/recurring', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'rec-001',
              category_id: 'cat-food-id',
              amount: '100.00',
              type: 'expense',
              description: 'Rent',
              frequency: 'monthly',
              interval: 1,
              anchor_date: '2026-01-01',
              end_date: null,
              is_active: true,
              next_due_date: '2026-07-01',
              last_generated_at: null,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
          ],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      ),
      http.delete('*/v1/spending/recurring/rec-001', () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
      ...baseHandlers,
    );

    renderWithQuery(<SpendingPage />);
    await screen.findByText('Spending Overview');
    fireEvent.click(screen.getByTestId('spending-tab-recurring'));

    fireEvent.click(await screen.findByTestId('spending-recurring-deactivate'));

    expect(await screen.findByText('Deactivate recurring rule?')).toBeInTheDocument();
    expect(screen.getByText(/Deactivate "Rent"/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate rule' }));

    await waitFor(() => {
      expect(screen.queryByText('Deactivate recurring rule?')).not.toBeInTheDocument();
    });
    expect(deleteCalled).toBe(true);
  });

  it('shows the Account activity (merged transfers) tab with no entries', async () => {
    server.use(...baseHandlers);
    renderWithQuery(<SpendingPage />);

    await screen.findByText('Spending Overview');
    fireEvent.click(screen.getByTestId('spending-tab-ledger'));
    fireEvent.change(screen.getByTestId('ledger-account-select'), { target: { value: ACCOUNT.public_id } });

    expect(await screen.findByText('No transactions for this account yet.')).toBeInTheDocument();
  });

  it('shows a transfer row on the Account activity tab', async () => {
    server.use(
      http.get('*/v1/finance/transfers', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'tfr-001',
              from_account_id: 1,
              from_account_name: 'My Wallet',
              from_account_type: 'wallet',
              from_module: 'spending',
              to_account_id: 2,
              to_account_name: 'My Bank',
              to_account_type: 'bank',
              to_module: 'spending',
              from_currency_code: 'USD',
              to_currency_code: 'USD',
              gross_amount: '200.00',
              net_amount_received: '200.00',
              fx_rate_used: null,
              fx_fee_amount: '0.00',
              platform_fee_amount: '0.00',
              tax_amount: '0.00',
              occurred_at: '2026-06-20T00:00:00Z',
              notes: 'Monthly top-up',
              created_at: '2026-06-20T00:00:00Z',
              updated_at: '2026-06-20T00:00:00Z',
            },
          ],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      ),
      http.get('*/v1/spending/accounts/*/ledger', () =>
        HttpResponse.json({
          ...EMPTY_LEDGER,
          total_entries: 1,
          items: [
            {
              public_id: 'tfr-001',
              entry_kind: 'transfer_out',
              account_id: ACCOUNT.public_id,
              amount: '200.00',
              type: null,
              occurred_at: '2026-06-20T00:00:00Z',
              description: 'Monthly top-up',
              running_balance: '-200.00',
              source_type: 'transfer',
              created_at: '2026-06-20T00:00:00Z',
            },
          ],
        }),
      ),
      ...baseHandlers,
    );

    renderWithQuery(<SpendingPage />);
    await screen.findByText('Spending Overview');
    fireEvent.click(screen.getByTestId('spending-tab-ledger'));
    fireEvent.change(screen.getByTestId('ledger-account-select'), { target: { value: ACCOUNT.public_id } });

    // Transfer rows render in two responsive layouts (mobile cards + desktop table).
    expect((await screen.findAllByText('Transfer → Monthly top-up')).length).toBeGreaterThan(0);
    expect((await screen.findAllByTitle('Edit transfer')).length).toBeGreaterThan(0);
  });

  it('blocks saving an edited transfer with an invalid FX fee', async () => {
    const transfer = {
      public_id: 'tfr-002',
      from_account_id: 1,
      from_account_public_id: 'acc-wallet-id',
      from_account_name: 'My Wallet',
      from_account_type: 'wallet',
      from_module: 'spending',
      to_account_id: 2,
      to_account_public_id: 'acc-bank-id',
      to_account_name: 'My Bank',
      to_account_type: 'bank',
      to_module: 'spending',
      from_currency_code: 'USD',
      to_currency_code: 'USD',
      gross_amount: '200.00',
      net_amount_received: '200.00',
      fx_rate_used: null,
      fx_fee_amount: '0.00',
      platform_fee_amount: '0.00',
      tax_amount: '0.00',
      occurred_at: '2026-06-20T00:00:00Z',
      notes: 'Monthly top-up',
      created_at: '2026-06-20T00:00:00Z',
      updated_at: '2026-06-20T00:00:00Z',
    };
    server.use(
      http.get('*/v1/finance/transfers', () =>
        HttpResponse.json({ items: [transfer], total: 1, limit: 50, offset: 0 }),
      ),
      http.get('*/v1/finance/accounts', () =>
        HttpResponse.json({
          items: [
            ACCOUNT,
            {
              public_id: 'acc-bank-id',
              name: 'My Bank',
              account_type: 'bank' as const,
              default_currency_code: 'USD',
              is_active: true,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
          ],
          total: 2,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/spending/accounts/*/ledger', () =>
        HttpResponse.json({
          ...EMPTY_LEDGER,
          total_entries: 1,
          items: [
            {
              public_id: 'tfr-002',
              entry_kind: 'transfer_out',
              account_id: ACCOUNT.public_id,
              amount: '200.00',
              type: null,
              occurred_at: '2026-06-20T00:00:00Z',
              description: 'Monthly top-up',
              running_balance: '-200.00',
              source_type: 'transfer',
              created_at: '2026-06-20T00:00:00Z',
            },
          ],
        }),
      ),
      ...baseHandlers,
    );

    renderWithQuery(<SpendingPage />);
    await screen.findByText('Spending Overview');
    fireEvent.click(screen.getByTestId('spending-tab-ledger'));
    fireEvent.change(screen.getByTestId('ledger-account-select'), { target: { value: ACCOUNT.public_id } });
    await screen.findAllByText('Transfer → Monthly top-up');

    fireEvent.click(screen.getAllByTitle('Edit transfer')[0]);
    const modalHeading = await screen.findByText('Edit Transfer');
    const modal = modalHeading.closest('div.relative') as HTMLElement;
    expect(modal).not.toBeNull();
    const form = modal.querySelector('form') as HTMLFormElement;
    expect(form).not.toBeNull();

    const fxFeeLabel = within(modal).getByText('FX Fee');
    const fxFeeInput = fxFeeLabel.parentElement?.querySelector('input') as HTMLInputElement;
    fireEvent.change(fxFeeInput, { target: { value: '-1' } });
    fireEvent.submit(form);

    expect(await within(modal).findByText('FX fee must be a valid non-negative number')).toBeInTheDocument();
  });

  it('disables Save Changes on the edit-transfer form when source and destination accounts are the same', async () => {
    const transfer = {
      public_id: 'tfr-003',
      from_account_id: 1,
      from_account_public_id: 'acc-wallet-id',
      from_account_name: 'My Wallet',
      from_account_type: 'wallet',
      from_module: 'spending',
      to_account_id: 1,
      to_account_public_id: 'acc-wallet-id',
      to_account_name: 'My Wallet',
      to_account_type: 'wallet',
      to_module: 'spending',
      from_currency_code: 'USD',
      to_currency_code: 'USD',
      gross_amount: '200.00',
      net_amount_received: '200.00',
      fx_rate_used: null,
      fx_fee_amount: '0.00',
      platform_fee_amount: '0.00',
      tax_amount: '0.00',
      occurred_at: '2026-06-20T00:00:00Z',
      notes: 'Self transfer edge case',
      created_at: '2026-06-20T00:00:00Z',
      updated_at: '2026-06-20T00:00:00Z',
    };
    server.use(
      http.get('*/v1/finance/transfers', () =>
        HttpResponse.json({ items: [transfer], total: 1, limit: 50, offset: 0 }),
      ),
      http.get('*/v1/spending/accounts/*/ledger', () =>
        HttpResponse.json({
          ...EMPTY_LEDGER,
          total_entries: 1,
          items: [
            {
              public_id: 'tfr-003',
              entry_kind: 'transfer_out',
              account_id: ACCOUNT.public_id,
              amount: '200.00',
              type: null,
              occurred_at: '2026-06-20T00:00:00Z',
              description: 'Self transfer edge case',
              running_balance: '-200.00',
              source_type: 'transfer',
              created_at: '2026-06-20T00:00:00Z',
            },
          ],
        }),
      ),
      ...baseHandlers,
    );

    renderWithQuery(<SpendingPage />);
    await screen.findByText('Spending Overview');
    fireEvent.click(screen.getByTestId('spending-tab-ledger'));
    fireEvent.change(screen.getByTestId('ledger-account-select'), { target: { value: ACCOUNT.public_id } });
    await screen.findAllByText('Transfer → Self transfer edge case');

    fireEvent.click(screen.getAllByTitle('Edit transfer')[0]);
    await screen.findByText('Edit Transfer');

    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
  });
});
