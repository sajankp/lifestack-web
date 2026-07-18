import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/ui/toast';
import { http, HttpResponse } from 'msw';

import { ImportsPage } from './ImportsPage';
import { server } from '../test/setup';

const renderWithQuery = (ui: React.ReactNode, initialEntry = '/imports') => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={client}>
        <ToastProvider>{ui}</ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
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
      http.get('*/v1/spending/categories', () =>
        HttpResponse.json({ items: [], total: 0, limit: 500, offset: 0 }),
      ),
      http.get('*/v1/finance/accounts', () =>
        HttpResponse.json({ items: [], total: 0, limit: 200, offset: 0 }),
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
    expect(await screen.findByText('No errors')).toBeInTheDocument();
    expect(await screen.findByTestId('imports-delete')).toHaveTextContent('Roll back import');
    fireEvent.click(screen.getByTestId('imports-delete'));
    expect(await screen.findByRole('dialog')).toHaveTextContent(/Roll back import\?/i);
    expect(deletedImportId).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Roll back' }));

    await waitFor(() => expect(deletedImportId).toBe(importId));
    expect(screen.queryByTestId('imports-delete')).not.toBeInTheDocument();
  });

  it('allows deleting a batch stuck at uploaded (background validation never ran)', async () => {
    let deletedImportId: string | null = null;
    const importId = '22222222-2222-2222-2222-222222222222';

    const stuckBatch = {
      public_id: importId,
      status: 'uploaded',
      module: 'spending-transactions',
      filename: 'stuck.csv',
      content_type: 'text/csv',
      file_size_bytes: 64,
      file_sha256: 'def',
      storage_backend: 'db',
      storage_key: null,
      total_rows: 0,
      valid_rows: 0,
      error_rows: 0,
      started_at: '2026-06-01T00:00:00Z',
      validated_at: null,
      committed_at: null,
    };

    server.use(
      http.get('*/v1/imports', () =>
        HttpResponse.json({ items: [stuckBatch], total: 1, limit: 20, offset: 0 }),
      ),
      http.get(`*/v1/imports/${importId}`, () =>
        HttpResponse.json({
          import_batch: stuckBatch,
          errors: [],
          error_summary: { total_errors: 0, returned_errors: 0, by_code: {}, by_field: {} },
        }),
      ),
      http.delete(`*/v1/imports/${importId}`, () => {
        deletedImportId = importId;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderWithQuery(<ImportsPage />);

    fireEvent.click(await screen.findByTestId(`imports-list-item-${importId}`));
    const deleteButton = await screen.findByTestId('imports-delete');
    expect(deleteButton).toHaveTextContent('Delete import batch');
    expect(deleteButton).toBeEnabled();

    fireEvent.click(deleteButton);
    expect(await screen.findByRole('dialog')).toHaveTextContent(/Delete import batch\?/i);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

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

  it('requires a brokerage target account for CAMS CAS and hides the template button', async () => {
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
            {
              public_id: 'acc-zerodha',
              name: 'Zerodha',
              account_type: 'brokerage',
              default_currency_code: 'INR',
              is_active: true,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
          ],
          total: 2,
          limit: 200,
          offset: 0,
        }),
      ),
    );

    renderWithQuery(<ImportsPage />);
    fireEvent.click(screen.getByText('New Import'));

    fireEvent.change(screen.getByTestId('imports-module-select'), {
      target: { value: 'investing-cams-cas' },
    });

    expect(screen.queryByTestId('imports-download-template')).not.toBeInTheDocument();
    expect(await screen.findByTestId('imports-target-account-brokerage')).toBeInTheDocument();
    expect(screen.queryByTestId('imports-file-password')).not.toBeInTheDocument();

    const file = new File(['%PDF-1.4'], 'cas.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByTestId('imports-file-input'), { target: { files: [file] } });

    // No target account selected yet — upload stays disabled.
    expect(screen.getByTestId('imports-upload-validate')).toBeDisabled();

    fireEvent.click(screen.getByTestId('imports-target-account-brokerage'));
    fireEvent.click(await screen.findByRole('option', { name: /Zerodha/ }));

    expect(screen.getByTestId('imports-upload-validate')).not.toBeDisabled();
  });

  it('sends target_account_id and file_password for a Demat CAS upload', async () => {
    let uploadedModule: string | null = null;
    let uploadedTargetAccountId: string | null = null;
    let uploadedPassword: string | null = null;

    server.use(
      http.get('*/v1/finance/accounts', () =>
        HttpResponse.json({
          items: [
            {
              public_id: 'acc-zerodha',
              name: 'Zerodha',
              account_type: 'brokerage',
              default_currency_code: 'INR',
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
        uploadedModule = formData.get('module') as string;
        uploadedTargetAccountId = formData.get('target_account_id') as string | null;
        uploadedPassword = formData.get('file_password') as string | null;
        return HttpResponse.json({
          import_batch: {
            public_id: '99999999-9999-9999-9999-999999999997',
            status: 'validated',
            module: 'investing-demat-cas',
            total_rows: 1,
            valid_rows: 1,
            error_rows: 0,
            filename: 'cas.pdf',
          },
          errors: [],
        });
      }),
    );

    renderWithQuery(<ImportsPage />);
    fireEvent.click(screen.getByText('New Import'));

    fireEvent.change(screen.getByTestId('imports-module-select'), {
      target: { value: 'investing-demat-cas' },
    });

    fireEvent.click(await screen.findByTestId('imports-target-account-brokerage'));
    fireEvent.click(await screen.findByRole('option', { name: /Zerodha/ }));

    fireEvent.change(screen.getByTestId('imports-file-password'), {
      target: { value: 'ABCDE1234F' },
    });

    const file = new File(['%PDF-1.4'], 'cas.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByTestId('imports-file-input'), { target: { files: [file] } });
    fireEvent.click(screen.getByTestId('imports-upload-validate'));

    await waitFor(() => {
      expect(uploadedModule).toBe('investing-demat-cas');
    });
    expect(uploadedTargetAccountId).toBe('acc-zerodha');
    expect(uploadedPassword).toBe('ABCDE1234F');
  });

  it('renders per-row identifier_status in the investing-constituents preview (spec-010 §3.4)', async () => {
    const importId = '11111111-1111-1111-1111-111111111112';

    server.use(
      http.get('*/v1/imports', () =>
        HttpResponse.json({
          items: [
            {
              public_id: importId,
              status: 'validated',
              module: 'investing-constituents',
              filename: 'constituents.csv',
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
              committed_at: null,
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
            status: 'validated',
            module: 'investing-constituents',
            filename: 'constituents.csv',
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
            committed_at: null,
          },
          errors: [],
          error_summary: { total_errors: 0, returned_errors: 0, by_code: {}, by_field: {} },
          preview_rows: [
            {
              row_number: 1,
              payload_json: {
                instrument_symbol: 'VTI',
                company_name: 'Apple Inc',
                company_ticker: 'AAPL',
                company_isin: 'US0378331005',
                weight: '0.60',
                as_of_date: '2026-06-01',
                identifier_status: 'resolved',
              },
            },
            {
              row_number: 2,
              payload_json: {
                instrument_symbol: 'VTI',
                company_name: 'Some Private Fund',
                company_ticker: null,
                company_isin: null,
                weight: '0.40',
                as_of_date: '2026-06-01',
                identifier_status: 'unresolved',
              },
            },
          ],
        }),
      ),
    );

    renderWithQuery(<ImportsPage />);

    fireEvent.click(await screen.findByTestId(`imports-list-item-${importId}`));

    expect(await screen.findByText('resolved')).toBeInTheDocument();
    expect(screen.getByText('unresolved')).toBeInTheDocument();
  });

  it('resolves preview category ids to names and keeps full description in tooltip', async () => {
    const importId = '33333333-3333-3333-3333-333333333333';
    const rawCategoryUuid = '5b7a47a3-c7a5-4619-9a9d-111111111111';
    const longDescription =
      'Groceries weekly bulk purchase with discount and long memo for preview readability checks';

    server.use(
      http.get('*/v1/spending/categories', () =>
        HttpResponse.json({
          items: [{ public_id: 'cat-food', name: 'Food', icon: null, color: '#64748b', is_system: false }],
          total: 1,
          limit: 500,
          offset: 0,
        }),
      ),
      http.get('*/v1/imports', () =>
        HttpResponse.json({
          items: [
            {
              public_id: importId,
              status: 'validated',
              module: 'spending-transactions',
              filename: 'spending.csv',
              content_type: 'text/csv',
              file_size_bytes: 128,
              file_sha256: 'abc',
              storage_backend: 'db',
              storage_key: null,
              total_rows: 1,
              valid_rows: 1,
              error_rows: 0,
              started_at: '2026-06-01T00:00:00Z',
              validated_at: '2026-06-01T00:00:01Z',
              committed_at: null,
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
            status: 'validated',
            module: 'spending-transactions',
            filename: 'spending.csv',
            content_type: 'text/csv',
            file_size_bytes: 128,
            file_sha256: 'abc',
            storage_backend: 'db',
            storage_key: null,
            total_rows: 1,
            valid_rows: 1,
            error_rows: 0,
            started_at: '2026-06-01T00:00:00Z',
            validated_at: '2026-06-01T00:00:01Z',
            committed_at: null,
          },
          errors: [],
          error_summary: { total_errors: 0, returned_errors: 0, by_code: {}, by_field: {} },
          preview_rows: [
            {
              row_number: 1,
              payload_json: {
                occurred_at: '2026-06-01',
                type: 'expense',
                amount: '42.50',
                category_name: rawCategoryUuid,
                category_id: 'cat-food',
                description: longDescription,
              },
            },
          ],
        }),
      ),
    );

    renderWithQuery(<ImportsPage />);

    fireEvent.click(await screen.findByTestId(`imports-list-item-${importId}`));

    expect(await screen.findByText('Food')).toBeInTheDocument();
    expect(screen.queryByText(rawCategoryUuid)).not.toBeInTheDocument();

    const descriptionCell = screen.getByText(longDescription).closest('td');
    expect(descriptionCell).toHaveAttribute('title', longDescription);
  });

  it('refreshes to completed state after apply and keeps recovery below primary action', async () => {
    const importId = '44444444-4444-4444-4444-444444444444';
    let status: 'validated' | 'completed' = 'validated';

    const makeBatch = () => ({
      public_id: importId,
      status,
      module: 'spending-budgets',
      filename: 'budgets.csv',
      content_type: 'text/csv',
      file_size_bytes: 128,
      file_sha256: 'abc',
      storage_backend: 'db',
      storage_key: null,
      total_rows: 1,
      valid_rows: 1,
      error_rows: 0,
      started_at: '2026-06-01T00:00:00Z',
      validated_at: '2026-06-01T00:00:01Z',
      committed_at: status === 'completed' ? '2026-06-01T00:00:02Z' : null,
    });

    server.use(
      http.get('*/v1/imports', () =>
        HttpResponse.json({ items: [makeBatch()], total: 1, limit: 20, offset: 0 }),
      ),
      http.get(`*/v1/imports/${importId}`, () =>
        HttpResponse.json({
          import_batch: makeBatch(),
          errors: [],
          error_summary: { total_errors: 0, returned_errors: 0, by_code: {}, by_field: {} },
          preview_rows: [
            {
              row_number: 1,
              payload_json: { month_start: '2026-06-01', category_id: 'cat-food', amount: '1000' },
            },
          ],
        }),
      ),
      http.post(`*/v1/imports/${importId}/commit`, () => {
        status = 'completed';
        return HttpResponse.json({ import_batch: makeBatch(), inserted_rows: 1 });
      }),
    );

    renderWithQuery(<ImportsPage />);

    fireEvent.click(await screen.findByTestId(`imports-list-item-${importId}`));

    const applyButton = await screen.findByTestId('imports-commit');
    const recoveryHeading = await screen.findByText('Recovery');
    expect(
      Boolean(applyButton.compareDocumentPosition(recoveryHeading) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);

    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(screen.queryByTestId('imports-commit')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Import applied')).toBeInTheDocument();
  });
});
