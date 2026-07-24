import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../components/ui/toast';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { HealthPage } from './HealthPage';
import { server } from '../test/setup';

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <HealthPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
};

const emptyDefaults = () => [
  http.get('*/v1/health/medications', () =>
    HttpResponse.json({ items: [], total: 0, limit: 50, offset: 0 }),
  ),
  http.get('*/v1/health/weight/trend', () =>
    HttpResponse.json({
      entries: [],
      latest_kg: null,
      delta_7d_kg: null,
      delta_30d_kg: null,
      min_kg: null,
      max_kg: null,
    }),
  ),
];

const overdueSlot = {
  medication_public_id: 'med-1',
  medication_name: 'Metformin',
  dose_text: '500 mg',
  scheduled_for: '2026-01-01T09:00:00Z',
  status: 'missed',
  event_public_id: null,
  note: null,
  taken_at: null,
};

describe('HealthPage', () => {
  it('shows the Catch up section when there are overdue doses', async () => {
    server.use(
      ...emptyDefaults(),
      http.get('*/v1/health/medications/schedule', () => HttpResponse.json([])),
      http.get('*/v1/health/medications/overdue', () => HttpResponse.json([overdueSlot])),
    );

    renderPage();

    expect(await screen.findByTestId('catch-up-section')).toHaveTextContent('Catch up (1)');
  });

  it('hides the Catch up section when nothing is overdue', async () => {
    server.use(
      ...emptyDefaults(),
      http.get('*/v1/health/medications/schedule', () => HttpResponse.json([])),
      http.get('*/v1/health/medications/overdue', () => HttpResponse.json([])),
    );

    renderPage();

    await screen.findByTestId('dose-date-label');
    expect(screen.queryByTestId('catch-up-section')).not.toBeInTheDocument();
  });

  it('navigates between days and requests the schedule for the selected date', async () => {
    const requestedDates: string[] = [];
    server.use(
      ...emptyDefaults(),
      http.get('*/v1/health/medications/schedule', ({ request }) => {
        const url = new URL(request.url);
        requestedDates.push(url.searchParams.get('date') ?? '');
        return HttpResponse.json([]);
      }),
      http.get('*/v1/health/medications/overdue', () => HttpResponse.json([])),
    );

    renderPage();

    const label = await screen.findByTestId('dose-date-label');
    expect(label).toHaveTextContent('Today');

    fireEvent.click(screen.getByTestId('dose-date-prev'));
    await waitFor(() => expect(screen.getByTestId('dose-date-label')).toHaveTextContent('Yesterday'));
    expect(screen.getByTestId('dose-date-today')).toBeInTheDocument();

    // The schedule query was re-issued for a different (earlier) date.
    await waitFor(() => expect(new Set(requestedDates).size).toBeGreaterThan(1));
  });
});
