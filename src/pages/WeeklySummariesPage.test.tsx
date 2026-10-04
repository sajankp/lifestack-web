import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../components/ui/toast';
import { http, HttpResponse } from 'msw';

import { WeeklySummariesPage } from './WeeklySummariesPage';
import { server } from '../test/setup';

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <WeeklySummariesPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
};

describe('WeeklySummariesPage', () => {
  it('renders typed weekly metrics and keeps investment cash separate', async () => {
    server.use(
      http.get('*/v1/summaries/weekly', () =>
        HttpResponse.json({
          items: [
            {
              public_id: '11111111-1111-1111-1111-111111111111',
              week_start: '2026-06-15',
              week_end: '2026-06-21',
              generated_at: '2026-06-22T01:30:00Z',
              todo_summary: { tasks_created: 5, tasks_completed: 4 },
              spending_summary: {
                status: 'complete',
                total_income: '5000.00',
                total_expense: '3200.00',
                net: '1800.00',
                currency: 'INR',
                has_multiple_currencies: false,
                top_categories: [],
                budget_utilization_pct: null,
                budgets_breached: 0,
              },
              investing_summary: {
                status: 'complete',
                portfolio_value_start: '100000.00',
                portfolio_value_end: '102500.00',
                cash_start: '5000.00',
                cash_end: '5200.00',
                week_change: '2500.00',
                week_change_pct: '2.50',
                currency: 'INR',
                start_snapshot_date: '2026-06-14',
                end_snapshot_date: '2026-06-21',
              },
              highlights: { flags: [] },
              read_at: '2026-06-22T02:00:00Z',
            },
          ],
          total: 1,
          limit: 12,
          offset: 0,
        }),
      ),
    );

    renderPage();

    expect(await screen.findByText('Tasks completed')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Portfolio value')).toBeInTheDocument();
    expect(screen.getByText(/₹102,500.00|₹1,02,500.00|INR 102,500.00/)).toBeInTheDocument();
    expect(screen.getByText('Investment cash')).toBeInTheDocument();
    expect(screen.getByText(/₹5,200.00|INR 5,200.00/)).toBeInTheDocument();
    expect(screen.getByText(/\(\+2\.50%\)/)).toBeInTheDocument();
    expect(screen.queryByText(/"portfolio_value_end"/)).not.toBeInTheDocument();
  });

  it('marks the latest unread summary read on open (spec-080)', async () => {
    const summaryId = '22222222-2222-2222-2222-222222222222';
    let readCalledWith: string | null = null;
    server.use(
      http.get('*/v1/summaries/weekly', () =>
        HttpResponse.json({
          items: [
            {
              public_id: summaryId,
              week_start: '2026-06-15',
              week_end: '2026-06-21',
              generated_at: '2026-06-22T01:30:00Z',
              todo_summary: { tasks_created: 5, tasks_completed: 4 },
              spending_summary: { status: 'unavailable' },
              investing_summary: { status: 'unavailable' },
              highlights: { flags: [] },
              read_at: null,
            },
          ],
          total: 1,
          limit: 12,
          offset: 0,
        }),
      ),
      http.post('*/v1/summaries/weekly/:id/read', ({ params }) => {
        readCalledWith = params.id as string;
        return HttpResponse.json({
          public_id: summaryId,
          week_start: '2026-06-15',
          week_end: '2026-06-21',
          generated_at: '2026-06-22T01:30:00Z',
          todo_summary: { tasks_created: 5, tasks_completed: 4 },
          spending_summary: { status: 'unavailable' },
          investing_summary: { status: 'unavailable' },
          highlights: { flags: [] },
          read_at: '2026-06-22T03:00:00Z',
        });
      }),
    );

    renderPage();

    await screen.findByText('Tasks completed');
    await waitFor(() => expect(readCalledWith).toBe(summaryId));
  });

  it('renders the spec-076 dividend/net-worth/return-metrics sections', async () => {
    server.use(
      http.get('*/v1/summaries/weekly', () =>
        HttpResponse.json({
          items: [
            {
              public_id: '33333333-3333-3333-3333-333333333333',
              week_start: '2026-06-15',
              week_end: '2026-06-21',
              generated_at: '2026-06-22T01:30:00Z',
              todo_summary: { tasks_created: 0, tasks_completed: 0 },
              spending_summary: { status: 'unavailable' },
              investing_summary: { status: 'unavailable' },
              dividend_summary: {
                status: 'complete',
                total_net: '90.00',
                currency: 'USD',
                count: 1,
                by_symbol: [{ symbol: 'NVDA', net_amount: '90.00' }],
                has_multiple_currencies: false,
              },
              net_worth_summary: {
                status: 'complete',
                net_worth_start: '1000.00',
                net_worth_end: '1100.00',
                week_change: '100.00',
                week_change_pct: '10.00',
                currency: 'USD',
                start_snapshot_date: '2026-06-14',
                end_snapshot_date: '2026-06-21',
              },
              return_metrics_summary: {
                status: 'complete',
                xirr: '12.50',
                annualized_return_pct: '12.50',
                max_drawdown_pct: '3.20',
                notable: false,
              },
              highlights: { flags: [] },
              read_at: '2026-06-22T02:00:00Z',
            },
          ],
          total: 1,
          limit: 12,
          offset: 0,
        }),
      ),
    );

    renderPage();

    expect(await screen.findByText('Dividend Income')).toBeInTheDocument();
    expect(screen.getByText('NVDA')).toBeInTheDocument();
    expect(screen.getByText('Net Worth')).toBeInTheDocument();
    expect(screen.getByText('Return Metrics')).toBeInTheDocument();
    expect(screen.getAllByText('12.50%').length).toBeGreaterThan(0);
    expect(screen.getByText('3.20%')).toBeInTheDocument();
  });

  it('shows the data-revised warning when a reverted import overlaps the boundary snapshot (spec-086)', async () => {
    server.use(
      http.get('*/v1/summaries/weekly', () =>
        HttpResponse.json({
          items: [
            {
              public_id: '77777777-7777-7777-7777-777777777777',
              week_start: '2026-06-15',
              week_end: '2026-06-21',
              generated_at: '2026-06-22T01:30:00Z',
              todo_summary: { tasks_created: 0, tasks_completed: 0 },
              spending_summary: { status: 'unavailable' },
              investing_summary: {
                status: 'complete',
                portfolio_value_start: '100000.00',
                portfolio_value_end: '102500.00',
                cash_start: '5000.00',
                cash_end: '5200.00',
                week_change: '2500.00',
                week_change_pct: '2.50',
                currency: 'USD',
                start_snapshot_date: '2026-06-14',
                end_snapshot_date: '2026-06-21',
              },
              highlights: { flags: [] },
              read_at: '2026-06-22T02:00:00Z',
              data_revised_after_snapshot: true,
            },
          ],
          total: 1,
          limit: 12,
          offset: 0,
        }),
      ),
    );

    renderPage();

    expect(
      await screen.findByText(/may reflect an import that was later reverted/),
    ).toBeInTheDocument();
  });

  it('does not show the data-revised warning by default', async () => {
    server.use(
      http.get('*/v1/summaries/weekly', () =>
        HttpResponse.json({
          items: [
            {
              public_id: '88888888-8888-8888-8888-888888888888',
              week_start: '2026-06-15',
              week_end: '2026-06-21',
              generated_at: '2026-06-22T01:30:00Z',
              todo_summary: { tasks_created: 0, tasks_completed: 0 },
              spending_summary: { status: 'unavailable' },
              investing_summary: { status: 'unavailable' },
              highlights: { flags: [] },
              read_at: '2026-06-22T02:00:00Z',
            },
          ],
          total: 1,
          limit: 12,
          offset: 0,
        }),
      ),
    );

    renderPage();

    await screen.findByText('Tasks completed');
    expect(screen.queryByText(/later reverted/)).not.toBeInTheDocument();
  });

  it('regenerates a summary and refreshes the list without prompting a notification', async () => {
    const summaryId = '44444444-4444-4444-4444-444444444444';
    const newSummaryId = '55555555-5555-5555-5555-555555555555';
    let regenerateCalledWith: { id: string; reason: string | null } | null = null;
    const baseItem = {
      week_start: '2026-06-15',
      week_end: '2026-06-21',
      generated_at: '2026-06-22T01:30:00Z',
      todo_summary: { tasks_created: 0, tasks_completed: 0 },
      spending_summary: { status: 'unavailable' },
      investing_summary: { status: 'unavailable' },
      highlights: { flags: [] },
      read_at: '2026-06-22T02:00:00Z',
    };

    server.use(
      http.get('*/v1/summaries/weekly', () =>
        HttpResponse.json({
          items: [{ ...baseItem, public_id: summaryId }],
          total: 1,
          limit: 12,
          offset: 0,
        }),
      ),
      http.post('*/v1/summaries/weekly/:id/regenerate', async ({ params, request }) => {
        const body = (await request.json()) as { reason: string | null };
        regenerateCalledWith = { id: params.id as string, reason: body.reason };
        return HttpResponse.json({
          ...baseItem,
          public_id: newSummaryId,
          regenerated_at: '2026-06-23T00:00:00Z',
          regeneration_reason: body.reason,
        });
      }),
    );

    renderPage();

    const regenerateButton = await screen.findByTestId(`regenerate-summary-${summaryId}`);
    fireEvent.click(regenerateButton);

    await waitFor(() => expect(regenerateCalledWith).toEqual({ id: summaryId, reason: null }));
  });

  it('shows an error toast when regeneration fails', async () => {
    const summaryId = '66666666-6666-6666-6666-666666666666';
    server.use(
      http.get('*/v1/summaries/weekly', () =>
        HttpResponse.json({
          items: [
            {
              public_id: summaryId,
              week_start: '2026-06-15',
              week_end: '2026-06-21',
              generated_at: '2026-06-22T01:30:00Z',
              todo_summary: { tasks_created: 0, tasks_completed: 0 },
              spending_summary: { status: 'unavailable' },
              investing_summary: { status: 'unavailable' },
              highlights: { flags: [] },
              read_at: '2026-06-22T02:00:00Z',
            },
          ],
          total: 1,
          limit: 12,
          offset: 0,
        }),
      ),
      http.post(
        '*/v1/summaries/weekly/:id/regenerate',
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    renderPage();

    const regenerateButton = await screen.findByTestId(`regenerate-summary-${summaryId}`);
    fireEvent.click(regenerateButton);

    expect(
      await screen.findByText('Failed to regenerate summary. Please try again.'),
    ).toBeInTheDocument();
  });

  it('does not fabricate "(0.00%)" when week_change_pct is null — a zero-value boundary (#183)', async () => {
    server.use(
      http.get('*/v1/summaries/weekly', () =>
        HttpResponse.json({
          items: [
            {
              public_id: '33333333-3333-3333-3333-333333333333',
              week_start: '2026-06-15',
              week_end: '2026-06-21',
              generated_at: '2026-06-22T01:30:00Z',
              todo_summary: { tasks_created: 0, tasks_completed: 0 },
              spending_summary: { status: 'unavailable' },
              investing_summary: {
                status: 'complete',
                portfolio_value_start: '0.00',
                portfolio_value_end: '800000.00',
                cash_start: '0.00',
                cash_end: '0.00',
                week_change: '800000.00',
                week_change_pct: null,
                currency: 'INR',
                start_snapshot_date: '2026-06-14',
                end_snapshot_date: '2026-06-21',
              },
              highlights: { flags: [] },
              read_at: '2026-06-22T02:00:00Z',
            },
          ],
          total: 1,
          limit: 12,
          offset: 0,
        }),
      ),
    );

    renderPage();

    expect(await screen.findByText('Weekly movement')).toBeInTheDocument();
    expect(screen.queryByText(/\(0\.00%\)|\(\+0\.00%\)/)).not.toBeInTheDocument();
    expect(screen.queryByText(/%\)/)).not.toBeInTheDocument();
  });

  it('shows a stale-data pill when data_stale is true (#183, spec-085)', async () => {
    server.use(
      http.get('*/v1/summaries/weekly', () =>
        HttpResponse.json({
          items: [
            {
              public_id: '44444444-4444-4444-4444-444444444444',
              week_start: '2026-06-15',
              week_end: '2026-06-21',
              generated_at: '2026-06-22T01:30:00Z',
              todo_summary: { tasks_created: 0, tasks_completed: 0 },
              spending_summary: { status: 'unavailable' },
              investing_summary: { status: 'unavailable' },
              highlights: { flags: [] },
              read_at: '2026-06-22T02:00:00Z',
              data_stale: true,
            },
          ],
          total: 1,
          limit: 12,
          offset: 0,
        }),
      ),
    );

    renderPage();

    expect(await screen.findByTestId('summary-stale-indicator')).toBeInTheDocument();
    expect(screen.getByText(/Data changed since this summary was generated/)).toBeInTheDocument();
  });

  it('shows only the most recent event on a regenerated summary, not both timestamps (#200)', async () => {
    server.use(
      http.get('*/v1/summaries/weekly', () =>
        HttpResponse.json({
          items: [
            {
              public_id: '77777777-7777-7777-7777-777777777777',
              week_start: '2026-06-15',
              week_end: '2026-06-21',
              generated_at: '2026-06-22T01:30:00Z',
              regenerated_at: '2026-06-23T00:00:00Z',
              regeneration_reason: 'fixed FX rate',
              todo_summary: { tasks_created: 0, tasks_completed: 0 },
              spending_summary: { status: 'unavailable' },
              investing_summary: { status: 'unavailable' },
              highlights: { flags: [] },
              read_at: '2026-06-23T02:00:00Z',
            },
          ],
          total: 1,
          limit: 12,
          offset: 0,
        }),
      ),
    );

    renderPage();

    // The regenerated event (with its reason) is shown; the original "Generated"
    // label is not printed alongside it as a near-duplicate timestamp.
    expect(await screen.findByText(/Regenerated .*fixed FX rate/)).toBeInTheDocument();
    expect(screen.queryByText(/^Generated /)).not.toBeInTheDocument();
    // The Reason field carries helper text explaining where the note goes.
    expect(
      screen.getByText(/Saved to this summary's history and shown in the header/),
    ).toBeInTheDocument();
  });

  it('switches to monthly summaries tab and renders monthly items', async () => {
    server.use(
      http.get('*/v1/summaries/weekly', () =>
        HttpResponse.json({
          items: [],
          total: 0,
          limit: 12,
          offset: 0,
        }),
      ),
      http.get('*/v1/summaries/monthly', () =>
        HttpResponse.json({
          items: [
            {
              public_id: '88888888-8888-8888-8888-888888888888',
              month_start: '2026-06-01',
              month_end: '2026-06-30',
              generated_at: '2026-07-01T01:30:00Z',
              todo_summary: { tasks_created: 15, tasks_completed: 12 },
              spending_summary: {
                status: 'complete',
                total_income: '20000.00',
                total_expense: '12000.00',
                net: '8000.00',
                currency: 'USD',
                has_multiple_currencies: false,
                top_categories: [],
                budget_utilization_pct: null,
                budgets_breached: 0,
              },
              investing_summary: {
                status: 'complete',
                portfolio_value_start: '50000.00',
                portfolio_value_end: '53500.00',
                cash_start: '2000.00',
                cash_end: '2100.00',
                week_change: '3500.00',
                week_change_pct: '7.00',
                currency: 'USD',
                start_snapshot_date: '2026-06-01',
                end_snapshot_date: '2026-06-30',
              },
              highlights: { flags: [] },
              read_at: '2026-07-01T02:00:00Z',
            },
          ],
          total: 1,
          limit: 12,
          offset: 0,
        }),
      ),
    );

    renderPage();

    // Default is weekly with empty state
    expect(await screen.findByText('No weekly summaries yet')).toBeInTheDocument();

    // Click Monthly Summaries
    fireEvent.click(screen.getByTestId('cadence-monthly-btn'));

    // Should find the monthly item rendered
    expect(await screen.findByText(/Month of June 2026/)).toBeInTheDocument();
    expect(screen.getByText('Tasks completed')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByTestId('generate-month-close-btn')).toBeInTheDocument();
  });

  it('opens generate week close modal and triggers generation', async () => {
    let generateWeeklyCalledWith: unknown = null;
    server.use(
      http.get('*/v1/summaries/weekly', () =>
        HttpResponse.json({
          items: [],
          total: 0,
          limit: 12,
          offset: 0,
        }),
      ),
      http.post('*/v1/summaries/weekly/generate', async ({ request }) => {
        generateWeeklyCalledWith = await request.json();
        return HttpResponse.json({
          public_id: '33333333-3333-3333-3333-333333333333',
          week_start: '2026-06-15',
          week_end: '2026-06-21',
          generated_at: '2026-06-22T01:30:00Z',
          todo_summary: { tasks_created: 0, tasks_completed: 0 },
          spending_summary: { status: 'unavailable' },
          investing_summary: { status: 'unavailable' },
          highlights: { flags: [] },
          read_at: null,
        });
      }),
    );

    renderPage();

    expect(await screen.findByText('No weekly summaries yet')).toBeInTheDocument();
    const generateBtn = screen.getByTestId('generate-week-close-btn');
    expect(generateBtn).toBeInTheDocument();

    fireEvent.click(generateBtn);
    expect(await screen.findByText('Generate Weekly Summary')).toBeInTheDocument();

    const dateInput = screen.getByTestId('generate-weekly-date-input');
    fireEvent.change(dateInput, { target: { value: '2026-06-17' } });

    const submitBtn = screen.getByTestId('submit-generate-weekly-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(generateWeeklyCalledWith).toEqual({ date: '2026-06-17' });
    });
  });

  it('opens edit monthly close modal, submits corrections, and sends patch payload', async () => {
    let patchCalledWith: unknown = null;
    const summaryId = '99999999-9999-9999-9999-999999999999';

    server.use(
      http.get('*/v1/summaries/weekly', () =>
        HttpResponse.json({
          items: [],
          total: 0,
          limit: 12,
          offset: 0,
        }),
      ),
      http.get('*/v1/summaries/monthly', () =>
        HttpResponse.json({
          items: [
            {
              public_id: summaryId,
              month_start: '2026-06-01',
              month_end: '2026-06-30',
              generated_at: '2026-07-01T01:30:00Z',
              todo_summary: { tasks_created: 10, tasks_completed: 8 },
              spending_summary: {
                status: 'complete',
                total_income: '5000.00',
                total_expense: '3000.00',
                net: '2000.00',
                currency: 'USD',
                has_multiple_currencies: false,
                top_categories: [],
                budget_utilization_pct: null,
                budgets_breached: 0,
              },
              investing_summary: {
                status: 'complete',
                portfolio_value_start: '40000.00',
                portfolio_value_end: '42000.00',
                cash_start: '1000.00',
                cash_end: '1500.00',
                week_change: '2000.00',
                week_change_pct: '5.00',
                currency: 'USD',
                start_snapshot_date: '2026-06-01',
                end_snapshot_date: '2026-06-30',
              },
              dividend_summary: {
                status: 'complete',
                total_net: '250.00',
                currency: 'USD',
                count: 1,
                by_symbol: [],
                has_multiple_currencies: false,
              },
              net_worth_summary: {
                status: 'complete',
                net_worth_start: '45000.00',
                net_worth_end: '47000.00',
                week_change: '2000.00',
                week_change_pct: '4.44',
                currency: 'USD',
                start_snapshot_date: '2026-06-01',
                end_snapshot_date: '2026-06-30',
              },
              highlights: { flags: [] },
              read_at: '2026-07-01T02:00:00Z',
            },
          ],
          total: 1,
          limit: 12,
          offset: 0,
        }),
      ),
      http.patch('*/v1/summaries/monthly/:id', async ({ request }) => {
        patchCalledWith = await request.json();
        return HttpResponse.json({
          public_id: summaryId,
          month_start: '2026-06-01',
          month_end: '2026-06-30',
          generated_at: '2026-07-01T01:30:00Z',
          regenerated_at: '2026-07-02T10:00:00Z',
          regeneration_reason: 'Manual adjustment for dividend withholding tax',
          todo_summary: { tasks_created: 10, tasks_completed: 8 },
          spending_summary: {
            status: 'complete',
            total_income: '5500.00',
            total_expense: '3000.00',
            net: '2500.00',
            currency: 'USD',
            has_multiple_currencies: false,
            top_categories: [],
          },
          investing_summary: {
            status: 'complete',
            portfolio_value_start: '40000.00',
            portfolio_value_end: '43000.00',
            cash_start: '1000.00',
            cash_end: '1500.00',
            currency: 'USD',
          },
          highlights: { flags: [] },
          read_at: '2026-07-01T02:00:00Z',
        });
      }),
    );

    renderPage();

    // Switch to monthly
    fireEvent.click(screen.getByTestId('cadence-monthly-btn'));
    expect(await screen.findByText(/Month of June 2026/)).toBeInTheDocument();

    const editBtn = screen.getByTestId(`edit-summary-${summaryId}`);
    expect(editBtn).toBeInTheDocument();
    fireEvent.click(editBtn);

    // Modal opens
    expect(await screen.findByText(/Edit Monthly Close:/)).toBeInTheDocument();

    // Change total income and reason
    const incomeInput = screen.getByTestId('edit-monthly-income-input');
    fireEvent.change(incomeInput, { target: { value: '5500.00' } });

    const reasonInput = screen.getByTestId('edit-monthly-reason-input');
    fireEvent.change(reasonInput, {
      target: { value: 'Manual adjustment for dividend withholding tax' },
    });

    const saveBtn = screen.getByTestId('submit-edit-monthly-btn');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(patchCalledWith).not.toBeNull();
    });

    const payload = patchCalledWith as {
      reason?: string;
      spending_summary?: { total_income?: string };
    };
    expect(payload.reason).toBe('Manual adjustment for dividend withholding tax');
    expect(payload.spending_summary?.total_income).toBe('5500.00');
  });
});

