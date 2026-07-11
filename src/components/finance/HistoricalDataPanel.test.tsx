import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

import { HistoricalDataPanel } from './HistoricalDataPanel';
import { ToastProvider } from '../ui/toast';
import { server } from '../../test/setup';

const emptyPage = { items: [], total: 0, limit: 200, offset: 0 };

const renderPanel = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <HistoricalDataPanel />
      </ToastProvider>
    </QueryClientProvider>,
  );
};

const openDialog = () =>
  fireEvent.click(screen.getByRole('button', { name: /Add historical data/ }));

describe('HistoricalDataPanel', () => {
  it('imports pasted net-worth CSV and shows per-row reject feedback', async () => {
    let postedBody: unknown = null;
    server.use(
      http.get('*/v1/finance/net-worth/history/user-points', () => HttpResponse.json(emptyPage)),
      http.get('*/v1/finance/fx/history', () => HttpResponse.json(emptyPage)),
      http.post('*/v1/finance/net-worth/history/import', async ({ request }) => {
        postedBody = await request.json();
        return HttpResponse.json({
          imported: 1,
          skipped: 0,
          rejected: [{ row: 1, reason: 'date_not_backfill' }],
        });
      }),
    );
    renderPanel();
    openDialog();
    const textarea = await screen.findByPlaceholderText(
      'date,total_net_worth,holdings_value,investing_cash,spending_cash,reporting_currency',
    );
    fireEvent.change(textarea, {
      target: {
        value: [
          'date,total_net_worth,reporting_currency',
          '2024-01-01,10000.00,USD',
          '2027-01-01,5000.00,USD',
        ].join('\n'),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    expect(await screen.findByText(/Imported 1, skipped 0, rejected 1/)).toBeVisible();
    expect(screen.getByText(/Row 1: date_not_backfill/)).toBeVisible();
    const body = postedBody as { rows: Record<string, unknown>[] };
    expect(body.rows).toHaveLength(2);
    expect(body.rows[0]).toMatchObject({
      date: '2024-01-01',
      total_net_worth: 10000,
      holdings_value: null,
      reporting_currency: 'USD',
    });
  });

  it('lists existing user points and deletes one', async () => {
    let deleted = false;
    server.use(
      http.get('*/v1/finance/net-worth/history/user-points', () =>
        HttpResponse.json({
          items: [
            {
              id: 7,
              snapshot_date: '2024-01-01',
              reporting_currency: 'USD',
              holdings_value: null,
              investing_cash: null,
              spending_cash: null,
              total_net_worth: '10000.00',
              created_at: '2026-07-01T00:00:00Z',
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.get('*/v1/finance/fx/history', () => HttpResponse.json(emptyPage)),
      http.delete('*/v1/finance/net-worth/history/user-points/7', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderPanel();
    openDialog();
    fireEvent.click(await screen.findByLabelText('Delete point'));
    await waitFor(() => expect(deleted).toBe(true));
  });

  it('imports historical FX rows from the FX tab and lists/deletes existing rates', async () => {
    let postedBody: unknown = null;
    let deleted = false;
    server.use(
      http.get('*/v1/finance/net-worth/history/user-points', () => HttpResponse.json(emptyPage)),
      http.get('*/v1/finance/fx/history', () =>
        HttpResponse.json({
          items: [
            {
              id: 3,
              base_currency_code: 'USD',
              quote_currency_code: 'INR',
              rate: '70.0000000000',
              as_of_date: '2020-01-01',
              created_at: '2026-07-01T00:00:00Z',
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.post('*/v1/finance/fx/history/import', async ({ request }) => {
        postedBody = await request.json();
        return HttpResponse.json({ imported: 1, skipped: 0, rejected: [] });
      }),
      http.delete('*/v1/finance/fx/history/3', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderPanel();
    openDialog();
    fireEvent.click(await screen.findByRole('button', { name: 'Historical FX' }));
    expect(await screen.findByText('USD/INR')).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText('base,quote,rate,date');
    fireEvent.change(textarea, {
      target: { value: ['base,quote,rate,date', 'usd,inr,70.5,2020-06-01'].join('\n') },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(await screen.findByText(/Imported 1, skipped 0, rejected 0/)).toBeVisible();
    const body = postedBody as { rows: Record<string, unknown>[] };
    expect(body.rows[0]).toMatchObject({
      base_currency_code: 'USD',
      quote_currency_code: 'INR',
      rate: 70.5,
      as_of_date: '2020-06-01',
    });

    fireEvent.click(screen.getByLabelText('Delete rate'));
    await waitFor(() => expect(deleted).toBe(true));
  });
});
