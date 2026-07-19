import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

import { NetWorthPage } from './NetWorthPage';
import { ToastProvider } from '../components/ui/toast';
import { server } from '../test/setup';

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <NetWorthPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
};

const baseNetWorth = {
  reporting_currency: 'USD',
  spending_total: '1000.00',
  investing_cash_total: '500.00',
  holdings_value: '2000.00',
  investing_total: '2500.00',
  total_net_worth: '3500.00',
  valuation_status: 'ok',
  fx_as_of: null,
  spending_accounts: [],
  investing_accounts: [],
};

describe('NetWorthPage', () => {
  it('flags a history point overlapping a reverted import (spec-086 Layer 3)', async () => {
    server.use(
      http.get('*/v1/finance/net-worth', () => HttpResponse.json(baseNetWorth)),
      http.get('*/v1/finance/net-worth/history', () =>
        HttpResponse.json([
          {
            snapshot_date: '2026-06-15',
            reporting_currency: 'USD',
            holdings_value: '1000.00',
            investing_cash: '500.00',
            spending_cash: '1000.00',
            total_net_worth: '2500.00',
            source: 'live',
            data_revised: true,
          },
          {
            snapshot_date: '2026-06-16',
            reporting_currency: 'USD',
            holdings_value: '2000.00',
            investing_cash: '500.00',
            spending_cash: '1000.00',
            total_net_worth: '3500.00',
            source: 'live',
            data_revised: false,
          },
        ]),
      ),
    );

    renderPage();

    expect(await screen.findByText('Data later reverted')).toBeInTheDocument();
  });

  it('does not show the revert legend when no history point is flagged', async () => {
    server.use(
      http.get('*/v1/finance/net-worth', () => HttpResponse.json(baseNetWorth)),
      http.get('*/v1/finance/net-worth/history', () =>
        HttpResponse.json([
          {
            snapshot_date: '2026-06-15',
            reporting_currency: 'USD',
            holdings_value: '1000.00',
            investing_cash: '500.00',
            spending_cash: '1000.00',
            total_net_worth: '2500.00',
            source: 'live',
            data_revised: false,
          },
          {
            snapshot_date: '2026-06-16',
            reporting_currency: 'USD',
            holdings_value: '2000.00',
            investing_cash: '500.00',
            spending_cash: '1000.00',
            total_net_worth: '3500.00',
            source: 'live',
            data_revised: false,
          },
        ]),
      ),
    );

    renderPage();

    expect(await screen.findByText('Net worth history')).toBeInTheDocument();
    expect(screen.queryByText('Data later reverted')).not.toBeInTheDocument();
  });
});
