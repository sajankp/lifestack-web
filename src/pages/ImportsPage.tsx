import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { PageHero } from '../components/layout/PageHero';
import { PageShell } from '../components/layout/PageShell';
import { DropdownSelect } from '../components/DropdownSelect';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useToast } from '../components/ui/toast';
import { importsService } from '../services/imports';
import { financeService } from '../services/finance';
import type { ImportErrorItem, ImportModule, ImportValidateResponse } from '../types/imports';
import { formatDate } from '../utils/dateFormat';

const MODULE_OPTIONS: Array<{ value: ImportModule; label: string; testId?: string }> = [
  { value: 'spending-transactions', label: 'Spending Transactions' },
  { value: 'spending-budgets', label: 'Spending Budgets' },
  { value: 'investing-constituents', label: 'Investing Constituents' },
  { value: 'investing-orders', label: 'Investing Orders', testId: 'import-type-investing-orders' },
  { value: 'finance-transfers', label: 'Account Transfers', testId: 'import-type-finance-transfers' },
  {
    value: 'investing-cams-cas',
    label: 'CAMS CAS (Mutual Funds)',
    testId: 'import-type-investing-cams-cas',
  },
  {
    value: 'investing-demat-cas',
    label: 'Demat CAS (Holdings Verification)',
    testId: 'import-type-investing-demat-cas',
  },
];

// PDF-based imports (spec-056, spec-060): no CSV template, a required
// brokerage target account, and — for Demat CAS only — a statement password.
const PDF_MODULES: ReadonlySet<ImportModule> = new Set(['investing-cams-cas', 'investing-demat-cas']);
const isPdfModule = (m: ImportModule | ''): m is ImportModule => PDF_MODULES.has(m as ImportModule);

// Renders a skipped-row / corporate-action-suspected advisory entry as
// readable "key: value" pairs instead of a raw JSON blob.
const formatAdvisoryEntry = (entry: Record<string, unknown>): string =>
  Object.entries(entry)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');

const lifecycleCopy = (status: string) => {
  if (status === 'completed') {
    return {
      action: 'Roll back import',
      description: 'Rollback deletes records created by this committed import when source metadata is available.',
    };
  }
  if (status === 'validated' || status === 'failed_validation') {
    return {
      action: 'Delete import batch',
      description: 'Delete the validation batch, uploaded artifact, preview rows, and validation errors.',
    };
  }
  return {
    action: 'Delete import batch',
    description: 'Deletion is available after validation or commit has finished.',
  };
};

const IMPORT_STATUS_LABELS: Record<string, string> = {
  uploaded: 'Uploaded',
  validated: 'Validated',
  failed_validation: 'Validation failed',
  committing: 'Applying',
  completed: 'Completed',
  failed_commit: 'Apply failed',
};

const importStatusLabel = (status: string | null | undefined): string => {
  if (!status) return '';
  return IMPORT_STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
};

