import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { importsService } from '../services/imports';
import type { ImportErrorItem, ImportModule, ImportValidateResponse } from '../types/imports';

const MODULE_OPTIONS: Array<{ value: ImportModule; label: string }> = [
  { value: 'spending-transactions', label: 'Spending Transactions' },
  { value: 'spending-budgets', label: 'Spending Budgets' },
  { value: 'investing-holdings', label: 'Investing Holdings' },
];

export const ImportsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [module, setModule] = useState<ImportModule | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [latestValidation, setLatestValidation] = useState<ImportValidateResponse | null>(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  const { data: importsResponse, isLoading: isLoadingImports } = useQuery({
    queryKey: ['imports', 'list'],
    queryFn: () => importsService.listImports(20, 0),
  });

  const detailQuery = useQuery({
    queryKey: ['imports', 'detail', selectedImportId],
    queryFn: () => importsService.getImportDetail(selectedImportId as string),
    enabled: Boolean(selectedImportId),
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
      return importsService.uploadAndValidate(module, file as File);
    },
    onSuccess: (data) => {
      setLatestValidation(data);
      setSelectedImportId(data.import_batch.public_id);
      setFile(null);
      void queryClient.invalidateQueries({ queryKey: ['imports', 'list'] });
    },
  });

  const commitMutation = useMutation({
    mutationFn: (importPublicId: string) => importsService.commitImport(importPublicId),
    onSuccess: async (_, importPublicId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['imports', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['imports', 'detail', importPublicId] }),
      ]);
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
    <div className="w-full px-8 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-white">Bulk Imports</h1>
        <p className="mt-1 text-slate-400">Upload CSV templates for transactions, budgets, and holdings.</p>
      </header>

      <section className="mb-8 rounded-xl border border-slate-800 bg-slate-800/30 p-5">
        <h2 className="mb-4 text-lg font-semibold text-white">New import</h2>
        <div className="grid gap-3 md:grid-cols-[2fr,3fr,auto,auto]">
          <select
            value={module}
            onChange={(e) => setModule(e.target.value as ImportModule)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
          >
            <option value="" disabled>
              Select module
            </option>
            {MODULE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <input
            key={file ? `selected-${file.name}-${file.lastModified}` : 'no-file-selected'}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200"
          />

          <button
            type="button"
            onClick={() => void handleTemplateDownload()}
            disabled={!module || isDownloadingTemplate}
            className="h-10 rounded-lg border border-slate-600 bg-slate-900 px-4 text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDownloadingTemplate ? 'Downloading...' : 'Download template'}
          </button>

          <button
            type="button"
            onClick={() => file && uploadMutation.mutate()}
            disabled={!module || !file || uploadMutation.isPending}
            className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploadMutation.isPending ? 'Validating...' : 'Upload + validate'}
          </button>
        </div>
        {uploadMutation.isError ? (
          <p className="mt-3 text-sm text-rose-300">Import validation failed to submit. Check file and try again.</p>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
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
                key={item.public_id}
                type="button"
                onClick={() => setSelectedImportId(item.public_id)}
                className={`w-full rounded-lg border px-3 py-3 text-left ${selectedImportId === item.public_id ? 'border-blue-500 bg-blue-950/30' : 'border-slate-700 bg-slate-800/30 hover:bg-slate-800/60'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">{item.filename}</span>
                  <span className="text-xs uppercase text-slate-300">{item.status.replace('_', ' ')}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {item.module} • rows {item.valid_rows}/{item.total_rows} valid • errors {item.error_rows}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="mb-4 text-lg font-semibold text-white">Import detail</h2>
          {!selectedImportId ? <p className="text-slate-400">Select an import to inspect validation and commit state.</p> : null}

          {selectedImportId && activeDetail ? (
            <>
              <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800/40 p-3 text-sm text-slate-200">
                <p>Module: <span className="font-semibold">{activeDetail.import_batch.module}</span></p>
                <p>Status: <span className="font-semibold uppercase">{activeDetail.import_batch.status.replace('_', ' ')}</span></p>
                <p>Rows: {activeDetail.import_batch.valid_rows}/{activeDetail.import_batch.total_rows} valid</p>
              </div>

              <button
                type="button"
                disabled={activeDetail.import_batch.status !== 'validated' || commitMutation.isPending}
                onClick={() => commitMutation.mutate(activeDetail.import_batch.public_id)}
                className="mb-4 h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {commitMutation.isPending ? 'Committing...' : 'Commit import'}
              </button>
              {commitMutation.isError ? (
                <p className="mb-4 text-sm text-rose-300">
                  Commit failed. Refresh import details and retry.
                </p>
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
    </div>
  );
};
