import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../components/ui/toast';
import { http, HttpResponse } from 'msw';

import { ExportsPage } from './ExportsPage';
import { server } from '../test/setup';

const renderWithQuery = (ui: React.ReactNode) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
};

const readyExport = {
  public_id: '22222222-2222-2222-2222-222222222222',
  workspace_id: 1,
  requested_by: 1,
  format: 'json',
  schema_version: 1,
  scope: { modules: ['todo', 'spending', 'investing'] },
  status: 'ready',
  storage_key: 'db://exports/22222222-2222-2222-2222-222222222222',
  artifact_mime_type: 'application/json',
  artifact_filename: 'lifestack-export.json',
  error_message: null,
  created_at: '2026-06-01T00:00:00Z',
  completed_at: '2026-06-01T00:00:01Z',
};

describe('ExportsPage', () => {
  it('creates an export and shows lifecycle controls', async () => {
    let createdPayload: unknown = null;

    server.use(
      http.post('*/v1/exports', async ({ request }) => {
        createdPayload = await request.json();
        return HttpResponse.json(readyExport, { status: 201 });
      }),
      http.get(`*/v1/exports/${readyExport.public_id}`, () => HttpResponse.json(readyExport)),
    );

    renderWithQuery(<ExportsPage />);

    fireEvent.click(screen.getByText('Create Export'));
    fireEvent.click(screen.getByTestId('exports-create'));

    await waitFor(() =>
      expect(createdPayload).toEqual({
        format: 'json',
        modules: ['todo', 'spending', 'investing'],
      }),
    );
    expect(await screen.findByTestId('exports-status')).toHaveTextContent('ready');
    expect(screen.getByTestId('exports-download')).not.toBeDisabled();
    expect(screen.getByTestId('exports-delete')).not.toBeDisabled();
  });

  it('deletes the current export after it is ready', async () => {
    let deletedExportId: string | null = null;

    server.use(
      http.post('*/v1/exports', () => HttpResponse.json(readyExport, { status: 201 })),
      http.get(`*/v1/exports/${readyExport.public_id}`, () => HttpResponse.json(readyExport)),
      http.delete(`*/v1/exports/${readyExport.public_id}`, () => {
        deletedExportId = readyExport.public_id;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderWithQuery(<ExportsPage />);

    fireEvent.click(screen.getByText('Create Export'));
    fireEvent.click(screen.getByTestId('exports-create'));
    expect(await screen.findByTestId('exports-status')).toHaveTextContent('ready');
    fireEvent.click(screen.getByTestId('exports-delete'));
    expect(await screen.findByRole('dialog')).toHaveTextContent(/Delete export\?/i);
    expect(deletedExportId).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deletedExportId).toBe(readyExport.public_id));
    expect(screen.queryByTestId('exports-status')).not.toBeInTheDocument();
  });

  it('falls back for invalid export dates', async () => {
    const exportWithInvalidDates = {
      ...readyExport,
      created_at: 'not-a-date',
      completed_at: 'also-not-a-date',
    };

    server.use(
      http.post('*/v1/exports', () => HttpResponse.json(exportWithInvalidDates, { status: 201 })),
      http.get(`*/v1/exports/${readyExport.public_id}`, () =>
        HttpResponse.json(exportWithInvalidDates),
      ),
    );

    renderWithQuery(<ExportsPage />);

    fireEvent.click(screen.getByText('Create Export'));
    fireEvent.click(screen.getByTestId('exports-create'));

    expect(await screen.findByText('Created: -')).toBeInTheDocument();
    expect(screen.getByText('Completed: -')).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });
});
