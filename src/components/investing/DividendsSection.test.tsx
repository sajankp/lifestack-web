import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';

import { DividendsSection } from './DividendsSection';
import { ToastProvider } from '../ui/toast';
import type { Account } from '../../types/finance';
import { server } from '../../test/setup';

const accounts = [
  {
    public_id: 'acc-1',
    name: 'Zerodha',
    account_type: 'brokerage',
    default_currency_code: 'USD',
    is_active: true,
  },
  {
    public_id: 'acc-2',
    name: 'HDFC Bank',
    account_type: 'bank',
    default_currency_code: 'USD',
    is_active: true,
  },
] as unknown as Account[];

const byParagraphText = (text: string) => (_: string, el: Element | null) =>
  el?.tagName === 'P' && el.textContent === text;

const dividendRow = (overrides: Record<string, unknown> = {}) => ({
  public_id: 'div-1',
  account_id: 'acc-1',
  account_name: 'Zerodha',
  holding_id: null,
  symbol: 'NVDA',
  income_type: 'dividend',
  gross_amount: '100.00',
  tax_withheld: '10.00',
  net_amount: '90.00',
  currency: 'USD',
  pay_date: '2026-06-15',
  external_ref: null,
  notes: null,
  created_at: '2026-06-15T00:00:00Z',
  updated_at: '2026-06-15T00:00:00Z',
  ...overrides,
});

const renderSection = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <DividendsSection accounts={accounts} accountFilter="" currencyDisplayPreference="code" />
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
};

describe('DividendsSection', () => {
  it('renders dividend and account-level income rows', async () => {
    server.use(
      http.get('*/v1/investing/dividends', () =>
        HttpResponse.json({
          items: [
            dividendRow(),
            dividendRow({
              public_id: 'div-2',
              symbol: null,
              income_type: 'interest',
              gross_amount: '25.00',
              tax_withheld: '0.00',
              net_amount: '25.00',
            }),
          ],
          total: 2,
          limit: 200,
          offset: 0,
        }),
      ),
    );
    renderSection();
    expect(await screen.findByText('NVDA')).toBeInTheDocument();
    expect(screen.getByText('interest')).toBeInTheDocument();
    // Account-level income has no symbol attribution.
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows the empty state when no income is recorded', async () => {
    server.use(
      http.get('*/v1/investing/dividends', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
    );
    renderSection();
    expect(await screen.findByText('No dividends or income recorded yet.')).toBeInTheDocument();
  });

  it('routes bulk import to the shared imports framework (spec-074)', async () => {
    // The bespoke paste-CSV modal was retired in spec-074; bulk import now
    // deep-links into the /imports flow for the dividends module.
    server.use(
      http.get('*/v1/investing/dividends', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
    );
    renderSection();
    const link = await screen.findByRole('link', { name: /Bulk import/ });
    expect(link).toHaveAttribute('href', '/imports?module=investing-dividends');
  });

  it('deletes a dividend after confirmation', async () => {
    let deleted = false;
    server.use(
      http.get('*/v1/investing/dividends', () =>
        HttpResponse.json({ items: [dividendRow()], total: 1, limit: 200, offset: 0 }),
      ),
      http.delete('*/v1/investing/dividends/div-1', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderSection();
    fireEvent.click(await screen.findByLabelText('Delete dividend'));
    expect(screen.getByText('Delete dividend?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleted).toBe(true));
  });

  it('pages the list server-side at 10 per page (spec-009)', async () => {
    const seen: URL[] = [];
    server.use(
      http.get('*/v1/investing/dividends', ({ request }) => {
        const url = new URL(request.url);
        seen.push(url);
        const offset = Number(url.searchParams.get('offset') ?? '0');
        const items = Array.from({ length: Math.min(10, 15 - offset) }, (_, i) =>
          dividendRow({ public_id: `div-${offset + i}`, symbol: `SYM${offset + i}` }),
        );
        return HttpResponse.json({ items, total: 15, limit: 10, offset });
      }),
    );
    renderSection();
    expect(
      await screen.findByText(byParagraphText('Showing 1 to 10 of 15 results')),
    ).toBeInTheDocument();
    expect(seen[0].searchParams.get('limit')).toBe('10');

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(
      await screen.findByText(byParagraphText('Showing 11 to 15 of 15 results')),
    ).toBeInTheDocument();
    expect(seen[seen.length - 1].searchParams.get('offset')).toBe('10');
  });

  it('opens the record modal with symbol field for dividends', async () => {
    server.use(
      http.get('*/v1/investing/dividends', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
    );
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: /Record dividend/ }));
    expect(screen.getByText('Record dividend / income')).toBeInTheDocument();
    expect(screen.getByText('Symbol')).toBeInTheDocument();
    expect(screen.getByText('Gross amount')).toBeInTheDocument();
  });
});
