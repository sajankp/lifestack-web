import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';

import { PageHero } from '../components/layout/PageHero';
import { PageShell } from '../components/layout/PageShell';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { useToast } from '../components/ui/toast';
import { exportsService } from '../services/exports';
import type { ExportFormat, ExportModule, ExportRecord } from '../types/exports';

const MODULE_OPTIONS: Array<{ value: ExportModule; label: string }> = [
  { value: 'todo', label: 'Todos' },
  { value: 'spending', label: 'Spending' },
  { value: 'investing', label: 'Investing' },
];

const statusTone: Record<string, string> = {
  ready: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  pending: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  failed: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
  expired: 'border-slate-600 bg-slate-800 text-slate-300',
};

const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return date.toLocaleString();
};

export const ExportsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [format, setFormat] = useState<ExportFormat>('json');
  const [modules, setModules] = useState<ExportModule[]>(['todo', 'spending', 'investing']);
  const [currentExport, setCurrentExport] = useState<ExportRecord | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: ['exports', 'detail', currentExport?.public_id],
    queryFn: () => exportsService.getExport(currentExport?.public_id as string),
    enabled: Boolean(currentExport?.public_id),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 2000 : false),
  });

  const activeExport = detailQuery.data ?? currentExport;
  const selectedModules = useMemo(() => new Set(modules), [modules]);

  const createMutation = useMutation({
    mutationFn: () => exportsService.createExport({ format, modules }),
    onSuccess: (record) => {
      setCurrentExport(record);
      setIsCreateModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['exports', 'detail', record.public_id] });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: (publicId: string) => exportsService.downloadExport(publicId),
    onSuccess: ({ blob, filename }) => saveBlob(blob, filename),
  });

  const deleteMutation = useMutation({
    mutationFn: (publicId: string) => exportsService.deleteExport(publicId),
    onSuccess: async (_, publicId) => {
      setCurrentExport(null);
      setIsDeleteConfirmOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['exports', 'detail', publicId] });
      showToast('Export deleted', 'success');
    },
    onError: () => {
      showToast('Delete failed. Pending exports cannot be deleted until they complete.', 'error');
    },
  });

  const toggleModule = (module: ExportModule) => {
    setModules((current) => {
      if (current.includes(module)) {
        return current.filter((item) => item !== module);
      }
      return [...current, module];
    });
  };

  return (
    <PageShell>
      <PageHero
        title="Data Exports"
        subtitle="Create a workspace export, download it when ready, and delete the artifact when you are done."
        actions={(
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-cyan-600 px-5 text-sm font-semibold text-white hover:bg-cyan-500"
          >
            <Plus className="h-4 w-4" />
            Create Export
          </button>
        )}
      />

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setIsCreateModalOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h2 className="text-lg font-semibold text-white">Create Export</h2>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                title="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-300">Format</span>
                <select
                  data-testid="exports-format-select"
                  value={format}
                  onChange={(event) => setFormat(event.target.value as ExportFormat)}
                  className="w-full h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-white text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="json">JSON</option>
                  <option value="csv">CSV zip</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-300">Modules</span>
                <div className="flex flex-wrap gap-2">
                  {MODULE_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200 select-none cursor-pointer hover:border-slate-600 transition-colors"
                    >
                      <input
                        data-testid={`exports-module-${option.value}`}
                        type="checkbox"
                        checked={selectedModules.has(option.value)}
                        onChange={() => toggleModule(option.value)}
                        className="h-4 w-4 accent-cyan-500 animate-none"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 h-10 rounded-lg border border-slate-700 bg-slate-900 px-4 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  data-testid="exports-create"
                  type="button"
                  disabled={modules.length === 0 || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                  className="flex-1 h-10 rounded-lg bg-cyan-600 px-4 text-xs font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create export'}
                </button>
              </div>

              {createMutation.isError ? (
                <p className="mt-3 text-sm text-rose-300">
                  Export creation failed. Check the selected modules and try again.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Current export</h2>

          {!activeExport ? (
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-5 text-sm text-slate-400 text-center">
              Create an export to see its status, download link, and delete control here.
            </div>
          ) : (
            <>
              <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-400">Status</span>
                  <span
                    data-testid="exports-status"
                    className={`rounded-full border px-2 py-1 text-xs font-semibold uppercase ${
                      statusTone[activeExport.status] ?? statusTone.expired
                    }`}
                  >
                    {activeExport.status}
                  </span>
                </div>
                <p>Format: <span className="font-semibold text-slate-100">{activeExport.format}</span></p>
                <p>Schema version: {activeExport.schema_version}</p>
                <p>Created: {formatDateTime(activeExport.created_at)}</p>
                {activeExport.completed_at ? (
                  <p>Completed: {formatDateTime(activeExport.completed_at)}</p>
                ) : null}
                {activeExport.artifact_filename ? <p>Artifact: {activeExport.artifact_filename}</p> : null}
                {activeExport.error_message ? (
                  <p className="text-rose-300">Error: {activeExport.error_message}</p>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 justify-end">
                <button
                  data-testid="exports-download"
                  type="button"
                  disabled={activeExport.status !== 'ready' || downloadMutation.isPending}
                  onClick={() => downloadMutation.mutate(activeExport.public_id)}
                  className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {downloadMutation.isPending ? 'Downloading...' : 'Download'}
                </button>
                <button
                  data-testid="exports-delete"
                  type="button"
                  disabled={activeExport.status === 'pending' || deleteMutation.isPending}
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  className="h-10 rounded-lg border border-rose-500/50 px-4 text-sm font-semibold text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete export'}
                </button>
              </div>

              {downloadMutation.isError ? (
                <p className="mt-3 text-sm text-rose-300 text-right">Download failed. Refresh status and try again.</p>
              ) : null}
            </>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        title="Delete export?"
        description="This deletes the export artifact permanently. You can create a new export any time."
        isPending={deleteMutation.isPending}
        isError={deleteMutation.isError}
        errorMessage="Delete failed. Pending exports cannot be deleted until they complete."
        onConfirm={() => activeExport && deleteMutation.mutate(activeExport.public_id)}
      />
    </PageShell>
  );
};