export const ImportsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [module, setModule] = useState<ImportModule | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [targetAccountId, setTargetAccountId] = useState('');
  const [filePassword, setFilePassword] = useState('');
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [latestValidation, setLatestValidation] = useState<ImportValidateResponse | null>(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const { data: accountsResponse } = useQuery({
    queryKey: ['finance', 'accounts', 'imports'],
    queryFn: () => financeService.getAccounts(200, 0),
  });
  // No account-type restriction for the import-level target account
  // (spec-054) — any active account works, matching how a row's
  // account_name column already resolves for spending-transaction imports.
  const targetAccountOptions = useMemo(
    () =>
      (accountsResponse?.items ?? [])
        .filter((account) => account.is_active)
        .map((account) => ({
          value: account.public_id,
          label: `${account.name} (${account.account_type.replace('_', ' ')})`,
        })),
    [accountsResponse?.items]
  );
  // CAMS/Demat CAS PDFs can only target a brokerage account (backend-enforced).
  const brokerageAccountOptions = useMemo(
    () =>
      (accountsResponse?.items ?? [])
        .filter((account) => account.is_active && account.account_type === 'brokerage')
        .map((account) => ({ value: account.public_id, label: account.name })),
    [accountsResponse?.items]
  );

  const { data: importsResponse, isLoading: isLoadingImports } = useQuery({
    queryKey: ['imports', 'list'],
    queryFn: () => importsService.listImports(20, 0),
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      const hasPending = items.some((item) => {
        // A batch actively committing should keep being polled regardless of
        // how long the user spent reviewing validation results beforehand --
        // only `uploaded` (awaiting/mid validation) is subject to the
        // stale/abandoned-import timeout below.
        if (item.status === 'committing') {
          return true;
        }
        if (item.status !== 'uploaded') {
          return false;
        }
        // Avoid polling indefinitely for stale/abandoned imports (older than 2 minutes)
        const startedAtMs = new Date(item.started_at).getTime();
        const ageMs = Date.now() - startedAtMs;
        return !isNaN(ageMs) && ageMs < 120000; // 2 minutes
      });
      return hasPending ? 1500 : false;
    },
  });

  const detailQuery = useQuery({
    queryKey: ['imports', 'detail', selectedImportId],
    queryFn: () => importsService.getImportDetail(selectedImportId as string),
    enabled: Boolean(selectedImportId),
    refetchInterval: (query) => {
      const status = query.state.data?.import_batch?.status;
      if (status === 'uploaded' || status === 'committing') {
        return 1500;
      }
      return false;
    },
  });

  const activeDetail = useMemo(() => {
    if (detailQuery.data) return detailQuery.data;
    if (latestValidation && latestValidation.import_batch.public_id === selectedImportId) return latestValidation;
    return null;
  }, [detailQuery.data, latestValidation, selectedImportId]);

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!module) {
        throw new Error('Module is required');
      }
      const needsTargetAccount = module === 'spending-transactions' || isPdfModule(module);
      return importsService.uploadAndValidate(
        module,
        file as File,
        needsTargetAccount ? targetAccountId || undefined : undefined,
        module === 'investing-demat-cas' ? filePassword || undefined : undefined
      );
    },
    onSuccess: (data) => {
      setLatestValidation(data);
      setSelectedImportId(data.import_batch.public_id);
      setFile(null);
      setTargetAccountId('');
      setFilePassword('');
      setUploadError(null);
      setIsUploadModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['imports', 'list'] });
    },
  });

  const handleUpload = () => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size exceeds the maximum limit of 10MB.');
      return;
    }
    const fileExt = file.name.toLowerCase();
    if (isPdfModule(module)) {
      if (!fileExt.endsWith('.pdf')) {
        setUploadError('Invalid file format. Please upload a PDF file.');
        return;
      }
      if (!targetAccountId) {
        setUploadError('Select a target brokerage account.');
        return;
      }
    } else if (!fileExt.endsWith('.csv') && !fileExt.endsWith('.xlsx')) {
      setUploadError('Invalid file format. Please upload a CSV or XLSX file.');
      return;
    }
    setUploadError(null);
    uploadMutation.mutate();
  };


  const commitMutation = useMutation({
    mutationFn: (importPublicId: string) => importsService.commitImport(importPublicId),
    onSuccess: async (_, importPublicId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['imports', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['imports', 'detail', importPublicId] }),
      ]);
      showToast('Import applied', 'success');
    },
    onError: () => showToast('Apply failed. Refresh import details and retry.', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (importPublicId: string) => importsService.deleteImport(importPublicId),
    onSuccess: async (_, importPublicId) => {
      if (selectedImportId === importPublicId) {
        setSelectedImportId(null);
        setLatestValidation(null);
      }
      setIsDeleteConfirmOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['imports', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['imports', 'detail', importPublicId] }),
      ]);
      showToast('Import removed', 'success');
    },
  });

  const handleTemplateDownload = async () => {
    if (!module || isDownloadingTemplate) {
      return;
    }
    try {
      setIsDownloadingTemplate(true);
      const content = await importsService.downloadTemplate(module);
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${module}-template.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const errors: ImportErrorItem[] = activeDetail?.errors ?? [];

  return (
    <PageShell>
      <PageHero
        title="Bulk Imports"
        subtitle="Upload CSV templates for transactions, budgets, holdings, and constituents."
        actions={(
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-cyan-600 px-5 text-sm font-semibold text-white hover:bg-cyan-500"
          >
            <Plus className="h-4 w-4" />
            New Import
          </button>
        )}
      />

      <Dialog open={isUploadModalOpen} onOpenChange={(open) => !open && setIsUploadModalOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4 mb-4 border-b border-slate-800">
            <DialogTitle>New Import</DialogTitle>
          </DialogHeader>
          {isUploadModalOpen && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-300">Select module</label>
                <select
                  data-testid="imports-module-select"
                  value={module}
                  onChange={(e) => {
                    setModule(e.target.value as ImportModule);
                    setTargetAccountId('');
                    setFilePassword('');
                    setFile(null);
                    setUploadError(null);
                  }}
                  className="w-full h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-white text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="" disabled>
                    Select module
                  </option>
                  {MODULE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} data-testid={opt.testId}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {module === 'spending-transactions' && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-300">
                    Target account (Optional)
                  </label>
                  <DropdownSelect
                    testId="imports-target-account"
                    value={targetAccountId}
                    onChange={setTargetAccountId}
                    options={targetAccountOptions}
                    placeholder="No target account"
                    clearLabel="No target account"
                    showSearch
                    sortByLabel
                  />
                  <p className="text-xs text-slate-500">
                    Used for rows with no (matching) account name, before falling back to the
                    workspace default spending account.
                  </p>
                </div>
              )}

              {isPdfModule(module) && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-300">
                    Target brokerage account
                  </label>
                  <DropdownSelect
                    testId="imports-target-account-brokerage"
                    value={targetAccountId}
                    onChange={setTargetAccountId}
                    options={brokerageAccountOptions}
                    placeholder="Select a brokerage account"
                    showSearch
                    sortByLabel
                  />
                  <p className="text-xs text-slate-500">
                    Every {module === 'investing-cams-cas' ? 'transaction' : 'holding'} in the
                    statement is bound to this account.
                  </p>
                </div>
              )}

              {module === 'investing-demat-cas' && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-300">
                    Statement password
                  </label>
                  <input
                    data-testid="imports-file-password"
                    type="password"
                    value={filePassword}
                    onChange={(e) => setFilePassword(e.target.value)}
                    placeholder="PAN-derived password printed on your NSDL statement"
                    className="w-full h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-white text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                  <p className="text-xs text-slate-500">
                    Used in memory only to open the PDF — never stored or logged.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-300">
                  {isPdfModule(module) ? 'Choose PDF File' : 'Choose CSV/Excel File'}
                </label>
                <input
                  data-testid="imports-file-input"
                  key={file ? `selected-${file.name}-${file.lastModified}` : 'no-file-selected'}
                  type="file"
                  accept={
                    isPdfModule(module)
                      ? '.pdf,application/pdf'
                      : '.csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                  }
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setUploadError(null);
                  }}
                  className="w-full h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="flex gap-3 pt-3">
                {!isPdfModule(module) && (
                  <button
                    data-testid="imports-download-template"
                    type="button"
                    onClick={() => void handleTemplateDownload()}
                    disabled={!module || isDownloadingTemplate}
                    className="flex-1 h-10 rounded-lg border border-slate-600 bg-slate-900 px-4 text-xs font-semibold text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDownloadingTemplate ? 'Downloading...' : 'Download template'}
                  </button>
                )}

                <button
                  data-testid="imports-upload-validate"
                  type="button"
                  onClick={handleUpload}
                  disabled={
                    !module ||
                    !file ||
                    uploadMutation.isPending ||
                    (isPdfModule(module) && !targetAccountId)
                  }
                  className="flex-1 h-10 rounded-lg bg-cyan-600 px-4 text-xs font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploadMutation.isPending ? 'Validating...' : 'Upload + validate'}
                </button>
              </div>

              {uploadError ? (
                <p className="mt-2 text-sm text-rose-300" data-testid="imports-upload-error">{uploadError}</p>
              ) : uploadMutation.isError ? (
                <p className="mt-2 text-sm text-rose-300">Import validation failed to submit. Check file and try again.</p>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Recent imports</h2>
          {isLoadingImports ? <p className="text-slate-400">Loading imports...</p> : null}
          <div className="space-y-2">
            {!isLoadingImports && (importsResponse?.items.length ?? 0) === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-6 text-center">
                <p className="text-slate-300">No import batches yet.</p>
                <p className="mt-1 text-sm text-slate-500">Choose a module and upload your first CSV.</p>
              </div>
            ) : null}
            {importsResponse?.items.map((item) => (
              <button
                data-testid={`imports-list-item-${item.public_id}`}
                key={item.public_id}
                type="button"
                onClick={() => setSelectedImportId(item.public_id)}
                className={`w-full rounded-lg border px-3 py-3 text-left ${selectedImportId === item.public_id ? 'border-cyan-500 bg-cyan-950/30' : 'border-slate-700 bg-slate-800/30 hover:bg-slate-800/60'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">{item.filename}</span>
                  <span className="text-xs text-slate-300">{importStatusLabel(item.status)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {item.module} • rows {item.valid_rows}/{item.total_rows} valid • errors {item.error_rows}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Import detail</h2>
          {!selectedImportId ? <p className="text-slate-400">Select an import to inspect validation and commit state.</p> : null}

          {selectedImportId && activeDetail ? (
            <>
              {(() => {
                const lifecycle = lifecycleCopy(activeDetail.import_batch.status);
                const canDelete = ['validated', 'failed_validation', 'completed', 'failed_commit'].includes(
                  activeDetail.import_batch.status,
                );
                return (
                  <div className="mb-4 rounded-lg border border-slate-700 bg-slate-950/40 p-3 text-sm text-slate-300">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-slate-100">Recovery</p>
                        <p className="mt-1 text-slate-400">{lifecycle.description}</p>
                      </div>
                      <button
                        data-testid="imports-delete"
                        type="button"
                        disabled={!canDelete || deleteMutation.isPending}
                        onClick={() => setIsDeleteConfirmOpen(true)}
                        className="h-10 rounded-lg border border-rose-500/50 px-4 text-sm font-semibold text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deleteMutation.isPending ? 'Deleting...' : lifecycle.action}
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800/40 p-3 text-sm text-slate-200">
                <p>Module: <span className="font-semibold">{activeDetail.import_batch.module}</span></p>
                <p>Status: <span className="font-semibold">{importStatusLabel(activeDetail.import_batch.status)}</span></p>
                <p>Rows: {activeDetail.import_batch.valid_rows}/{activeDetail.import_batch.total_rows} valid</p>
                {activeDetail.error_summary ? (
                  <p>
                    Error summary: {activeDetail.error_summary.returned_errors}/{activeDetail.error_summary.total_errors} returned
                  </p>
                ) : null}
              </div>

              {activeDetail.import_batch.status === 'failed_commit' ? (
                <div className="mb-4 rounded-lg border border-rose-700/50 bg-rose-950/40 p-3 text-sm">
                  <p className="mb-1 font-semibold text-rose-300">Apply failed</p>
                  <p className="text-rose-200">
                    {activeDetail.import_batch.commit_error || 'An unexpected error occurred while applying the import.'}
                  </p>
                </div>
              ) : null}

              {activeDetail.import_batch.module === 'investing-demat-cas' ? (
                <p className="mb-2 text-xs text-slate-500">
                  Applying writes a read-only verification record — it never creates or
                  changes a holding, order, or cash balance.
                </p>
              ) : null}

              <button
                data-testid="imports-commit"
                type="button"
                disabled={activeDetail.import_batch.status !== 'validated' || commitMutation.isPending}
                onClick={() => commitMutation.mutate(activeDetail.import_batch.public_id)}
                className="mb-4 h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {commitMutation.isPending ? 'Applying...' : 'Apply import'}
              </button>
              {commitMutation.isError ? (
                <p className="mb-4 text-sm text-rose-300">
                  Apply failed. Refresh import details and retry.
                </p>
              ) : null}

              {/* Preview Rows Section */}
              {activeDetail.import_batch.status === 'validated' && activeDetail.preview_rows && activeDetail.preview_rows.length > 0 ? (
                <div className="mb-6">
                  <h3 className="mb-2 text-sm font-semibold text-white">Preview rows (first 100)</h3>
                  <div className="max-h-72 overflow-auto rounded-lg border border-slate-800 bg-slate-900/50">
                    <table className="min-w-full text-xs text-slate-300">
                      <thead className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
                        <tr>
                          <th className="px-3 py-2 text-left">Row</th>
                          {activeDetail.import_batch.module === 'spending-transactions' && (
                            <>
                              <th className="px-3 py-2 text-left">Date</th>
                              <th className="px-3 py-2 text-left">Type</th>
                              <th className="px-3 py-2 text-left">Amount</th>
                              <th className="px-3 py-2 text-left">Category</th>
                              <th className="px-3 py-2 text-left">Description</th>
                            </>
                          )}
                          {activeDetail.import_batch.module === 'spending-budgets' && (
                            <>
                              <th className="px-3 py-2 text-left">Month</th>
                              <th className="px-3 py-2 text-left">Category</th>
                              <th className="px-3 py-2 text-left">Amount</th>
                            </>
                          )}
                          {activeDetail.import_batch.module === 'investing-constituents' && (
                            <>
                              <th className="px-3 py-2 text-left">ETF Symbol</th>
                              <th className="px-3 py-2 text-left">Company</th>
                              <th className="px-3 py-2 text-left">Ticker</th>
                              <th className="px-3 py-2 text-left">Weight</th>
                              <th className="px-3 py-2 text-left">Date</th>
                            </>
                          )}
                          {(activeDetail.import_batch.module === 'investing-orders' ||
                            activeDetail.import_batch.module === 'investing-cams-cas') && (
                            <>
                              <th className="px-3 py-2 text-left">Date</th>
                              <th className="px-3 py-2 text-left">Type</th>
                              <th className="px-3 py-2 text-left">Symbol</th>
                              <th className="px-3 py-2 text-left">Account</th>
                              <th className="px-3 py-2 text-left">Qty</th>
                              <th className="px-3 py-2 text-left">Price</th>
                              <th className="px-3 py-2 text-left">Currency</th>
                            </>
                          )}
                          {activeDetail.import_batch.module === 'investing-demat-cas' && (
                            <>
                              <th className="px-3 py-2 text-left">ISIN</th>
                              <th className="px-3 py-2 text-left">Security</th>
                              <th className="px-3 py-2 text-left">Status</th>
                              <th className="px-3 py-2 text-left">Depository Qty</th>
                              <th className="px-3 py-2 text-left">Lifestack Qty</th>
                            </>
                          )}
                          {activeDetail.import_batch.module === 'finance-transfers' && (
                            <>
                              <th className="px-3 py-2 text-left">Date</th>
                              <th className="px-3 py-2 text-left">From Account</th>
                              <th className="px-3 py-2 text-left">To Account</th>
                              <th className="px-3 py-2 text-left">Gross Amount</th>
                              <th className="px-3 py-2 text-left">Net Received</th>
                              <th className="px-3 py-2 text-left">Currency</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {activeDetail.preview_rows.map((row) => (
                          <tr key={row.row_number} className="border-b border-slate-800 hover:bg-slate-800/40">
                            <td className="px-3 py-2 font-medium text-slate-400">{row.row_number}</td>
                            {activeDetail.import_batch.module === 'spending-transactions' && (
                              <>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {formatDate(row.payload_json.occurred_at)}
                                </td>
                                <td className="px-3 py-2 uppercase whitespace-nowrap">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${row.payload_json.type === 'income' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'}`}>
                                    {row.payload_json.type}
                                  </span>
                                </td>
                                <td className="px-3 py-2">{row.payload_json.amount}</td>
                                <td className="px-3 py-2">{row.payload_json.category_name ?? '-'}</td>
                                <td className="px-3 py-2 truncate max-w-xs">{row.payload_json.description ?? '-'}</td>
                              </>
                            )}
                            {activeDetail.import_batch.module === 'spending-budgets' && (
                              <>
                                <td className="px-3 py-2">{row.payload_json.month_start}</td>
                                <td className="px-3 py-2">{row.payload_json.category_name ?? '-'}</td>
                                <td className="px-3 py-2">{row.payload_json.amount}</td>
                              </>
                            )}
                            {activeDetail.import_batch.module === 'investing-constituents' && (
                              <>
                                <td className="px-3 py-2 font-semibold text-white">{row.payload_json.instrument_symbol}</td>
                                <td className="px-3 py-2">{row.payload_json.company_name}</td>
                                <td className="px-3 py-2">{row.payload_json.company_ticker ?? '-'}</td>
                                <td className="px-3 py-2">{row.payload_json.weight && !isNaN(parseFloat(row.payload_json.weight)) ? (parseFloat(row.payload_json.weight) * 100).toFixed(2) + '%' : '-'}</td>
                                <td className="px-3 py-2">{row.payload_json.as_of_date}</td>
                              </>
                            )}
                            {(activeDetail.import_batch.module === 'investing-orders' ||
                              activeDetail.import_batch.module === 'investing-cams-cas') && (
                              <>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {formatDate(row.payload_json.occurred_at)}
                                </td>
                                <td className="px-3 py-2 uppercase whitespace-nowrap">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${row.payload_json.order_type === 'buy' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'}`}>
                                    {row.payload_json.order_type}
                                  </span>
                                </td>
                                <td className="px-3 py-2 font-semibold text-white">{row.payload_json.symbol}</td>
                                <td className="px-3 py-2">{row.payload_json.account_name ?? '-'}</td>
                                <td className="px-3 py-2">{row.payload_json.quantity}</td>
                                <td className="px-3 py-2">{row.payload_json.price_per_unit}</td>
                                <td className="px-3 py-2 uppercase">{row.payload_json.currency}</td>
                              </>
                            )}
                            {activeDetail.import_batch.module === 'investing-demat-cas' && (
                              <>
                                <td className="px-3 py-2 font-semibold text-white">{row.payload_json.isin}</td>
                                <td className="px-3 py-2">{row.payload_json.security_name ?? '-'}</td>
                                <td className="px-3 py-2 uppercase whitespace-nowrap">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                                      row.payload_json.status === 'match'
                                        ? 'bg-emerald-950 text-emerald-300'
                                        : row.payload_json.status === 'quantity_drift'
                                          ? 'bg-amber-950 text-amber-300'
                                          : 'bg-rose-950 text-rose-300'
                                    }`}
                                  >
                                    {row.payload_json.status
                                      ? String(row.payload_json.status).replace(/_/g, ' ')
                                      : '-'}
                                  </span>
                                  {row.payload_json.corporate_action_suspected ? (
                                    <span className="ml-1 rounded bg-amber-950 px-1.5 py-0.5 text-[10px] text-amber-300">
                                      split?
                                    </span>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2">{row.payload_json.depository_quantity ?? '-'}</td>
                                <td className="px-3 py-2">{row.payload_json.lifestack_quantity ?? '-'}</td>
                              </>
                            )}
                            {activeDetail.import_batch.module === 'finance-transfers' && (
                              <>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {formatDate(row.payload_json.occurred_at)}
                                </td>
                                <td className="px-3 py-2">{row.payload_json.from_account ?? '-'}</td>
                                <td className="px-3 py-2">{row.payload_json.to_account ?? '-'}</td>
                                <td className="px-3 py-2">{row.payload_json.gross_amount}</td>
                                <td className="px-3 py-2">{row.payload_json.net_amount_received}</td>
                                <td className="px-3 py-2 uppercase">
                                  {row.payload_json.from_currency === row.payload_json.to_currency 
                                    ? row.payload_json.from_currency 
                                    : `${row.payload_json.from_currency} → ${row.payload_json.to_currency}`}
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {activeDetail.corporate_action_suspected && activeDetail.corporate_action_suspected.length > 0 ? (
                <div className="mb-4 rounded-lg border border-amber-800/50 bg-amber-950/20 p-3 text-sm">
                  <p className="mb-1 font-semibold text-amber-300">
                    Possible un-applied corporate action
                  </p>
                  <p className="mb-2 text-xs text-amber-200/80">
                    A price or quantity jump this large usually means a split, reverse split, or
                    bonus issue was never recorded. Record it under Investing → Corporate Actions.
                  </p>
                  <ul className="space-y-1 text-xs text-amber-100">
                    {activeDetail.corporate_action_suspected.map((entry, idx) => (
                      <li key={idx}>{formatAdvisoryEntry(entry)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {activeDetail.skipped && activeDetail.skipped.length > 0 ? (
                <details className="mb-4 rounded-lg border border-slate-700 bg-slate-800/30 p-3 text-sm">
                  <summary className="cursor-pointer font-semibold text-slate-300">
                    {activeDetail.skipped.length} row{activeDetail.skipped.length === 1 ? '' : 's'} skipped
                  </summary>
                  <ul className="mt-2 space-y-1 text-xs text-slate-400">
                    {activeDetail.skipped.map((entry, idx) => (
                      <li key={idx}>{formatAdvisoryEntry(entry)}</li>
                    ))}
                  </ul>
                </details>
              ) : null}

              {errors.length > 0 ? (
                <div className="max-h-72 overflow-auto rounded-lg border border-rose-900/60 bg-rose-950/20">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-rose-900/60 text-rose-200">
                      <tr>
                        <th className="px-3 py-2 text-left">Row</th>
                        <th className="px-3 py-2 text-left">Field</th>
                        <th className="px-3 py-2 text-left">Error</th>
                        <th className="px-3 py-2 text-left">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {errors.map((error, idx) => (
                        <tr key={`${error.row_number}-${error.field_name}-${idx}`} className="border-b border-rose-900/30 text-rose-100">
                          <td className="px-3 py-2">{error.row_number}</td>
                          <td className="px-3 py-2">{error.field_name ?? '-'}</td>
                          <td className="px-3 py-2">{error.message}</td>
                          <td className="px-3 py-2">{error.raw_value ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-emerald-300">No validation errors.</p>
              )}
            </>
          ) : null}
        </section>
      </div>

      <ConfirmDialog
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        title={activeDetail?.import_batch.status === 'completed' ? 'Roll back import?' : 'Delete import batch?'}
        description={
          activeDetail
            ? lifecycleCopy(activeDetail.import_batch.status).description
            : 'This cannot be undone.'
        }
        confirmLabel={activeDetail?.import_batch.status === 'completed' ? 'Roll back' : 'Delete'}
        pendingLabel={activeDetail?.import_batch.status === 'completed' ? 'Rolling back…' : 'Deleting…'}
        isPending={deleteMutation.isPending}
        isError={deleteMutation.isError}
        errorMessage="Delete or rollback failed. Refresh import details and retry."
        onConfirm={() => activeDetail && deleteMutation.mutate(activeDetail.import_batch.public_id)}
      />
    </PageShell>
  );
};
