import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Gauge, Plus, Trash2 } from 'lucide-react';
import { DropdownSelect, type DropdownOption } from '../../components/DropdownSelect';
import { Pagination } from '../../components/Pagination';
import { useInvalidatingMutation } from '../../hooks/useInvalidatingMutation';
import { queryKeys } from '../../lib/queryKeys';
import { formatCurrency } from '../../utils/numberFormat';
import { spendingService } from '../../services/spending';
import type { Kpi, KpiCreate, KpiMetricType, KpiWindow } from '../../types/spending';

const METRIC_OPTIONS: DropdownOption[] = [
  { value: 'spend_total', label: 'Total spend' },
  { value: 'income_total', label: 'Total income' },
  { value: 'net_cash_flow', label: 'Net cash flow (income - spend)' },
];

const WINDOW_OPTIONS: DropdownOption[] = [
  { value: 'calendar_month', label: 'This calendar month' },
  { value: 'calendar_week', label: 'This calendar week' },
  { value: 'rolling_30d', label: 'Trailing 30 days' },
];

const FILTER_MODE_OPTIONS: DropdownOption[] = [
  { value: 'none', label: 'All accounts' },
  { value: 'category', label: 'One category' },
  { value: 'category_group', label: 'One category group' },
  { value: 'account', label: 'One account' },
];

const DIRECTION_OPTIONS: DropdownOption[] = [
  { value: 'lte', label: 'At most (≤)' },
  { value: 'gte', label: 'At least (≥)' },
];

type FilterMode = 'none' | 'category' | 'category_group' | 'account';

interface KpisTabProps {
  categoryOptions: DropdownOption[];
  categoryGroupOptions: DropdownOption[];
  accountOptions: DropdownOption[];
  currencyDisplayPreference: 'symbol' | 'code';
}

const emptyForm = {
  name: '',
  metric_type: 'spend_total' as KpiMetricType,
  evaluation_window: 'calendar_month' as KpiWindow,
  filterMode: 'none' as FilterMode,
  filterValue: '',
  target_value: '',
  target_direction: 'lte' as 'lte' | 'gte',
  hasTarget: false,
};

