import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
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
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <HistoricalDataPanel />
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
};

const openDialog = () =>
  fireEvent.click(screen.getByRole('button', { name: /Add historical data/ }));

describe('HistoricalDataPanel', () => {
  it('routes net-worth CSV import to the shared imports framework (spec-074)', async () => {
    // The bespoke paste-CSV modal was retired in spec-074; import now
    // deep-links into the /imports flow for the net-worth-history module.
    server.use(
      http.get('*/v1/finance/net-worth/history/user-points', () => HttpResponse.json(emptyPage)),
      http.get('*/v1/finance/fx/history', () => HttpResponse.json(emptyPage)),
    );
    renderPanel();
    openDialog();
    const link = await screen.findByRole('link', { name: /Import Net Worth CSV/ });
    expect(link).toHaveAttribute('href', '/imports?module=finance-net-worth-history');
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

  it('links FX CSV import to the imports framework and lists/deletes existing rates', async () => {
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
      http.delete('*/v1/finance/fx/history/3', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderPanel();
    openDialog();
    fireEvent.click(await screen.findByRole('button', { name: 'Historical FX' }));
    expect(await screen.findByText('USD/INR')).toBeInTheDocument();

    // Import routes to the shared /imports flow (spec-074); management (list +
    // delete of existing user rates) stays inline on the panel.
    const link = screen.getByRole('link', { name: /Import FX Rates CSV/ });
    expect(link).toHaveAttribute('href', '/imports?module=finance-fx-rates');

    fireEvent.click(screen.getByLabelText('Delete rate'));
    await waitFor(() => expect(deleted).toBe(true));
  });
});
