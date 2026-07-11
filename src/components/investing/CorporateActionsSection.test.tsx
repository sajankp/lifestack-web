import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

import { CorporateActionsSection } from './CorporateActionsSection';
import { ToastProvider } from '../ui/toast';
import type { Account } from '../../types/finance';
import { server } from '../../test/setup';

const accounts = [
  {
    public_id: 'acc-1',
    name: 'Zerodha',
    account_type: 'brokerage',
    default_currency_code: 'INR',
    is_active: true,
  },
] as unknown as Account[];

const action = (overrides: Record<string, unknown> = {}) => ({
  public_id: 'ca-1',
  account_id: 'acc-1',
  account_name: 'Zerodha',
  symbol: 'IRCTC',
  action_type: 'split',
  ratio_base: '1',
  ratio_quote: '5',
  ex_date: '2026-05-01',
  notes: null,
  created_at: '2026-05-01T00:00:00Z',
  ...overrides,
});

const renderSection = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <CorporateActionsSection accounts={accounts} accountFilter="" />
      </ToastProvider>
    </QueryClientProvider>,
  );
};

const expandSection = () =>
  fireEvent.click(screen.getByRole('button', { name: /Corporate actions/ }));

describe('CorporateActionsSection', () => {
  it('renders split and bonus ratios with type-dependent phrasing (INV-2)', async () => {
    server.use(
      http.get('*/v1/investing/corporate-actions', () =>
        HttpResponse.json({
          items: [
            action(),
            action({
              public_id: 'ca-2',
              symbol: 'ITC',
              action_type: 'bonus',
              ratio_base: '2',
              ratio_quote: '1',
            }),
          ],
          total: 2,
          limit: 200,
          offset: 0,
        }),
      ),
    );
    renderSection();
    expandSection();
    // Split phrasing: "N old → M new"; bonus phrasing: "M free per N held".
    expect(await screen.findByText('1 old → 5 new')).toBeInTheDocument();
    expect(screen.getByText('1 free per 2 held')).toBeInTheDocument();
    expect(screen.getByText('Split')).toBeInTheDocument();
    expect(screen.getByText('Bonus')).toBeInTheDocument();
  });

  it('shows the empty state and opens the record modal with an illustrative preview', async () => {
    server.use(
      http.get('*/v1/investing/corporate-actions', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
      http.get('*/v1/investing/holdings', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
      ),
    );
    renderSection();
    expandSection();
    expect(await screen.findByText('No corporate actions recorded yet.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Record corporate action/ }));
    expect(screen.getByRole('heading', { name: 'Record corporate action' })).toBeInTheDocument();
    expect(screen.getByText(/Preview \(illustrative/)).toBeInTheDocument();
    expect(screen.getByText(/No cash impact/)).toBeInTheDocument();
  });

  it('deletes an action after the full-replay warning confirmation', async () => {
    let deleted = false;
    server.use(
      http.get('*/v1/investing/corporate-actions', () =>
        HttpResponse.json({ items: [action()], total: 1, limit: 200, offset: 0 }),
      ),
      http.delete('*/v1/investing/corporate-actions/ca-1', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderSection();
    expandSection();
    fireEvent.click(await screen.findByLabelText('Delete corporate action'));
    expect(screen.getByText(/full\s+replay/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleted).toBe(true));
  });
});