const KpisTabImpl: React.FC<KpisTabProps> = ({
  categoryOptions,
  categoryGroupOptions,
  accountOptions,
  currencyDisplayPreference,
}) => {
  const [offset, setOffset] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const limit = 20;

  const { data: kpisResponse, isLoading } = useQuery({
    queryKey: queryKeys.spending.kpis(limit, offset),
    queryFn: () => spendingService.getKpis(limit, offset),
  });
  const kpis = kpisResponse?.items ?? [];

  const filterOptionsByMode: Record<Exclude<FilterMode, 'none'>, DropdownOption[]> = useMemo(
    () => ({
      category: categoryOptions,
      category_group: categoryGroupOptions,
      account: accountOptions,
    }),
    [categoryOptions, categoryGroupOptions, accountOptions]
  );

  const createMutation = useInvalidatingMutation(
    (data: KpiCreate) => spendingService.createKpi(data),
    [queryKeys.spending.kpis()],
    {
      successMessage: 'KPI created',
      onSuccess: () => {
        setShowForm(false);
        setForm(emptyForm);
        setFormError(null);
      },
      onError: (error) => setFormError(error instanceof Error ? error.message : 'Failed to create KPI'),
    }
  );

  const deleteMutation = useInvalidatingMutation(
    (publicId: string) => spendingService.deleteKpi(publicId),
    [queryKeys.spending.kpis()],
    {
      successMessage: 'KPI deleted',
      onSuccess: () => {
        setPendingDeleteId(null);
        // Deleting the last item on a page must not strand the user on a
        // now-empty page once the list refetches.
        if (offset > 0 && kpis.length === 1) {
          setOffset(0);
        }
      },
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('Name is required');
      return;
    }
    if (form.hasTarget) {
      if (!form.target_value.trim()) {
        setFormError('Target value is required when a target is set');
        return;
      }
      const parsedTarget = parseFloat(form.target_value);
      if (Number.isNaN(parsedTarget) || parsedTarget < 0) {
        setFormError('Target value must be a valid non-negative number');
        return;
      }
    }
    if (form.filterMode !== 'none' && !form.filterValue) {
      setFormError('Select a value for the chosen filter');
      return;
    }

    const payload: KpiCreate = {
      name: form.name.trim(),
      metric_type: form.metric_type,
      evaluation_window: form.evaluation_window,
      category_id: form.filterMode === 'category' ? form.filterValue || undefined : undefined,
      category_group_id: form.filterMode === 'category_group' ? form.filterValue || undefined : undefined,
      account_id: form.filterMode === 'account' ? form.filterValue || undefined : undefined,
      target_value: form.hasTarget ? parseFloat(form.target_value) : undefined,
      target_direction: form.hasTarget ? form.target_direction : undefined,
    };
    createMutation.mutate(payload);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-white">Custom KPIs</h3>
        <button
          data-testid="kpi-add-button"
          onClick={() => {
            setForm(emptyForm);
            setFormError(null);
            setShowForm((v) => !v);
          }}
          className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-cyan-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New KPI
        </button>
      </div>

      {showForm ? (
        <form
          data-testid="kpi-form"
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5"
        >
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase tracking-wide">Name</label>
            <input
              data-testid="kpi-name-input"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-white"
              placeholder="e.g. Dining under budget"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase tracking-wide">Metric</label>
              <DropdownSelect
                testId="kpi-metric-type"
                value={form.metric_type}
                onChange={(v) => setForm((f) => ({ ...f, metric_type: v as KpiMetricType }))}
                options={METRIC_OPTIONS}
                placeholder="Select metric"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase tracking-wide">Window</label>
              <DropdownSelect
                testId="kpi-window"
                value={form.evaluation_window}
                onChange={(v) => setForm((f) => ({ ...f, evaluation_window: v as KpiWindow }))}
                options={WINDOW_OPTIONS}
                placeholder="Select window"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase tracking-wide">Filter</label>
              <DropdownSelect
                testId="kpi-filter-mode"
                value={form.filterMode}
                onChange={(v) => setForm((f) => ({ ...f, filterMode: v as FilterMode, filterValue: '' }))}
                options={FILTER_MODE_OPTIONS}
                placeholder="Select filter"
              />
            </div>
            {form.filterMode !== 'none' ? (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase tracking-wide">Value</label>
                <DropdownSelect
                  testId="kpi-filter-value"
                  value={form.filterValue}
                  onChange={(v) => setForm((f) => ({ ...f, filterValue: v }))}
                  options={filterOptionsByMode[form.filterMode]}
                  placeholder="Select..."
                  showSearch
                />
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <input
              id="kpi-has-target"
              type="checkbox"
              checked={form.hasTarget}
              onChange={(e) => setForm((f) => ({ ...f, hasTarget: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-600 bg-slate-900"
            />
            <label htmlFor="kpi-has-target" className="text-sm text-slate-300">
              Set a target and get notified on breach
            </label>
          </div>

          {form.hasTarget ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase tracking-wide">Target value</label>
                <input
                  data-testid="kpi-target-value"
                  type="number"
                  step="0.01"
                  value={form.target_value}
                  onChange={(e) => setForm((f) => ({ ...f, target_value: e.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-white"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400 uppercase tracking-wide">Direction</label>
                <DropdownSelect
                  testId="kpi-target-direction"
                  value={form.target_direction}
                  onChange={(v) => setForm((f) => ({ ...f, target_direction: v as 'lte' | 'gte' }))}
                  options={DIRECTION_OPTIONS}
                  placeholder="Select direction"
                />
              </div>
            </div>
          ) : null}

          {formError ? <p className="text-sm text-red-400">{formError}</p> : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              data-testid="kpi-save-button"
              className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-cyan-500 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Saving...' : 'Save KPI'}
            </button>
          </div>
        </form>
      ) : null}

      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-cyan-500" />
        </div>
      ) : kpis.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-800/30 p-12 text-center">
          <div className="mb-4 rounded-full bg-slate-800 p-4">
            <Gauge className="h-8 w-8 text-slate-500" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-white">No custom KPIs yet</h3>
          <p className="text-slate-400">Track a recurring financial question beyond budgets.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {kpis.map((kpi: Kpi) => {
            const current = parseFloat(kpi.current_value.toString());
            const target = kpi.target_value != null ? parseFloat(kpi.target_value.toString()) : null;
            const progress = target ? Math.min(100, Math.max(0, (current / target) * 100)) : null;

            return (
              <div
                key={kpi.public_id}
                data-testid={`kpi-card-${kpi.public_id}`}
                className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5 transition-all hover:border-slate-600"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{kpi.name}</span>
                  <div className="flex items-center gap-2">
                    {kpi.is_breached ? (
                      <span
                        data-testid={`kpi-breach-badge-${kpi.public_id}`}
                        className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        Breached
                      </span>
                    ) : null}
                    <button
                      onClick={() => setPendingDeleteId(kpi.public_id)}
                      className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-700 hover:text-red-400"
                      title="Delete KPI"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mb-1 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-slate-400">
                      {METRIC_OPTIONS.find((m) => m.value === kpi.metric_type)?.label ?? kpi.metric_type}
                    </p>
                    <p className="text-lg font-bold text-white">
                      {formatCurrency(current, kpi.currency_code, currencyDisplayPreference)}
                    </p>
                  </div>
                  {target != null ? (
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Target</p>
                      <p className="font-semibold text-slate-300">
                        {kpi.target_direction === 'lte' ? '≤' : '≥'}{' '}
                        {formatCurrency(target, kpi.currency_code, currencyDisplayPreference)}
                      </p>
                    </div>
                  ) : null}
                </div>

                {progress != null ? (
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-900/50">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        kpi.is_breached ? 'bg-red-500' : progress > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                ) : null}
                <p className="mt-2 text-xs text-slate-500">
                  {WINDOW_OPTIONS.find((w) => w.value === kpi.evaluation_window)?.label ?? kpi.evaluation_window}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {kpisResponse && kpisResponse.total > 0 ? (
        <Pagination
          total={kpisResponse.total}
          limit={kpisResponse.limit}
          offset={kpisResponse.offset}
          onPageChange={setOffset}
        />
      ) : null}

      {pendingDeleteId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <p className="mb-4 text-sm text-slate-200">Delete this KPI? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPendingDeleteId(null)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(pendingDeleteId)}
                disabled={deleteMutation.isPending}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

// Memoized presentational tab — see TransactionsTab for rationale.
export const KpisTab = React.memo(KpisTabImpl);
