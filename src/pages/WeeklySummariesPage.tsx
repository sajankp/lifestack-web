import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, Pencil, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { summariesService } from '../services/summaries';
import { queryKeys } from '../lib/queryKeys';
import { PageHero } from '../components/layout/PageHero';
import { PageShell } from '../components/layout/PageShell';
import { Pagination } from '../components/Pagination';
import { Button } from '../components/ui/button';
import { useToast } from '../components/ui/toast';
import { SkeletonList, EmptyState, ErrorBanner } from '../components/ui/FeedbackStates';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { formatCurrency, toNumber } from '../utils/numberFormat';
import { formatDate, formatDateTime, formatMonthYear } from '../utils/dateFormat';
import { useDisplayProfile, type DisplayProfile } from '../hooks/useDisplayProfile';
import type { MonthlySummary, WeeklySummary } from '../services/summaries';

type SummaryItem = WeeklySummary | MonthlySummary;
interface PaginatedSummaries {
  items: SummaryItem[];
  total: number;
  limit: number;
  offset: number;
}

const getWeekRange = (dateStr: string) => {
  if (!dateStr) return { start: '', end: '' };
  const parts = dateStr.split('-');
  if (parts.length !== 3) return { start: dateStr, end: dateStr };
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  const d = new Date(Date.UTC(year, month, day));
  if (isNaN(d.getTime())) return { start: dateStr, end: dateStr };
  const dayOfWeek = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diffToMon);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
};

