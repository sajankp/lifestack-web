import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setup';
import { NetWorthSection } from './NetWorthSection';

// spec-113 §3.1: net worth with a Day · Week · Month switch (default Week), the saved / markets
// split on Week and Month, and an Investments line underneath.

const complete = (over: Record<string, unknown> = {}) => ({
  status: 'complete',
  start_date: '2026-11-21',
  end_date: '2026-11-28',
  currency: 'INR',
  net_worth: {
    start: '2700000.00',
    end: '2802813.00',
    change: '102813.00',
    saved: '99200.00',
    markets_and_other: '3613.00',
  },
  investments: {
    start: '1000000.00',
    end: '1095000.00',
    change: '95000.00',
    new_money: '60000.00',
    growth: '35000.00',
  },
  ...over,
});

const requested: string[] = [];

const useChange = (build: (period: string) => Record<string, unknown>) =>
  server.use(
    http.get('*/v1/finance/period-change', ({ request }) => {
      const period = new URL(request.url).searchParams.get('period') ?? '';
      requested.push(period);
      return HttpResponse.json(build(period));
    }),
  );

const renderSection = (props: Partial<React.ComponentProps<typeof NetWorthSection>> = {}) => {
  requested.length = 0;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NetWorthSection
          fallbackCurrency="INR"
          currencyDisplay="symbol"
          locale="en-IN"
          decimalPlaces={2}
          investmentsValue={null}
          valuationStatus=""
          snapshotDate={null}
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('NetWorthSection', () => {
  it('opens on Week and shows the value, the change and the saved / markets split', async () => {
    useChange(() => complete());
    renderSection();

    expect(await screen.findByTestId('today-net-worth-value')).toHaveTextContent('₹28,02,813.00');
    expect(requested).toEqual(['week']);
    expect(screen.getByTestId('today-period-week')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('today-period-day')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('today-net-worth-change')).toHaveTextContent(
      'Up ₹1,02,813.00 this week',
    );
    expect(screen.getByTestId('today-net-worth-split')).toHaveTextContent(
      '₹99,200.00 saved · ₹3,613.00 markets & other',
    );
  });

  it('offers exactly Day, Week and Month', async () => {
    useChange(() => complete());
    renderSection();

    await screen.findByTestId('today-net-worth-value');
    const group = screen.getByRole('group', { name: 'Period' });
    expect(
      within(group)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Day', 'Week', 'Month']);
  });

  it('refetches for the chosen period and words the change for it', async () => {
    useChange((period) =>
      period === 'month'
        ? complete({
            net_worth: {
              start: '2500000.00',
              end: '2802813.00',
              change: '302813.00',
              saved: '250000.00',
              markets_and_other: '52813.00',
            },
          })
        : complete(),
    );
    renderSection();
    await screen.findByTestId('today-net-worth-value');

    await userEvent.click(screen.getByTestId('today-period-month'));

    await waitFor(() =>
      expect(screen.getByTestId('today-net-worth-change')).toHaveTextContent(
        'Up ₹3,02,813.00 this month',
      ),
    );
    expect(requested).toEqual(['week', 'month']);
    expect(screen.getByTestId('today-period-month')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('today-net-worth-split')).toHaveTextContent(
      '₹2,50,000.00 saved · ₹52,813.00 markets & other',
    );
  });

  it('shows no saved / markets split on Day', async () => {
    useChange(() => complete());
    renderSection();
    await screen.findByTestId('today-net-worth-value');

    await userEvent.click(screen.getByTestId('today-period-day'));

    await waitFor(() => expect(requested).toEqual(['week', 'day']));
    await waitFor(() =>
      expect(screen.getByTestId('today-net-worth-change')).toHaveTextContent('today'),
    );
    expect(screen.queryByTestId('today-net-worth-split')).not.toBeInTheDocument();
  });

  it('words a fall and no change plainly', async () => {
    useChange(() =>
      complete({
        net_worth: {
          start: '100.00',
          end: '70.00',
          change: '-30.00',
          saved: '-30.00',
          markets_and_other: '0.00',
        },
      }),
    );
    renderSection();
    expect(await screen.findByTestId('today-net-worth-change')).toHaveTextContent(
      'Down ₹30.00 this week',
    );

    server.use(
      http.get('*/v1/finance/period-change', () =>
        HttpResponse.json(
          complete({
            net_worth: {
              start: '100.00',
              end: '100.00',
              change: '0.00',
              saved: '0.00',
              markets_and_other: '0.00',
            },
          }),
        ),
      ),
    );
    await userEvent.click(screen.getByTestId('today-period-month'));
    await waitFor(() =>
      expect(screen.getByTestId('today-net-worth-change')).toHaveTextContent(
        'No change this month',
      ),
    );
  });

  it('shows the Investments line: value, change, and new money vs growth', async () => {
    useChange(() => complete());
    renderSection();

    await screen.findByTestId('today-net-worth-value'); // the line fills in with the same response
    const line = screen.getByTestId('dashboard-portfolio-value');
    expect(line).toHaveTextContent('Investments');
    expect(line).toHaveTextContent('₹10,95,000.00');
    expect(line).toHaveTextContent('Up ₹95,000.00');
    expect(line).toHaveTextContent('₹60,000.00 new money · ₹35,000.00 growth');
    expect(line).toHaveAttribute('href', '/investing');
  });

  it('shows totals only, with a note, when the split could not be worked out', async () => {
    useChange(() =>
      complete({
        status: 'partial',
        net_worth: {
          start: '2700000.00',
          end: '2802813.00',
          change: '102813.00',
          saved: null,
          markets_and_other: null,
        },
        investments: {
          start: '1000000.00',
          end: '1095000.00',
          change: '95000.00',
          new_money: null,
          growth: null,
        },
      }),
    );
    renderSection();

    expect(await screen.findByTestId('today-net-worth-change')).toHaveTextContent(
      'Up ₹1,02,813.00',
    );
    expect(screen.queryByTestId('today-net-worth-split')).not.toBeInTheDocument();
    expect(screen.getByTestId('dashboard-portfolio-value')).toHaveTextContent('Up ₹95,000.00');
    expect(screen.getByTestId('dashboard-portfolio-value')).not.toHaveTextContent('new money');
    expect(screen.getByTestId('today-period-note')).toHaveTextContent(/totals only/i);
  });

  it('says there is not enough history when nothing is available', async () => {
    useChange(() =>
      complete({
        status: 'unavailable',
        net_worth: { start: null, end: null, change: null, saved: null, markets_and_other: null },
        investments: { start: null, end: null, change: null, new_money: null, growth: null },
      }),
    );
    renderSection({ investmentsValue: '5000.00' });

    expect(await screen.findByTestId('today-net-worth-value')).toHaveTextContent('—');
    expect(screen.getByTestId('today-period-note')).toHaveTextContent(/not enough history/i);
    expect(screen.queryByTestId('today-net-worth-change')).not.toBeInTheDocument();
    // The Investments value still comes from the dashboard summary.
    expect(screen.getByTestId('dashboard-portfolio-value')).toHaveTextContent('₹5,000.00');
  });

  it('keeps the switch and a short message when the request fails', async () => {
    server.use(
      http.get('*/v1/finance/period-change', () => HttpResponse.json({}, { status: 500 })),
    );
    renderSection();

    expect(await screen.findByTestId('today-net-worth-error')).toHaveTextContent(/couldn.t load/i);
    expect(screen.getByTestId('today-period-week')).toBeInTheDocument();
  });

  it('says some prices are estimates when the valuation is degraded', async () => {
    useChange(() => complete());
    renderSection({ valuationStatus: 'estimated', snapshotDate: '2026-11-26' });

    expect(await screen.findByTestId('today-valuation-note')).toHaveTextContent(
      'Some prices are estimates (updated 26-Nov-2026).',
    );
  });

  it('says nothing about valuation when it is current', async () => {
    useChange(() => complete());
    renderSection({ valuationStatus: 'current', snapshotDate: '2026-11-26' });

    await screen.findByTestId('today-net-worth-value');
    expect(screen.queryByTestId('today-valuation-note')).not.toBeInTheDocument();
  });
});
