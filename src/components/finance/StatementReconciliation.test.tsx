import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { describe, it, expect } from 'vitest';

import { StatementReconciliation } from './StatementReconciliation';
import { ToastProvider } from '../ui/toast';
import { server } from '../../test/setup';

const renderStatementReconciliation = (
  props: Partial<React.ComponentProps<typeof StatementReconciliation>> = {},
) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const defaultProps = {
    accountId: 'acc-1',
    currencyDisplayPreference: 'symbol' as const,
    getCategoryTheme: (catId: string | null) => {
      if (catId === 'cat-groceries') {
        return { name: 'Groceries', color: '#10b981', icon: '🛒' };
      }
      if (catId === 'cat-dining') {
        return { name: 'Dining Out', color: '#f59e0b', icon: '🍔' };
      }
      return { name: 'Unknown', color: '#64748b', icon: '' };
    },
    ...props,
  };

  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <StatementReconciliation {...defaultProps} />
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
};

describe('StatementReconciliation spend category and activity identification', () => {
  const mockStatements = [
    {
      public_id: 'stmt-1',
      account_public_id: 'acc-1',
      period_start: '2026-08-01',
      period_end: '2026-08-31',
      closing_balance: '1500.00',
      reconciled_through: null,
      currency_code: 'USD',
      created_at: '2026-08-31T00:00:00Z',
    },
  ];

  const mockReconciliation = {
    statement: mockStatements[0],
    matched_lines: [
      {
        public_id: 'line-matched-1',
        occurred_at: '2026-08-10',
        description: 'CAFE METRO #102',
        amount: '-15.50',
        balance: '1484.50',
        matched_transaction_id: 'tx-1',
        matched_transfer_id: null,
        matched_transfer_leg: null,
        matched_at: '2026-08-10T12:00:00Z',
        matched_description: 'Lunch at Cafe Metro',
        matched_category_id: 'cat-dining',
        matched_category_name: 'Dining Out',
        matched_category_color: '#f59e0b',
        matched_category_icon: '🍔',
      },
    ],
    unmatched_lines: [
      {
        line: {
          public_id: 'line-unmatched-1',
          occurred_at: '2026-08-15',
          description: 'SAFEWAY GROCERY #99',
          amount: '-75.00',
          balance: '1409.50',
          matched_transaction_id: null,
          matched_transfer_id: null,
          matched_transfer_leg: null,
          matched_at: null,
        },
        candidates: [
          {
            kind: 'transaction' as const,
            id: 'cand-tx-1',
            occurred_at: '2026-08-15',
            amount: '-75.00',
            description: 'Weekly grocery shopping',
            leg: null,
            category_id: 'cat-groceries',
            category_name: 'Groceries',
            category_color: '#10b981',
            category_icon: '🛒',
          },
          {
            kind: 'transfer' as const,
            id: 'cand-tr-1',
            occurred_at: '2026-08-14',
            amount: '-75.00',
            description: 'Transfer to savings',
            leg: 'from' as const,
            category_id: null,
            category_name: null,
            category_color: null,
            category_icon: null,
          },
        ],
      },
    ],
    unmatched_ledger_rows: [
      {
        kind: 'transaction' as const,
        id: 'ledger-tx-1',
        occurred_at: '2026-08-20',
        amount: '-32.00',
        description: 'Farmers Market veg',
        leg: null,
        category_id: 'cat-groceries',
        category_name: 'Groceries',
        category_color: '#10b981',
        category_icon: '🛒',
      },
      {
        kind: 'transfer' as const,
        id: 'ledger-tr-1',
        occurred_at: '2026-08-22',
        amount: '-100.00',
        description: 'Wire to brokerage',
        leg: 'from' as const,
        category_id: null,
        category_name: null,
        category_color: null,
        category_icon: null,
      },
    ],
  };

  it('renders spend category badge and description for candidate account activities', async () => {
    server.use(
      http.get('*/v1/finance/accounts/acc-1/statements', () => HttpResponse.json(mockStatements)),
      http.get('*/v1/finance/accounts/acc-1/statements/stmt-1/reconciliation', () =>
        HttpResponse.json(mockReconciliation),
      ),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          default_currency_code: 'USD',
          currency_display_preference: 'symbol',
        }),
      ),
    );

    renderStatementReconciliation();

    // Check unmatched line statement description
    expect(await screen.findByText('SAFEWAY GROCERY #99')).toBeInTheDocument();

    // The transaction candidate should display its category badge and candidate description
    expect(screen.getByText('Weekly grocery shopping')).toBeInTheDocument();
    const groceryBadges = screen.getAllByText('Groceries');
    expect(groceryBadges.length).toBeGreaterThan(0);

    // The transfer candidate should display its Transfer out badge and description
    expect(screen.getByText('Transfer to savings')).toBeInTheDocument();
    expect(screen.getAllByText('Transfer out').length).toBeGreaterThan(0);
  });

  it('renders spend category badge in unmatched ledger rows', async () => {
    server.use(
      http.get('*/v1/finance/accounts/acc-1/statements', () => HttpResponse.json(mockStatements)),
      http.get('*/v1/finance/accounts/acc-1/statements/stmt-1/reconciliation', () =>
        HttpResponse.json(mockReconciliation),
      ),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          default_currency_code: 'USD',
          currency_display_preference: 'symbol',
        }),
      ),
    );

    renderStatementReconciliation();

    expect(await screen.findByText('Farmers Market veg')).toBeInTheDocument();
    expect(screen.getByText('Wire to brokerage')).toBeInTheDocument();
  });

  it('renders matched activity category badge and description for matched lines', async () => {
    server.use(
      http.get('*/v1/finance/accounts/acc-1/statements', () => HttpResponse.json(mockStatements)),
      http.get('*/v1/finance/accounts/acc-1/statements/stmt-1/reconciliation', () =>
        HttpResponse.json(mockReconciliation),
      ),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          default_currency_code: 'USD',
          currency_display_preference: 'symbol',
        }),
      ),
    );

    renderStatementReconciliation();

    expect(await screen.findByText('CAFE METRO #102')).toBeInTheDocument();
    expect(screen.getByText('Dining Out')).toBeInTheDocument();
    expect(screen.getByText('(Lunch at Cafe Metro)')).toBeInTheDocument();
  });

  it('confirms a match when clicking Match on a candidate', async () => {
    let matchPayload: unknown = null;
    server.use(
      http.get('*/v1/finance/accounts/acc-1/statements', () => HttpResponse.json(mockStatements)),
      http.get('*/v1/finance/accounts/acc-1/statements/stmt-1/reconciliation', () =>
        HttpResponse.json(mockReconciliation),
      ),
      http.post(
        '*/v1/finance/accounts/acc-1/statements/stmt-1/lines/line-unmatched-1/match',
        async ({ request }) => {
          matchPayload = await request.json();
          return HttpResponse.json({
            public_id: 'line-unmatched-1',
            occurred_at: '2026-08-15',
            description: 'SAFEWAY GROCERY #99',
            amount: '-75.00',
            balance: '1409.50',
            matched_transaction_id: 'cand-tx-1',
            matched_transfer_id: null,
            matched_transfer_leg: null,
            matched_at: '2026-08-15T12:00:00Z',
          });
        },
      ),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          default_currency_code: 'USD',
          currency_display_preference: 'symbol',
        }),
      ),
    );

    renderStatementReconciliation();

    const matchButtons = await screen.findAllByTestId('statement-match-candidate');
    expect(matchButtons.length).toBe(2);

    // Click the first candidate's match button
    fireEvent.click(matchButtons[0]);

    await waitFor(() => {
      expect(matchPayload).toEqual({ transaction_id: 'cand-tx-1' });
    });
  });
});
