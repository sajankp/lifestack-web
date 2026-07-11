import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

import { ReturnMetricsPanel } from './ReturnMetricsPanel';
import { server } from '../../test/setup';

const renderWithQuery = (ui: React.ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

const positionBlock = (overrides: Record<string, unknown> = {}) => ({
  xirr: null,
  annualized_return_pct: null,
  annualization_reliable: false,
  holding_days: null,
  total_return_pct: null,
  realized: '0',
  unrealized: '0',
  market_value: '0',
  invested: '0',
  ...overrides,
});

const scope = (overrides: Record<string, unknown> = {}) => ({
  xirr: null,
  annualized_return_pct: null,
  annualization_reliable: false,
  holding_days: null,
  total_return_pct: null,
  realized: '0',
  unrealized: '0',
  data_quality: 'complete',
  open: positionBlock(),
  closed: positionBlock(),
  max_drawdown: null,
  ...overrides,
});

const mockReturns = (body: Record<string, unknown>) => {
  server.use(http.get('*/v1/investing/performance/returns', () => HttpResponse.json(body)));
};

describe('ReturnMetricsPanel', () => {
  it('headlines the annualized figure with XIRR when annualization is reliable', async () => {
    mockReturns({
      currency: 'USD',
      valuation_status: 'current',
      overall: scope({
        xirr: '0.1250',
        annualized_return_pct: '12.10',
        annualization_reliable: true,
        holding_days: 730,
        total_return_pct: '25.00',
        open: positionBlock({ invested: '1000', annualization_reliable: true, xirr: '0.1250' }),
      }),
      by_account: [],
      by_currency: [],
    });
    renderWithQuery(<ReturnMetricsPanel currencyDisplayPreference="code" />);
    expect(await screen.findByTestId('investing-xirr-overall')).toHaveTextContent(
      '12.1% p.a. (XIRR 12.5%)',
    );
  });

  it('shows simple return + holding period, never an annualized figure, for sub-year spans (INV-7)', async () => {
    mockReturns({
      currency: 'USD',
      valuation_status: 'current',
      overall: scope({
        xirr: '0.9800', // solvable but annualized — must not be displayed
        annualization_reliable: false,
        holding_days: 40,
        total_return_pct: '4.00',
        open: positionBlock({
          invested: '1000',
          total_return_pct: '4.00',
          holding_days: 40,
          xirr: '0.9800',
        }),
      }),
      by_account: [],
      by_currency: [],
    });
    renderWithQuery(<ReturnMetricsPanel currencyDisplayPreference="code" />);
    const headline = await screen.findByTestId('investing-xirr-overall');
    expect(headline).toHaveTextContent('4.0% · held 1mo');
    expect(headline).not.toHaveTextContent('p.a.');
    // XIRR (an annualized rate) must not appear anywhere for a sub-year span.
    expect(screen.queryByText(/XIRR/)).not.toBeInTheDocument();
  });

  it('renders the conversion_required guidance instead of a blended number', async () => {
    mockReturns({
      currency: null,
      valuation_status: 'conversion_required',
      overall: scope(),
      by_account: [],
      by_currency: [],
    });
    renderWithQuery(<ReturnMetricsPanel currencyDisplayPreference="code" />);
    expect(await screen.findByText(/historical FX rate/)).toBeInTheDocument();
    expect(screen.queryByTestId('investing-xirr-overall')).not.toBeInTheDocument();
  });

  it('toggles to exited positions and shows the empty state when none exist', async () => {
    mockReturns({
      currency: 'USD',
      valuation_status: 'current',
      overall: scope({
        open: positionBlock({ invested: '1000', total_return_pct: '5.00', holding_days: 20 }),
        closed: positionBlock(), // invested 0 -> empty state
      }),
      by_account: [],
      by_currency: [],
    });
    renderWithQuery(<ReturnMetricsPanel currencyDisplayPreference="code" />);
    await screen.findByTestId('investing-xirr-overall');
    fireEvent.click(screen.getByRole('button', { name: 'Exited positions' }));
    expect(screen.getByText('No exited positions yet.')).toBeInTheDocument();
  });

  it('shows max drawdown badge and per-account grid with INV-7-guarded account figures', async () => {
    const account = (name: string, reliable: boolean) => ({
      ...scope(
        reliable
          ? { xirr: '0.2000', annualization_reliable: true, holding_days: 400 }
          : { annualization_reliable: false, total_return_pct: '3.00', holding_days: 60 },
      ),
      account_id: name,
      account_name: name,
      currency: 'USD',
    });
    mockReturns({
      currency: 'USD',
      valuation_status: 'current',
      overall: scope({
        open: positionBlock({ invested: '1000', total_return_pct: '5.00' }),
        max_drawdown: { pct: '12.34', peak_date: '2026-01-01', trough_date: '2026-02-01' },
      }),
      by_account: [account('Zerodha', true), account('IBKR', false)],
      by_currency: [],
    });
    renderWithQuery(<ReturnMetricsPanel currencyDisplayPreference="code" />);
    expect(await screen.findByText(/Max drawdown 12.3%/)).toBeInTheDocument();
    expect(screen.getByText('Zerodha')).toBeInTheDocument();
    expect(screen.getByText('20.0%')).toBeInTheDocument(); // reliable -> XIRR shown
    expect(screen.getByText('3.0% · 2mo')).toBeInTheDocument(); // sub-year -> simple return
  });
});
