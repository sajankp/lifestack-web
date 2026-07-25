import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';

import { CashTab } from './CashTab';
import { ToastProvider } from '../../components/ui/toast';
import { server } from '../../test/setup';

const PAGE_SIZE = 10;

const byParagraphText = (text: string) => (_: string, el: Element | null) =>
  el?.tagName === 'P' && el.textContent === text;

const cashRow = (i: number) => ({
  public_id: `cash-${i}`,
  account_id: 'acc-1',
  account_name: 'Zerodha',
  balance: `${1000 + i}.00`,
  currency: 'USD',
  as_of: '2026-06-01T00:00:00Z',
  trigger_type: null,
});

const transferRow = (i: number) => ({
  public_id: `tr-${i}`,
  from_account_public_id: 'acc-1',
  to_account_public_id: 'acc-2',
  from_account_name: 'Zerodha',
  to_account_name: 'Wallet',
  from_module: 'investing',
  to_module: 'spending',
  from_currency_code: 'USD',
  to_currency_code: 'USD',
  gross_amount: '100.00',
  net_amount_received: '100.00',
  occurred_at: '2026-06-01T00:00:00Z',
});

const baseHandlers = (opts: { cashTotal: number; transferCount: number }) => {
  const requests: { cash: URL[]; dividends: URL[] } = { cash: [], dividends: [] };
  server.use(
    http.get('*/v1/investing/cash-balances', ({ request }) => {
      const url = new URL(request.url);
      requests.cash.push(url);
      const offset = Number(url.searchParams.get('offset') ?? '0');
      const limit = Number(url.searchParams.get('limit') ?? '200');
      const items = Array.from(
        { length: Math.max(0, Math.min(limit, opts.cashTotal - offset)) },
        (_, i) => cashRow(offset + i),
      );
      return HttpResponse.json({ items, total: opts.cashTotal, limit, offset });
    }),
    http.get('*/v1/finance/transfers', () =>
      HttpResponse.json({
        items: Array.from({ length: opts.transferCount }, (_, i) => transferRow(i)),
        total: opts.transferCount,
        limit: 200,
        offset: 0,
      }),
    ),
    http.get('*/v1/investing/dividends', ({ request }) => {
      requests.dividends.push(new URL(request.url));
      return HttpResponse.json({ items: [], total: 0, limit: PAGE_SIZE, offset: 0 });
    }),
    http.get('*/v1/finance/accounts', () =>
      HttpResponse.json({
        items: [
          {
            public_id: 'acc-1',
            name: 'Zerodha',
            account_type: 'brokerage',
            default_currency_code: 'USD',
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
    http.get('*/v1/finance/currencies', () =>
      HttpResponse.json([
        { code: 'USD', name: 'US Dollar', symbol: '$', minor_unit: 2, is_active: true },
      ]),
    ),
    http.get('*/v1/finance/settings/user', () =>
      HttpResponse.json({ effective_reporting_currency_code: 'USD' }),
    ),
  );
  return requests;
};

const renderTab = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <CashTab currencyDisplayPreference="code" />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
};

describe('CashTab pagination (spec-009)', () => {
  it('requests one server page of cash balances and pages forward', async () => {
    const requests = baseHandlers({ cashTotal: 25, transferCount: 0 });
    renderTab();

    // First page requested at PAGE_SIZE, not a 200-row dump.
    expect(
      await screen.findByText(byParagraphText('Showing 1 to 10 of 25 results')),
    ).toBeInTheDocument();
    expect(requests.cash[0].searchParams.get('limit')).toBe(String(PAGE_SIZE));
    expect(requests.cash[0].searchParams.get('offset')).toBe('0');

    // Paging forward refetches with the next offset.
    const nextButtons = screen.getAllByRole('button', { name: 'Next page' });
    fireEvent.click(nextButtons[0]);
    await screen.findByText(byParagraphText('Showing 11 to 20 of 25 results'));
    const last = requests.cash[requests.cash.length - 1];
    expect(last.searchParams.get('offset')).toBe(String(PAGE_SIZE));
  });

  it('shows section totals in the headers', async () => {
    baseHandlers({ cashTotal: 25, transferCount: 3 });
    renderTab();
    expect(await screen.findByText('Cash Balances (25)')).toBeInTheDocument();
    expect(await screen.findByText('Transfers (3)')).toBeInTheDocument();
  });

  it('renders sections in reachability order: Cash Balances, Dividends, Transfers', async () => {
    baseHandlers({ cashTotal: 1, transferCount: 1 });
    renderTab();
    await screen.findByText('Cash Balances (1)');
    const cash = screen.getByText(/^Cash Balances/);
    const dividends = screen.getByText(/^Dividends \/ Income/);
    const transfers = screen.getByText(/^Transfers/);
    // compareDocumentPosition: FOLLOWING = 4 (argument comes after node).
    expect(cash.compareDocumentPosition(dividends) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(4);
    expect(dividends.compareDocumentPosition(transfers) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(4);
  });

  it('pages transfers client-side at 10 per page', async () => {
    baseHandlers({ cashTotal: 0, transferCount: 17 });
    renderTab();
    await screen.findByText('Transfers (17)');
    expect(screen.getByText(byParagraphText('Showing 1 to 10 of 17 results'))).toBeInTheDocument();
    // Desktop table renders 10 transfer rows, not all 17.
    await waitFor(() => expect(screen.getAllByTestId(/investing-transfer-row-/)).toHaveLength(10));
  });
});
