import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/setup';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { HermesNote } from './HermesNote';

const REPORT_ID = '11111111-1111-4111-8111-111111111111';

const renderNote = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <HermesNote />
    </QueryClientProvider>,
  );

const serve = (detail: Record<string, unknown> | null, listItems = [{ public_id: REPORT_ID }]) => {
  useWorkspaceStore.getState().setActiveWorkspaceId('77777777-7777-7777-7777-777777777777');
  server.use(
    http.get('*/v1/platform/workspaces/', () =>
      HttpResponse.json({
        items: [
          {
            public_id: '77777777-7777-7777-7777-777777777777',
            name: 'Alpha Workspace',
            description: null,
            is_active: true,
            role: 'owner',
          },
        ],
      }),
    ),
    http.get('*/v1/investing/portfolio-reports', () =>
      HttpResponse.json({
        total: listItems.length,
        next_cursor: null,
        items: listItems.map((item) => ({
          run_id: 'r',
          as_of: '2026-11-28',
          created_at: '2026-11-28T00:00:00Z',
          ...item,
        })),
      }),
    ),
    http.get(`*/v1/investing/portfolio-reports/${REPORT_ID}`, ({ request }) => {
      const wantsPayload = new URL(request.url).searchParams.get('include_payload') === 'true';
      return HttpResponse.json({
        public_id: REPORT_ID,
        run_id: 'r',
        as_of: '2026-11-28',
        created_at: '2026-11-28T00:00:00Z',
        ...(detail && wantsPayload ? detail : {}),
      });
    }),
  );
};

describe('HermesNote', () => {
  it('shows the latest actions note as markdown under "Hermes note · date"', async () => {
    serve({ actions_md: '## This week\n\n- Trim **INFY**\n- Hold gold' });
    renderNote();

    const card = await screen.findByTestId('hermes-note');
    expect(card).toHaveTextContent('Hermes note');
    expect(card).toHaveTextContent('2026');
    expect(card.querySelectorAll('li')).toHaveLength(2);
    expect(card.querySelector('strong')).toHaveTextContent('INFY');
  });

  it('collapses and expands', async () => {
    serve({ actions_md: 'Hold gold' });
    renderNote();

    expect(await screen.findByText('Hold gold')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('hermes-note-toggle'));
    expect(screen.queryByText('Hold gold')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('hermes-note-toggle'));
    expect(screen.getByText('Hold gold')).toBeInTheDocument();
  });

  it('renders nothing when the report has no note', async () => {
    serve({ actions_md: null });
    renderNote();
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(screen.queryByTestId('hermes-note')).not.toBeInTheDocument();
  });

  it('renders nothing when there is no report yet', async () => {
    serve(null, []);
    renderNote();
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(screen.queryByTestId('hermes-note')).not.toBeInTheDocument();
  });
});
