import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

import { ImportsPage } from './ImportsPage';
import { server } from '../test/setup';

const renderWithQuery = (ui: React.ReactNode) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = vi.fn();
});

describe('ImportsPage', () => {
  beforeEach(() => {
    server.use(
      http.get('*/v1/imports', () =>
        HttpResponse.json({ items: [], total: 0, limit: 20, offset: 0 }),
      ),
    );
  });

  it('renders the page and forms', async () => {
    renderWithQuery(<ImportsPage />);
    expect(await screen.findByText('Bulk Imports')).toBeInTheDocument();

    // Open Modal
    fireEvent.click(screen.getByText('New Import'));

    expect(screen.getByTestId('imports-module-select')).toBeInTheDocument();
    expect(screen.getByTestId('imports-file-input')).toBeInTheDocument();
    expect(screen.getByTestId('imports-download-template')).toBeDisabled();
    expect(screen.getByTestId('imports-upload-validate')).toBeDisabled();
  });

  it('shows error for file size > 10MB', async () => {
    renderWithQuery(<ImportsPage />);

    // Open Modal
    fireEvent.click(screen.getByText('New Import'));

    // Select module
    const select = screen.getByTestId('imports-module-select');
    fireEvent.change(select, { target: { value: 'spending-transactions' } });

    // Mock 11MB file
    const file = new File(['x'.repeat(11 * 1024 * 1024)], 'large.csv', { type: 'text/csv' });
    const fileInput = screen.getByTestId('imports-file-input');
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Click upload
    const uploadBtn = screen.getByTestId('imports-upload-validate');
    expect(uploadBtn).not.toBeDisabled();
    fireEvent.click(uploadBtn);

    expect(await screen.findByTestId('imports-upload-error')).toHaveTextContent(
      'File size exceeds the maximum limit of 10MB.',
    );
  });

  it('shows error for non-CSV file', async () => {
    renderWithQuery(<ImportsPage />);

    // Open Modal
    fireEvent.click(screen.getByText('New Import'));

    // Select module
    const select = screen.getByTestId('imports-module-select');
    fireEvent.change(select, { target: { value: 'spending-transactions' } });

    // Mock .txt file
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
    const fileInput = screen.getByTestId('imports-file-input');
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Click upload
    const uploadBtn = screen.getByTestId('imports-upload-validate');
    fireEvent.click(uploadBtn);

    expect(await screen.findByTestId('imports-upload-error')).toHaveTextContent(
      'Invalid file format. Please upload a CSV or XLSX file.',
    );
  });

  it('successfully uploads valid file', async () => {
    let uploadedFile: File | null = null;
    let uploadedModule: string | null = null;

    server.use(
      http.post('*/v1/imports', async ({ request }) => {
        const formData = await request.formData();
        uploadedFile = formData.get('file') as File;
        uploadedModule = formData.get('module') as string;
        return HttpResponse.json({
          import_batch: {
            public_id: '99999999-9999-9999-9999-999999999999',
            status: 'validated',
            module: 'spending-transactions',
            total_rows: 5,
            valid_rows: 5,
            error_rows: 0,
            filename: 'test.csv',
          },
          errors: [],
        });
      }),
    );

    renderWithQuery(<ImportsPage />);

    // Open Modal
    fireEvent.click(screen.getByText('New Import'));

    // Select module
    const select = screen.getByTestId('imports-module-select');
    fireEvent.change(select, { target: { value: 'spending-transactions' } });

    // Mock file
    const file = new File(['col1,col2\nval1,val2'], 'test.csv', { type: 'text/csv' });
    const fileInput = screen.getByTestId('imports-file-input');
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Click upload
    const uploadBtn = screen.getByTestId('imports-upload-validate');
    fireEvent.click(uploadBtn);

    await waitFor(() => {
      expect(uploadedFile).not.toBeNull();
    });
    expect(uploadedModule).toBe('spending-transactions');
  });

  it('deletes or rolls back a selected import batch', async () => {
    let deletedImportId: string | null = null;
    const importId = '11111111-1111-1111-1111-111111111111';

    server.use(
      http.get('*/v1/imports', () =>
        HttpResponse.json({
          items: [
            {
              public_id: importId,
              status: 'completed',
              module: 'spending-budgets',
              filename: 'budgets.csv',
              content_type: 'text/csv',
              file_size_bytes: 128,
              file_sha256: 'abc',
              storage_backend: 'db',
              storage_key: null,
              total_rows: 2,
              valid_rows: 2,
              error_rows: 0,
              started_at: '2026-06-01T00:00:00Z',
              validated_at: '2026-06-01T00:00:01Z',
              committed_at: '2026-06-01T00:00:02Z',
            },
          ],
          total: 1,
          limit: 20,
          offset: 0,
        }),
      ),
      http.get(`*/v1/imports/${importId}`, () =>
        HttpResponse.json({
          import_batch: {
            public_id: importId,
            status: 'completed',
            module: 'spending-budgets',
            filename: 'budgets.csv',
            content_type: 'text/csv',
            file_size_bytes: 128,
            file_sha256: 'abc',
            storage_backend: 'db',
            storage_key: null,
            total_rows: 2,
            valid_rows: 2,
            error_rows: 0,
            started_at: '2026-06-01T00:00:00Z',
            validated_at: '2026-06-01T00:00:01Z',
            committed_at: '2026-06-01T00:00:02Z',
          },
          errors: [],
          error_summary: {
            total_errors: 0,
            returned_errors: 0,
            by_code: {},
            by_field: {},
          },
        }),
      ),
      http.delete(`*/v1/imports/${importId}`, () => {
        deletedImportId = importId;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderWithQuery(<ImportsPage />);

    fireEvent.click(await screen.findByTestId(`imports-list-item-${importId}`));
    expect(await screen.findByTestId('imports-delete')).toHaveTextContent('Roll back import');
    fireEvent.click(screen.getByTestId('imports-delete'));

    await waitFor(() => expect(deletedImportId).toBe(importId));
    expect(screen.queryByTestId('imports-delete')).not.toBeInTheDocument();
  });

  it('shows the target-account picker only for spending-transactions and sends the selection', async () => {
    let uploadedTargetAccountId: string | null | undefined;

    server.use(
      http.get('*/v1/finance/accounts', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'acc-checking',
              name: 'Checking',
              account_type: 'bank',
              default_currency_code: 'USD',
              is_active: true,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
          ],
          total: 1,
          limit: 200,
          offset: 0,
        }),
      ),
      http.post('*/v1/imports', async ({ request }) => {
        const formData = await request.formData();
        uploadedTargetAccountId = formData.get('target_account_id') as string | null;
        return HttpResponse.json({
          import_batch: {
            public_id: '99999999-9999-9999-9999-999999999998',
            status: 'validated',
            module: 'spending-transactions',
            total_rows: 1,
            valid_rows: 1,
            error_rows: 0,
            filename: 'test.csv',
          },
          errors: [],
        });
      }),
    );

    renderWithQuery(<ImportsPage />);
    fireEvent.click(screen.getByText('New Import'));

    // Not shown until spending-transactions is selected.
    expect(screen.queryByTestId('imports-target-account')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('imports-module-select'), {
      target: { value: 'spending-transactions' },
    });
    expect(await screen.findByTestId('imports-target-account')).toBeInTheDocument();

    // Not shown for a module spec-054 doesn't cover.
    fireEvent.change(screen.getByTestId('imports-module-select'), {
      target: { value: 'spending-budgets' },
    });
    expect(screen.queryByTestId('imports-target-account')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('imports-module-select'), {
      target: { value: 'spending-transactions' },
    });
    fireEvent.click(await screen.findByTestId('imports-target-account'));
    fireEvent.click(await screen.findByRole('option', { name: /Checking/ }));

    const file = new File(['col1,col2\nval1,val2'], 'test.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByTestId('imports-file-input'), { target: { files: [file] } });
    fireEvent.click(screen.getByTestId('imports-upload-validate'));

    await waitFor(() => {
      expect(uploadedTargetAccountId).toBe('acc-checking');
    });
  });
});
