import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboard';
import { summariesService } from '../services/summaries';
import { financeService } from '../services/finance';
import { RefreshCw, AlertCircle, Clock3, CircleAlert, PiggyBank, Wallet, BriefcaseBusiness } from 'lucide-react';
import { formatCurrency, toNumber } from '../utils/numberFormat';

export const DashboardPage: React.FC = () => {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => dashboardService.getSummary(),
  });
  const { data: latestSummary } = useQuery({
    queryKey: ['summaries', 'weekly', 'latest'],
    queryFn: () => summariesService.latestWeekly(),
  });
  const { data: financeSettings } = useQuery({
    queryKey: ['finance', 'settings'],
    queryFn: () => financeService.getSettings(),
  });
  const displayCurrency = financeSettings?.reporting_currency_code ?? 'USD';

  const generatedAt = data
    ? new Date(data.system.generated_at).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;
  const latestWeeklyStartLabel = (() => {
    if (!latestSummary?.week_start) return 'N/A';
    const date = new Date(`${latestSummary.week_start}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString(undefined, {
      dateStyle: 'medium',
      timeZone: 'UTC',
    });
  })();
  const budgetRemaining =
    data?.spending.month_budget != null
      ? toNumber(data.spending.month_budget) - toNumber(data.spending.month_spent)
      : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="w-full px-8 py-8">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Workspace snapshot</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">Dashboard</h1>
            <p className="mt-2 max-w-2xl text-slate-400">
              Live totals for tasks, spending, and portfolio activity.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => void refetch()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-slate-800 bg-slate-900/60">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />
          </div>
        ) : isError ? (
          <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-100">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5" />
              <p className="font-semibold">Dashboard data could not be loaded.</p>
            </div>
            <p className="mt-2 text-sm text-rose-100/80">Try refreshing the page or check the backend service.</p>
          </div>
        ) : data ? (
          <>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Open todos"
                value={data.todos.open_count.toString()}
                note={`${data.todos.overdue_count} overdue`}
                icon={<CircleAlert className="h-5 w-5" />}
                accent="from-cyan-500/25 to-sky-500/10"
              />
              <MetricCard
                label="This month spent"
                value={formatCurrency(data.spending.month_spent, displayCurrency)}
                note={data.spending.month_budget != null ? `Budget: ${formatCurrency(data.spending.month_budget, displayCurrency)}` : 'No budget set'}
                icon={<PiggyBank className="h-5 w-5" />}
                accent="from-emerald-500/25 to-teal-500/10"
              />
              <MetricCard
                label="Budget remaining"
                value={budgetRemaining != null ? formatCurrency(budgetRemaining, displayCurrency) : 'N/A'}
                note={budgetRemaining != null ? 'Based on current month budget' : 'Set a budget to track remaining spend'}
                icon={<Wallet className="h-5 w-5" />}
                accent="from-violet-500/25 to-fuchsia-500/10"
              />
              <MetricCard
                label="Portfolio value"
                value={formatCurrency(data.investing.portfolio_value, displayCurrency)}
                note={`${data.investing.holdings_count} holdings`}
                icon={<BriefcaseBusiness className="h-5 w-5" />}
                accent="from-amber-500/25 to-orange-500/10"
              />
            </div>

            <div className="mt-6">
              <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl shadow-black/10">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">Status</h2>
                    <p className="mt-1 text-sm text-slate-400">The dashboard reflects the latest backend summary.</p>
                  </div>
                  {generatedAt ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-300">
                      <Clock3 className="h-3.5 w-3.5" />
                      Updated {generatedAt}
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <StatRow label="Next due items" value={data.todos.next_due_items.length.toString()} />
                  <StatRow label="Active guardrail todos" value={data.todos.active_guardrail_todo_count.toString()} />
                  <StatRow
                    label="Top overspent categories"
                    value={data.spending.top_overspent_categories.length.toString()}
                  />
                  <StatRow
                    label="Daily portfolio change"
                    value={data.investing.daily_change != null ? formatCurrency(data.investing.daily_change, displayCurrency) : 'N/A'}
                  />
                  <StatRow
                    label="Latest weekly summary"
                    value={latestWeeklyStartLabel}
                  />
                  <StatRow
                    label="Summary status"
                    value={`${data.todos.status} / ${data.spending.status} / ${data.investing.status}`}
                  />
                </div>
              </section>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

type MetricCardProps = {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  accent: string;
};

const MetricCard = ({ label, value, note, icon, accent }: MetricCardProps) => (
  <div className={`relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br ${accent} p-6 shadow-xl shadow-black/10`}>
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-slate-400">{label}</p>
        <p className="mt-3 text-3xl font-bold tracking-tight text-white">{value}</p>
        <p className="mt-2 text-sm text-slate-300">{note}</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-white">{icon}</div>
    </div>
  </div>
);

const StatRow = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
    <p className="text-sm text-slate-400">{label}</p>
    <p className="mt-2 text-xl font-semibold text-white">{value}</p>
  </div>
);
