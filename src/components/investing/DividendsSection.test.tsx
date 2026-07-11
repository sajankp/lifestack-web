import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
    <QueryClientProvider client={client}>
      <ToastProvider>
        <DividendsSection accounts={accounts} accountFilter="" currencyDisplayPreference="code" />
      </ToastProvider>
    </QueryClientProvider>,
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

  it('bulk-imports pasted CSV (account name resolved to id) and surfaces per-row rejects', async () => {
    let postedBody: unknown = null;
    server.use(
      http.get('*/v1/investing/dividends', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.post('*/v1/investing/dividends/bulk', async ({ request }) => {
        postedBody = await request.json();
        return HttpResponse.json({
          imported: 1,
          updated: 0,
          skipped: 0,
          rejected: [{ row: 1, reason: 'tax_withheld must be less than gross_amount' }],
        });
      }),
    );
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: /Bulk import/ }));
    const textarea = screen.getByPlaceholderText(
      'account,symbol,income_type,gross,tax,currency,pay_date,external_ref',
    );
    fireEvent.change(textarea, {
      target: {
        value: [
          'account,symbol,income_type,gross,tax,currency,pay_date,external_ref',
          'Zerodha,NVDA,dividend,100.00,10.00,USD,2026-06-15,ref-1',
          'Zerodha,AAPL,dividend,50.00,60.00,USD,2026-06-15,',
        ].join('\n'),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    expect(await screen.findByText(/Imported 1, updated 0, skipped 0, rejected 1/)).toBeVisible();
    expect(screen.getByText(/Row 1: tax_withheld must be less than gross_amount/)).toBeVisible();
    const body = postedBody as { rows: Record<string, unknown>[] };
    expect(body.rows).toHaveLength(2);
    expect(body.rows[0]).toMatchObject({
      account_id: 'acc-1',
      symbol: 'NVDA',
      gross_amount: 100,
      tax_withheld: 10,
      currency: 'USD',
      pay_date: '2026-06-15',
      external_ref: 'ref-1',
    });
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