export const WeeklySummariesPage: React.FC = () => {
  const [cadence, setCadence] = useState<'weekly' | 'monthly'>('weekly');
  const [offset, setOffset] = useState(0);
  const limit = 12;
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const markedRef = useRef<string | null>(null);
  const [regenerateReasons, setRegenerateReasons] = useState<Record<string, string>>({});

  // Generate Month modal state
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const now = new Date();
  const [genYear, setGenYear] = useState(now.getUTCFullYear());
  const [genMonth, setGenMonth] = useState(now.getUTCMonth() + 1);

  // Generate Week modal state
  const [isGenerateWeeklyModalOpen, setIsGenerateWeeklyModalOpen] = useState(false);
  const [genWeekDate, setGenWeekDate] = useState(() => new Date().toISOString().slice(0, 10));
  const weekRange = useMemo(() => getWeekRange(genWeekDate), [genWeekDate]);

  // Edit Monthly modal state
  const [isEditMonthlyModalOpen, setIsEditMonthlyModalOpen] = useState(false);
  const [editingMonthlySummary, setEditingMonthlySummary] = useState<MonthlySummary | null>(null);
  const [editMonthlyForm, setEditMonthlyForm] = useState({
    total_income: '',
    total_expense: '',
    net_spending: '',
    portfolio_value_end: '',
    cash_end: '',
    total_dividends: '',
    net_worth_end: '',
    tasks_created: '',
    tasks_completed: '',
    reason: '',
  });

  const handleOpenEditMonthly = (item: MonthlySummary) => {
    setEditingMonthlySummary(item);
    setEditMonthlyForm({
      total_income:
        item.spending_summary?.total_income != null ? String(item.spending_summary.total_income) : '',
      total_expense:
        item.spending_summary?.total_expense != null ? String(item.spending_summary.total_expense) : '',
      net_spending:
        item.spending_summary?.net != null ? String(item.spending_summary.net) : '',
      portfolio_value_end:
        item.investing_summary?.portfolio_value_end != null
          ? String(item.investing_summary.portfolio_value_end)
          : '',
      cash_end:
        item.investing_summary?.cash_end != null ? String(item.investing_summary.cash_end) : '',
      total_dividends:
        item.dividend_summary?.total_net != null
          ? String(item.dividend_summary.total_net)
          : '',
      net_worth_end:
        item.net_worth_summary?.net_worth_end != null
          ? String(item.net_worth_summary.net_worth_end)
          : '',
      tasks_created:
        item.todo_summary?.tasks_created != null ? String(item.todo_summary.tasks_created) : '',
      tasks_completed:
        item.todo_summary?.tasks_completed != null ? String(item.todo_summary.tasks_completed) : '',
      reason: '',
    });
    setIsEditMonthlyModalOpen(true);
  };

  const { data, isLoading, isError, refetch } = useQuery<PaginatedSummaries>({
    queryKey: ['summaries', cadence, offset],
    queryFn: () =>
      cadence === 'weekly'
        ? summariesService.listWeekly(limit, offset)
        : summariesService.listMonthly(limit, offset),
  });

  const regenerateMutation = useMutation<
    SummaryItem,
    Error,
    { summaryId: string; reason: string }
  >({
    mutationFn: (payload: { summaryId: string; reason: string }) =>
      cadence === 'weekly'
        ? summariesService.regenerate(payload.summaryId, payload.reason || undefined)
        : summariesService.regenerateMonthly(payload.summaryId, payload.reason || undefined),
    onSuccess: (_data, variables) => {
      setRegenerateReasons((prev) => {
        const next = { ...prev };
        delete next[variables.summaryId];
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ['summaries', cadence] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.briefing() });
      showToast('Summary regenerated successfully.', 'success');
    },
    onError: () => showToast('Failed to regenerate summary. Please try again.', 'error'),
  });

  const generateMonthlyMutation = useMutation({
    mutationFn: () => summariesService.generateMonthly(genYear, genMonth),
    onSuccess: () => {
      setIsGenerateModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['summaries', 'monthly'] });
      showToast(`Monthly summary for ${genYear}-${String(genMonth).padStart(2, '0')} generated.`, 'success');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast(msg || 'Failed to generate monthly summary.', 'error');
    },
  });

  const generateWeeklyMutation = useMutation({
    mutationFn: () => summariesService.generateWeekly(genWeekDate),
    onSuccess: () => {
      setIsGenerateWeeklyModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['summaries', 'weekly'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.briefing() });
      showToast('Weekly summary generated successfully.', 'success');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast(msg || 'Failed to generate weekly summary.', 'error');
    },
  });

  const updateMonthlyMutation = useMutation({
    mutationFn: (payload: { summaryId: string; data: Record<string, unknown> }) =>
      summariesService.updateMonthly(payload.summaryId, payload.data),
    onSuccess: () => {
      setIsEditMonthlyModalOpen(false);
      setEditingMonthlySummary(null);
      void queryClient.invalidateQueries({ queryKey: ['summaries', 'monthly'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.briefing() });
      showToast('Monthly summary updated successfully.', 'success');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showToast(msg || 'Failed to update monthly summary.', 'error');
    },
  });

  const handleSaveEditMonthly = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMonthlySummary) return;

    const dataPayload: Record<string, unknown> = {};
    if (editMonthlyForm.reason.trim()) {
      dataPayload.reason = editMonthlyForm.reason.trim();
    }

    if (
      editMonthlyForm.total_income !== '' ||
      editMonthlyForm.total_expense !== '' ||
      editMonthlyForm.net_spending !== ''
    ) {
      const baseSpending = editingMonthlySummary.spending_summary || {};
      dataPayload.spending_summary = {
        ...baseSpending,
        status: 'complete',
        ...(editMonthlyForm.total_income !== '' ? { total_income: editMonthlyForm.total_income } : {}),
        ...(editMonthlyForm.total_expense !== '' ? { total_expense: editMonthlyForm.total_expense } : {}),
        ...(editMonthlyForm.net_spending !== '' ? { net: editMonthlyForm.net_spending } : {}),
      };
    }

    if (
      editMonthlyForm.portfolio_value_end !== '' ||
      editMonthlyForm.cash_end !== ''
    ) {
      const baseInvesting = editingMonthlySummary.investing_summary || {};
      dataPayload.investing_summary = {
        ...baseInvesting,
        status: 'complete',
        ...(editMonthlyForm.portfolio_value_end !== ''
          ? { portfolio_value_end: editMonthlyForm.portfolio_value_end }
          : {}),
        ...(editMonthlyForm.cash_end !== '' ? { cash_end: editMonthlyForm.cash_end } : {}),
      };
    }

    if (editMonthlyForm.total_dividends !== '') {
      const baseDividend = editingMonthlySummary.dividend_summary || {};
      dataPayload.dividend_summary = {
        ...baseDividend,
        status: 'complete',
        total_dividends: editMonthlyForm.total_dividends,
      };
    }

    if (editMonthlyForm.net_worth_end !== '') {
      const baseNetWorth = editingMonthlySummary.net_worth_summary || {};
      dataPayload.net_worth_summary = {
        ...baseNetWorth,
        status: 'complete',
        net_worth_end: editMonthlyForm.net_worth_end,
      };
    }

    if (editMonthlyForm.tasks_created !== '' || editMonthlyForm.tasks_completed !== '') {
      const baseTodo = editingMonthlySummary.todo_summary || {};
      dataPayload.todo_summary = {
        ...baseTodo,
        ...(editMonthlyForm.tasks_created !== ''
          ? { tasks_created: Number(editMonthlyForm.tasks_created) }
          : {}),
        ...(editMonthlyForm.tasks_completed !== ''
          ? { tasks_completed: Number(editMonthlyForm.tasks_completed) }
          : {}),
      };
    }

    updateMonthlyMutation.mutate({
      summaryId: editingMonthlySummary.public_id,
      data: dataPayload,
    });
  };

  const latest = offset === 0 ? data?.items?.[0] : undefined;
  const latestId = latest?.public_id;
  const latestReadAt = latest?.read_at;
  useEffect(() => {
    if (!latestId || latestReadAt || markedRef.current === latestId) return;
    markedRef.current = latestId;
    const markReadFn =
      cadence === 'weekly' ? summariesService.markRead : summariesService.markMonthlyRead;
    void markReadFn(latestId)
      .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.briefing() }))
      .catch(() => {
        markedRef.current = null;
      });
  }, [latestId, latestReadAt, cadence, queryClient]);

  return (
    <PageShell>
      <PageHero
        title={cadence === 'weekly' ? 'Weekly Summaries' : 'Monthly Summaries'}
        subtitle={
          cadence === 'weekly'
            ? 'A readable weekly view of productivity, spending, and portfolio movement.'
            : 'A comprehensive monthly close of productivity, spending, dividends, and portfolio performance.'
        }
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900/60 p-1">
          <button
            type="button"
            data-testid="cadence-weekly-btn"
            onClick={() => {
              setCadence('weekly');
              setOffset(0);
            }}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              cadence === 'weekly'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Weekly Summaries
          </button>
          <button
            type="button"
            data-testid="cadence-monthly-btn"
            onClick={() => {
              setCadence('monthly');
              setOffset(0);
            }}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              cadence === 'monthly'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Monthly Summaries
          </button>
        </div>

        <div className="flex items-center gap-2">
          {cadence === 'weekly' && (
            <Button
              type="button"
              size="sm"
              data-testid="generate-week-close-btn"
              onClick={() => setIsGenerateWeeklyModalOpen(true)}
              className="bg-cyan-600 hover:bg-cyan-500 text-white"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Generate Week Close
            </Button>
          )}

          {cadence === 'monthly' && (
            <Button
              type="button"
              size="sm"
              data-testid="generate-month-close-btn"
              onClick={() => setIsGenerateModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Generate Month Close
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <SkeletonList rows={4} />
      ) : isError ? (
        <ErrorBanner
          message={`Failed to load ${cadence} summaries. Please try again.`}
          onRetry={() => void refetch()}
        />
      ) : data?.items?.length ? (
        <>
          <div className="space-y-4">
            {data.items.map((item) => {
              const headingText =
                'week_start' in item && item.week_start
                  ? `Week of ${formatDate(`${item.week_start}T00:00:00Z`, { fallback: 'N/A' })}`
                  : 'month_start' in item && item.month_start
                    ? `Month of ${formatMonthYear(`${item.month_start}T00:00:00Z`, { long: true, fallback: 'N/A' })}`
                    : 'Summary';


              return (
                <article
                  key={item.public_id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-black/10"
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-semibold text-white">{headingText}</h2>
                      <p className="mt-1 text-xs text-slate-500">

                      {item.regenerated_at ? (
                        <>
                          Regenerated {formatDateTime(item.regenerated_at, { fallback: 'N/A' })}
                          {item.regeneration_reason && ` — ${item.regeneration_reason}`}
                        </>
                      ) : (
                        <>Generated {formatDateTime(item.generated_at, { fallback: 'N/A' })}</>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      {cadence === 'monthly' && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          data-testid={`edit-summary-${item.public_id}`}
                          onClick={() => handleOpenEditMonthly(item as MonthlySummary)}
                          className="hover:border-cyan-600"
                        >
                          <Pencil className="mr-1.5 h-3.5 w-3.5 text-cyan-400" />
                          Edit Close
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        data-testid={`regenerate-summary-${item.public_id}`}
                        onClick={() =>
                          regenerateMutation.mutate({
                            summaryId: item.public_id,
                            reason: regenerateReasons[item.public_id] ?? '',
                          })
                        }
                        disabled={
                          regenerateMutation.isPending &&
                          regenerateMutation.variables?.summaryId === item.public_id
                        }
                      >
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                        {regenerateMutation.isPending &&
                        regenerateMutation.variables?.summaryId === item.public_id
                          ? 'Regenerating...'
                          : 'Regenerate'}
                      </Button>
                    </div>
                    {/* #200: the Reason field was unlabelled — nothing said where
                        the note goes. Spell out that it is saved to this summary's
                        history and surfaces in the card header after regenerating. */}
                    <div className="flex flex-col items-end gap-1">
                      <input
                        type="text"
                        placeholder="Reason (optional)"
                        aria-label="Reason for regenerating (optional)"
                        value={regenerateReasons[item.public_id] ?? ''}
                        onChange={(e) =>
                          setRegenerateReasons((prev) => ({
                            ...prev,
                            [item.public_id]: e.target.value,
                          }))
                        }
                        disabled={
                          regenerateMutation.isPending &&
                          regenerateMutation.variables?.summaryId === item.public_id
                        }
                        className="w-48 rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:border-cyan-600 focus:outline-none disabled:opacity-50"
                      />
                      <p className="w-48 text-right text-[11px] leading-tight text-slate-500">
                        Saved to this summary&apos;s history and shown in the header after
                        regenerating.
                      </p>
                    </div>
                  </div>
                </div>
                {item.data_revised_after_snapshot && (
                  <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-800/60 bg-amber-950/20 p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    <p className="text-sm text-amber-200">
                      The Net Worth and Investing figures below may reflect an import that was
                      later reverted. The underlying valuation snapshot can't be recomputed after
                      the fact, so these figures are preserved as originally recorded — treat the
                      movement numbers with that in mind.
                    </p>
                  </div>
                )}
                {item.data_stale && (
                  <div
                    data-testid="summary-stale-indicator"
                    className="mb-3 flex items-start gap-2 rounded-xl border border-amber-800/60 bg-amber-950/20 p-3"
                  >
                    <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    <p className="text-sm text-amber-200">
                      Data changed since this summary was generated — regenerate for the latest
                      figures.
                    </p>
                  </div>
                )}
                <div className="grid gap-3 lg:grid-cols-3">
                  <TodoCard summary={item.todo_summary} />
                  <SpendingCard summary={item.spending_summary} />
                  <InvestingCard summary={item.investing_summary} />
                  {item.health_summary && <HealthCard summary={item.health_summary} />}
                  <DividendCard summary={item.dividend_summary} />
                  <NetWorthCard summary={item.net_worth_summary} />
                  <ReturnMetricsCard summary={item.return_metrics_summary} />
                </div>
                {(item.highlights?.flags?.length ?? 0) > 0 && (
                  <div className="mt-3 rounded-xl border border-cyan-800/60 bg-cyan-950/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                      Highlights
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-200">
                      {item.highlights?.flags?.map((flag, index) => (
                        <li key={`${flag.type}-${index}`}>{flag.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {((item.behavioral_correlations?.length ?? 0) > 0 ||
                  (item.highlights?.behavioral_correlations?.length ?? 0) > 0) && (
                  <div className="mt-3 rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-4" data-testid="behavioral-correlations-section">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
                      <Sparkles className="h-3.5 w-3.5" />
                      Behavioral Correlations & Cross-Module Synergies
                    </div>
                    <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                      {(item.behavioral_correlations?.length
                        ? item.behavioral_correlations
                        : item.highlights?.behavioral_correlations ?? []
                      ).map((corr, idx) => (
                        <div
                          key={`${corr.type}-${idx}`}
                          className="rounded-lg border border-emerald-700/30 bg-slate-900/50 p-3"
                        >
                          {corr.title && (
                            <p className="text-xs font-semibold text-emerald-400 mb-1">
                              {corr.title}
                            </p>
                          )}
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {corr.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

          <div className="mt-5">
            <Pagination
              total={data.total}
              limit={data.limit}
              offset={data.offset}
              onPageChange={setOffset}
            />
          </div>
        </>
      ) : (
        <EmptyState
          icon={<CalendarDays className="h-6 w-6" />}
          title={cadence === 'weekly' ? 'No weekly summaries yet' : 'No monthly summaries yet'}
          description={
            cadence === 'weekly'
              ? 'Weekly summaries are automatically generated by backend jobs after activity is recorded for a full week.'
              : 'Monthly closes summarize your full calendar month of spending, saving, dividends, and portfolio performance. You can generate one on demand.'
          }
          action={
            cadence === 'monthly' ? (
              <Button
                type="button"
                onClick={() => setIsGenerateModalOpen(true)}
                className="mt-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Generate Month Close
              </Button>
            ) : (
              <Button
                type="button"
                data-testid="empty-generate-week-close-btn"
                onClick={() => setIsGenerateWeeklyModalOpen(true)}
                className="mt-3 bg-cyan-600 hover:bg-cyan-500 text-white text-xs"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Generate Week Close
              </Button>
            )
          }
        />
      )}

      {/* Generate Month Close Modal */}
      <Dialog
        open={isGenerateModalOpen}
        onOpenChange={(open) => !open && setIsGenerateModalOpen(false)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader className="pb-3 mb-3 border-b border-slate-800">
            <DialogTitle>Generate Monthly Summary</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              generateMonthlyMutation.mutate();
            }}
            className="space-y-4"
          >
            <p className="text-xs text-slate-400">
              Calculate and freeze the monthly financial close for productivity, spending, dividends, and portfolio performance.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Year</label>
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  value={genYear}
                  onChange={(e) => setGenYear(Number(e.target.value))}
                  className="w-full h-9 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Month</label>
                <select
                  value={genMonth}
                  onChange={(e) => setGenMonth(Number(e.target.value))}
                  className="w-full h-9 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-cyan-500 focus:outline-none"
                >
                  {[
                    '01 - January',
                    '02 - February',
                    '03 - March',
                    '04 - April',
                    '05 - May',
                    '06 - June',
                    '07 - July',
                    '08 - August',
                    '09 - September',
                    '10 - October',
                    '11 - November',
                    '12 - December',
                  ].map((label, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsGenerateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
                disabled={generateMonthlyMutation.isPending}
              >
                {generateMonthlyMutation.isPending ? 'Generating...' : 'Generate Close'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Generate Week Close Modal */}
      <Dialog
        open={isGenerateWeeklyModalOpen}
        onOpenChange={(open) => !open && setIsGenerateWeeklyModalOpen(false)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader className="pb-3 mb-3 border-b border-slate-800">
            <DialogTitle>Generate Weekly Summary</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              generateWeeklyMutation.mutate();
            }}
            className="space-y-4"
          >
            <p className="text-xs text-slate-400">
              Calculate and generate the weekly summary on demand. Select any date within the target week — the system will automatically snap to the Monday–Sunday week boundary.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Date in Week
              </label>
              <input
                type="date"
                data-testid="generate-weekly-date-input"
                value={genWeekDate}
                onChange={(e) => setGenWeekDate(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-cyan-500 focus:outline-none"
              />
              {weekRange.start && (
                <p className="mt-1.5 text-xs text-cyan-400 font-mono">
                  Week range: {weekRange.start} (Mon) → {weekRange.end} (Sun)
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsGenerateWeeklyModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                data-testid="submit-generate-weekly-btn"
                className="bg-cyan-600 hover:bg-cyan-500 text-white"
                disabled={generateWeeklyMutation.isPending || !genWeekDate}
              >
                {generateWeeklyMutation.isPending ? 'Generating...' : 'Generate Week Close'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Monthly Summary Modal */}
      <Dialog
        open={isEditMonthlyModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsEditMonthlyModalOpen(false);
            setEditingMonthlySummary(null);
          }
        }}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-3 mb-3 border-b border-slate-800">
            <DialogTitle>
              Edit Monthly Close: {editingMonthlySummary?.month_start ? formatMonthYear(`${editingMonthlySummary.month_start}T00:00:00Z`, { long: true, fallback: 'Monthly Summary' }) : 'Monthly Summary'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEditMonthly} className="space-y-4">
            <p className="text-xs text-slate-400">
              Manually adjust frozen financial metrics or task counters. Saved updates are stamped with your revision reason in this summary&apos;s audit trail.
            </p>

            {/* Spending section */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Spending & Cash Flow</span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Total Income</label>
                  <input
                    type="text"
                    data-testid="edit-monthly-income-input"
                    value={editMonthlyForm.total_income}
                    onChange={(e) => setEditMonthlyForm((prev) => ({ ...prev, total_income: e.target.value }))}
                    placeholder="0.00"
                    className="w-full h-8 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Total Expense</label>
                  <input
                    type="text"
                    data-testid="edit-monthly-expense-input"
                    value={editMonthlyForm.total_expense}
                    onChange={(e) => setEditMonthlyForm((prev) => ({ ...prev, total_expense: e.target.value }))}
                    placeholder="0.00"
                    className="w-full h-8 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Net Flow</label>
                  <input
                    type="text"
                    data-testid="edit-monthly-net-spending-input"
                    value={editMonthlyForm.net_spending}
                    onChange={(e) => setEditMonthlyForm((prev) => ({ ...prev, net_spending: e.target.value }))}
                    placeholder="0.00"
                    className="w-full h-8 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Investing & Net Worth section */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Investing & Net Worth</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Portfolio End</label>
                  <input
                    type="text"
                    data-testid="edit-monthly-portfolio-input"
                    value={editMonthlyForm.portfolio_value_end}
                    onChange={(e) => setEditMonthlyForm((prev) => ({ ...prev, portfolio_value_end: e.target.value }))}
                    placeholder="0.00"
                    className="w-full h-8 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Cash End</label>
                  <input
                    type="text"
                    data-testid="edit-monthly-cash-input"
                    value={editMonthlyForm.cash_end}
                    onChange={(e) => setEditMonthlyForm((prev) => ({ ...prev, cash_end: e.target.value }))}
                    placeholder="0.00"
                    className="w-full h-8 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Dividends Net</label>
                  <input
                    type="text"
                    data-testid="edit-monthly-dividends-input"
                    value={editMonthlyForm.total_dividends}
                    onChange={(e) => setEditMonthlyForm((prev) => ({ ...prev, total_dividends: e.target.value }))}
                    placeholder="0.00"
                    className="w-full h-8 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Net Worth End</label>
                  <input
                    type="text"
                    data-testid="edit-monthly-networth-input"
                    value={editMonthlyForm.net_worth_end}
                    onChange={(e) => setEditMonthlyForm((prev) => ({ ...prev, net_worth_end: e.target.value }))}
                    placeholder="0.00"
                    className="w-full h-8 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Productivity tasks section */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Productivity</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Tasks Created</label>
                  <input
                    type="number"
                    min={0}
                    data-testid="edit-monthly-tasks-created-input"
                    value={editMonthlyForm.tasks_created}
                    onChange={(e) => setEditMonthlyForm((prev) => ({ ...prev, tasks_created: e.target.value }))}
                    className="w-full h-8 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Tasks Completed</label>
                  <input
                    type="number"
                    min={0}
                    data-testid="edit-monthly-tasks-completed-input"
                    value={editMonthlyForm.tasks_completed}
                    onChange={(e) => setEditMonthlyForm((prev) => ({ ...prev, tasks_completed: e.target.value }))}
                    className="w-full h-8 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Revision reason */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Revision Reason <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                data-testid="edit-monthly-reason-input"
                value={editMonthlyForm.reason}
                onChange={(e) => setEditMonthlyForm((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="e.g. Corrected dividend tax deduction and manual broker cash balance"
                className="w-full h-9 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Saved as the revision reason in this summary&apos;s header and audit log.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsEditMonthlyModalOpen(false);
                  setEditingMonthlySummary(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                data-testid="submit-edit-monthly-btn"
                className="bg-cyan-600 hover:bg-cyan-500 text-white"
                disabled={updateMonthlyMutation.isPending}
              >
                {updateMonthlyMutation.isPending ? 'Saving Corrections...' : 'Save Corrections'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};


const SummaryCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
    <div className="space-y-2">{children}</div>
  </div>
);

const Metric = ({
  label,
  value,
  valueClass = 'text-white',
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
}) => (
  <div className="flex items-baseline justify-between gap-3 border-b border-slate-700/50 pb-2 last:border-0 last:pb-0">
    <span className="text-sm text-slate-400">{label}</span>
    <span className={`text-sm font-semibold ${valueClass}`}>{value}</span>
  </div>
);

// spec-091 / #183: week_change_pct is null when the start boundary is zero
// (divide-by-zero, already guarded server-side) — toNumber(null) coerced
// that to 0 and rendered a fabricated-looking "(0.00%)" next to a real
// amount. Render the change alone when the percentage is undefined.
const formatWeeklyMovement = (
  change: number,
  changePct: string | null | undefined,
  currency: string | null,
  displayProfile: DisplayProfile,
): string => {
  const changeSign = change > 0 ? '+' : '';
  const amount =
    changeSign +
    formatCurrency(
      change,
      currency,
      displayProfile.currencyDisplay,
      displayProfile.locale,
      displayProfile.decimalPlaces,
    );
  if (changePct == null) return amount;
  const pct = toNumber(changePct);
  const pctSign = pct > 0 ? '+' : '';
  return `${amount} (${pctSign}${pct.toFixed(2)}%)`;
};

const TodoCard = ({ summary }: { summary: WeeklySummary['todo_summary'] }) => (
  <SummaryCard title="Todo">
    <Metric label="Tasks created" value={summary?.tasks_created ?? 0} />
    <Metric label="Tasks completed" value={summary?.tasks_completed ?? 0} />
    {summary?.tasks_overdue != null && (
      <Metric label="Tasks overdue" value={summary.tasks_overdue} />
    )}
    {summary?.completion_rate_pct != null && (
      <Metric
        label="Completion rate"
        value={`${toNumber(summary.completion_rate_pct).toFixed(1)}%`}
      />
    )}
  </SummaryCard>
);

const SpendingCard = ({ summary }: { summary: WeeklySummary['spending_summary'] }) => {
  const displayProfile = useDisplayProfile();
  if (summary?.status !== 'complete' || !summary.currency || summary.has_multiple_currencies) {
    return (
      <SummaryCard title="Spending">
        <p className="text-sm text-amber-300">
          Combined spending totals are unavailable because this week contains multiple or unknown
          currencies.
        </p>
      </SummaryCard>
    );
  }
  const fmt = (amount: string | number | null | undefined) =>
    formatCurrency(
      amount,
      summary.currency,
      displayProfile.currencyDisplay,
      displayProfile.locale,
      displayProfile.decimalPlaces,
    );
  return (
    <SummaryCard title="Spending">
      <Metric label="Recorded income" value={fmt(summary.total_income)} />
      <Metric label="Recorded expense" value={fmt(summary.total_expense)} />
      <Metric label="Net recorded amount" value={fmt(summary.net)} />
      {summary.budget_utilization_pct != null && (
        <Metric label="Budget utilization" value={`${summary.budget_utilization_pct}%`} />
      )}
      <Metric label="Budgets breached" value={summary.budgets_breached ?? 0} />
      {(summary.top_categories ?? []).slice(0, 3).map((category) => (
        <Metric key={category.name} label={category.name} value={fmt(category.amount)} />
      ))}
    </SummaryCard>
  );
};

const InvestingCard = ({ summary }: { summary: WeeklySummary['investing_summary'] }) => {
  const displayProfile = useDisplayProfile();
  if (summary?.status !== 'complete' || !summary?.currency) {
    return (
      <SummaryCard title="Investing">
        <p className="text-sm text-amber-300">
          Investing comparison unavailable — compatible start and end portfolio snapshots were
          not found.
        </p>
      </SummaryCard>
    );
  }

  const fmt = (amount: string | number | null | undefined) =>
    formatCurrency(
      amount,
      summary.currency,
      displayProfile.currencyDisplay,
      displayProfile.locale,
      displayProfile.decimalPlaces,
    );
  const change = toNumber(summary.week_change);
  const movementClass =
    change > 0 ? 'text-emerald-300' : change < 0 ? 'text-rose-300' : 'text-slate-200';
  return (
    <SummaryCard title="Investing">
      <Metric label="Portfolio value" value={fmt(summary.portfolio_value_end)} />
      <Metric label="Investment cash" value={fmt(summary.cash_end)} />
      <Metric
        label="Weekly movement"
        value={formatWeeklyMovement(change, summary.week_change_pct, summary.currency, displayProfile)}
        valueClass={movementClass}
      />
      <Metric
        label="Valuation dates"
        value={`${summary.start_snapshot_date ?? 'N/A'} → ${summary.end_snapshot_date ?? 'N/A'}`}
        valueClass="text-slate-300"
      />
    </SummaryCard>
  );
};

const HealthCard = ({ summary }: { summary: WeeklySummary['health_summary'] }) => {
  if (!summary) return null;
  return (
    <SummaryCard title="Health">
      <Metric label="Doses taken" value={`${summary.doses_taken} / ${summary.doses_scheduled}`} />
      {summary.adherence_pct != null && (
        <Metric label="Adherence" value={`${toNumber(summary.adherence_pct).toFixed(1)}%`} />
      )}
      <Metric label="Weight entries logged" value={summary.weight_entries_logged} />
      {summary.weight_delta_kg != null && (
        <Metric label="Weight change" value={`${summary.weight_delta_kg} kg`} />
      )}
    </SummaryCard>
  );
};

const DividendCard = ({ summary }: { summary: WeeklySummary['dividend_summary'] }) => {
  const displayProfile = useDisplayProfile();
  if (!summary || summary.status !== 'complete') {
    return (
      <SummaryCard title="Dividend Income">
        <p className="text-sm text-amber-300">
          Dividend income is unavailable because this week contains multiple currencies.
        </p>
      </SummaryCard>
    );
  }
  const fmt = (amount: string | number | null | undefined) =>
    formatCurrency(
      amount,
      summary.currency,
      displayProfile.currencyDisplay,
      displayProfile.locale,
      displayProfile.decimalPlaces,
    );
  return (
    <SummaryCard title="Dividend Income">
      <Metric
        label="Received"
        value={summary.currency ? fmt(summary.total_net) : (summary.total_net ?? '0')}
      />
      <Metric label="Payments" value={summary.count} />
      {summary.by_symbol.slice(0, 3).map((row) => (
        <Metric
          key={row.symbol}
          label={row.symbol}
          value={summary.currency ? fmt(row.net_amount) : row.net_amount}
        />
      ))}
    </SummaryCard>
  );
};

const NetWorthCard = ({ summary }: { summary: WeeklySummary['net_worth_summary'] }) => {
  const displayProfile = useDisplayProfile();
  if (!summary || summary.status !== 'complete' || !summary.currency) {
    return (
      <SummaryCard title="Net Worth">
        <p className="text-sm text-amber-300">
          Net worth comparison unavailable — compatible start and end snapshots were not found.
        </p>
      </SummaryCard>
    );
  }
  const change = toNumber(summary.week_change);
  const movementClass =
    change > 0 ? 'text-emerald-300' : change < 0 ? 'text-rose-300' : 'text-slate-200';
  return (
    <SummaryCard title="Net Worth">
      <Metric
        label="Net worth"
        value={formatCurrency(
          summary.net_worth_end,
          summary.currency,
          displayProfile.currencyDisplay,
          displayProfile.locale,
          displayProfile.decimalPlaces,
        )}
      />
      <Metric
        label="Weekly movement"
        value={formatWeeklyMovement(change, summary.week_change_pct, summary.currency, displayProfile)}
        valueClass={movementClass}
      />
      <Metric
        label="Valuation dates"
        value={`${summary.start_snapshot_date ?? 'N/A'} → ${summary.end_snapshot_date ?? 'N/A'}`}
        valueClass="text-slate-300"
      />
    </SummaryCard>
  );
};

const ReturnMetricsCard = ({ summary }: { summary: WeeklySummary['return_metrics_summary'] }) => {
  if (!summary || summary.status !== 'complete') {
    return (
      <SummaryCard title="Return Metrics">
        <p className="text-sm text-amber-300">
          Return metrics are unavailable — not enough investing activity to compute XIRR yet.
        </p>
      </SummaryCard>
    );
  }
  return (
    <SummaryCard title="Return Metrics">
      <p className="mb-2 text-xs text-slate-500">
        Current standing as of generation — not a week-over-week change.
      </p>
      {summary.xirr != null && <Metric label="XIRR" value={`${summary.xirr}%`} />}
      {summary.annualized_return_pct != null && (
        <Metric label="Annualized return" value={`${summary.annualized_return_pct}%`} />
      )}
      {summary.max_drawdown_pct != null && (
        <Metric
          label="Max drawdown"
          value={`${summary.max_drawdown_pct}%`}
          valueClass={summary.notable ? 'text-rose-300' : 'text-white'}
        />
      )}
    </SummaryCard>
  );
};
