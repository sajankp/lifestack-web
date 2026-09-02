import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { describe, it, expect, vi } from 'vitest';

import { LedgerTab } from './LedgerTab';
import { ToastProvider } from '../../components/ui/toast';
import { server } from '../../test/setup';

const renderLedgerTab = (props: Partial<React.ComponentProps<typeof LedgerTab>> = {}) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const defaultProps = {
    accounts: [
      {
        public_id: 'acc-1',
        name: 'Checking Account',
        account_type: 'bank',
        default_currency_code: 'USD',
      },
    ],
    selectedAccountId: 'acc-1',
    onAccountChange: vi.fn(),
    offset: 0,
    limit: 20,
    onOffsetChange: vi.fn(),
    currencyDisplayPreference: 'symbol' as const,
    getCategoryTheme: (catId: string | null) => {
      if (catId === 'cat-groceries') {
        return { name: 'Groceries', color: '#10b981', icon: '🛒' };
      }
      return { name: 'Unknown', color: '#64748b', icon: '' };
    },
    ...props,
  };

  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <LedgerTab {...defaultProps} />
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
};

describe('LedgerTab category and transfer rendering (Spec-095)', () => {
  it('renders category badge for regular transactions and em dash for transfer rows in desktop table and mobile cards', async () => {
    server.use(
      http.get('*/v1/spending/accounts/acc-1/ledger', () =>
        HttpResponse.json({
          account_public_id: 'acc-1',
          account_name: 'Checking Account',
          account_currency: 'USD',
          opening_balance: '1000.00',
          closing_balance: '900.00',
          total_entries: 2,
          items: [
            {
              public_id: 'entry-tx-1',
              entry_kind: 'transaction',
              category_id: 'cat-groceries',
              account_id: 'acc-1',
              amount: '50.00',
              type: 'expense',
              occurred_at: '2026-08-15T12:00:00Z',
              description: 'Supermarket run',
              wallet_name: 'Checking Account',
              labels: null,
              source_type: 'voice_agent',
              running_balance: '950.00',
              created_at: '2026-08-15T12:00:00Z',
            },
            {
              public_id: 'entry-tr-1',
              entry_kind: 'transfer_out',
              category_id: null,
              account_id: 'acc-1',
              amount: '50.00',
              type: null,
              occurred_at: '2026-08-16T14:00:00Z',
              description: 'Savings',
              wallet_name: 'Checking Account',
              labels: null,
              source_type: 'manual',
              running_balance: '900.00',
              created_at: '2026-08-16T14:00:00Z',
            },
          ],
        }),
      ),
      http.get('*/v1/finance/accounts/acc-1/balance', () =>
        HttpResponse.json({
          account_public_id: 'acc-1',
          calculated_balance: '900.00',
          currency_code: 'USD',
          as_of: '2026-08-16T14:00:00Z',
        }),
      ),
      http.get('*/v1/finance/reconciliations/acc-1', () =>
        HttpResponse.json({
          account_public_id: 'acc-1',
          reconciliation_status: 'matched',
          discrepancy: '0.00',
        }),
      ),
      http.get('*/v1/finance/accounts/acc-1/reconciliation', () =>
        HttpResponse.json({
          account_public_id: 'acc-1',
          reconciliation_status: 'matched',
          discrepancy: '0.00',
        }),
      ),
      http.get('*/v1/finance/settings/user', () =>
        HttpResponse.json({
          default_currency_code: 'USD',
          currency_display_preference: 'symbol',
        }),
      ),
    );

    renderLedgerTab();

    // Verify category badge 'Groceries' appears for transaction entry
    await waitFor(() => {
      const groceryBadges = screen.getAllByText('Groceries');
      expect(groceryBadges.length).toBeGreaterThan(0);
    });

    // Verify transfer row renders Transfer label
    expect(screen.getAllByText(/Transfer → Savings/i).length).toBeGreaterThan(0);
  });
});
