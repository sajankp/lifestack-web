import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboard';
import { summariesService } from '../services/summaries';
import { financeService } from '../services/finance';
import { notificationsService } from '../services/notifications';
import { RefreshCw, AlertCircle, Clock3, CircleAlert, PiggyBank, Wallet, BriefcaseBusiness, Lightbulb } from 'lucide-react';
import { PageHero } from '../components/layout/PageHero';
import { PageShell } from '../components/layout/PageShell';
import { formatCurrency, toNumber } from '../utils/numberFormat';
import { formatDate, formatDateTime } from '../utils/dateFormat';

export const DashboardPage: React.FC = () => {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => dashboardService.getSummary(),
  });
  const { data: latestSummary } = useQuery({
    queryKey: ['summaries', 'weekly', 'latest'],
    queryFn: () => summariesService.latestWeekly(),
  });
  const { data: userFinanceSettings } = useQuery({
    queryKey: ['finance', 'settings', 'user'],
    queryFn: () => financeService.getUserSettings(),
  });
  const {
    data: insightsData,
    isLoading: isInsightsLoading,
    isError: isInsightsError,
    refetch: refetchInsights,
  } = useQuery({
    queryKey: ['dashboard', 'insights'],
    queryFn: () => notificationsService.list(5, 0, { category: 'insight', is_read: false }),
  });
  const insights = insightsData?.items ?? [];
  const displayCurrency = userFinanceSettings?.effective_reporting_currency_code ?? 'USD';
  const currencyDisplayPreference =
    userFinanceSettings?.effective_currency_display_preference ?? 'symbol';

  const generatedAt = data?.system.generated_at
    ? formatDateTime(data.system.generated_at, { utc: false, fallback: '' }) || null
    : null;
  const latestWeeklyStartLabel = formatDate(
    latestSummary?.week_start ? `${latestSummary.week_start}T00:00:00Z` : null,
    { fallback: 'N/A' },
  );
  const budgetRemaining =
    data?.spending.month_budget != null
      ? toNumber(data.spending.month_budget) - toNumber(data.spending.month_spent)
      : null;
  const portfolioGainLabel =
    data?.investing.total_gain_loss != null
      ? formatPerformanceMetric(
          data.investing.total_gain_loss,
          data.investing.total_gain_loss_pct,
          displayCurrency,
          currencyDisplayPreference,
        )
      : 'N/A';

  return (
    <PageShell>
      <PageHero
        title="Dashboard"
        subtitle="Live totals for tasks, spending, and portfolio activity."
        actions={(
          <button
            onClick={() => {
              void refetch();
              void refetchInsights();
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
      />
      <p className="mb-6 text-xs uppercase tracking-[0.35em] text-slate-500">Workspace snapshot</p>

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
                value={formatCurrency(data.spending.month_spent, displayCurrency, currencyDisplayPreference)}
                note={data.spending.month_budget != null ? `Budget: ${formatCurrency(data.spending.month_budget, displayCurrency, currencyDisplayPreference)}` : 'No budget set'}
                icon={<PiggyBank className="h-5 w-5" />}
                accent="from-emerald-500/25 to-teal-500/10"
              />
              <MetricCard
                label="Budget remaining"
                value={budgetRemaining != null ? formatCurrency(budgetRemaining, displayCurrency, currencyDisplayPreference) : 'N/A'}
                note={budgetRemaining != null ? 'Based on current month budget' : 'Set a budget to track remaining spend'}
                icon={<Wallet className="h-5 w-5" />}
                accent="from-violet-500/25 to-fuchsia-500/10"
              />
              <MetricCard
                label="Portfolio value"
                value={data.investing.portfolio_value != null
                  ? formatCurrency(data.investing.portfolio_value, displayCurrency, currencyDisplayPreference)
                  : 'N/A'}
                note={data.investing.invested_value != null
                  ? `Invested ${formatCurrency(data.investing.invested_value, displayCurrency, currencyDisplayPreference)} · Gain ${portfolioGainLabel}`
                  : `${data.investing.holdings_count} holdings`}
                icon={<BriefcaseBusiness className="h-5 w-5" />}
                accent="from-amber-500/25 to-orange-500/10"
                testId="dashboard-portfolio-value"
              />
            </div>

            {/* Dashboard Cues (Insights & Alerts) */}
            {(() => {
              const overdueCount = data?.todos?.overdue_count ?? 0;
              const overspentCategories = data?.spending?.top_overspent_categories ?? [];
              const guardrailAlerts = data?.todos?.active_guardrail_todo_count ?? 0;
              const statusLower = data?.investing?.valuation_status?.toLowerCase();
              const isValuationStale = statusLower && statusLower !== 'converted' && statusLower !== 'success';
              
              const hasCues = overdueCount > 0 || overspentCategories.length > 0 || guardrailAlerts > 0 || isValuationStale;
              if (!hasCues) return null;
              
              return (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {overdueCount > 0 && (
                    <div className="flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-950/20 p-4 text-rose-200">
                      <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                      <div>
                        <p className="font-semibold text-rose-100">Overdue Tasks</p>
                        <p className="mt-1 text-sm text-rose-300/90">
                          You have {overdueCount} task{overdueCount > 1 ? 's' : ''} overdue. Check your todo list to update or complete them.
                        </p>
                      </div>
                    </div>
                  )}
                  {guardrailAlerts > 0 && (
                    <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4 text-amber-200">
                      <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-100">Budget Guardrails Triggered</p>
                        <p className="mt-1 text-sm text-amber-300/90">
                          {guardrailAlerts} active budget alert{guardrailAlerts > 1 ? 's' : ''} require attention. Spending in some categories exceeds guardrail thresholds.
                        </p>
                      </div>
                    </div>
                  )}
                  {overspentCategories.length > 0 && (
                    <div className="flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-950/20 p-4 text-rose-200">
                      <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-rose-100">Overspent Budgets</p>
                        <p className="mt-1 text-sm text-rose-300/90">
                          You have exceeded monthly budget limits in: {overspentCategories.map(c => c.name || 'Unknown').join(', ')}.
                        </p>
                      </div>
                    </div>
                  )}
                  {isValuationStale && (
                    <div className="flex items-start gap-3 rounded-2xl border border-blue-500/20 bg-blue-950/20 p-4 text-blue-200">
                      <AlertCircle className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-blue-100">Valuation Alert</p>
                        <p className="mt-1 text-sm text-blue-300/90">
                          Portfolio valuation status is '{data.investing.valuation_status}'. Some asset holdings or exchange rates may not reflect real-time prices.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="mt-6">
              <section
                data-testid="dashboard-insights"
                className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl shadow-black/10"
              >
                <div className="flex items-center gap-3">
                  <Lightbulb className="h-5 w-5 text-cyan-400" />
                  <h2 className="text-xl font-semibold">Insights</h2>
                </div>
                {isInsightsLoading ? (
                  <div className="mt-4 flex justify-center py-4">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400" />
                  </div>
                ) : isInsightsError ? (
                  <p className="mt-3 text-sm text-rose-400">
                    Failed to load insights. Please try refreshing.
                  </p>
                ) : insights.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-400">
                    No insights right now — check back after your next few transactions.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {insights.map((insight) => {
                      const isWarning = insight.severity === 'warning';
                      return (
                        <div
                          key={insight.public_id}
                          data-testid="dashboard-insight-card"
                          className={`flex items-start gap-3 rounded-2xl border p-4 ${
                            isWarning
                              ? 'border-amber-500/20 bg-amber-950/20 text-amber-200'
                              : 'border-cyan-500/20 bg-cyan-950/20 text-cyan-200'
                          }`}
                        >
                          <AlertCircle
                            className={`h-5 w-5 shrink-0 mt-0.5 ${isWarning ? 'text-amber-400' : 'text-cyan-400'}`}
                          />
                          <div>
                            <p className={`font-semibold ${isWarning ? 'text-amber-100' : 'text-cyan-100'}`}>
                              {insight.title}
                            </p>
                            {insight.body ? (
                              <p className={`mt-1 text-sm ${isWarning ? 'text-amber-300/90' : 'text-cyan-300/90'}`}>
                                {insight.body}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
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
                  <StatRow label="Active budget alerts" value={data.todos.active_guardrail_todo_count.toString()} />
                  <StatRow
                    label="Top overspent categories"
                    value={data.spending.top_overspent_categories.length.toString()}
                  />
                  <StatRow
                    label="Daily portfolio change"
                    value={data.investing.daily_change != null
                      ? formatPerformanceMetric(
                          data.investing.daily_change,
                          data.investing.daily_change_pct,
                          displayCurrency,
                          currencyDisplayPreference,
                        )
                      : 'N/A'}
                  />
                  <StatRow
                    label="Investment cash"
                    value={data.investing.cash_total != null
                      ? formatCurrency(data.investing.cash_total, displayCurrency, currencyDisplayPreference)
                      : 'N/A'}
                  />
                  <StatRow
                    label="Portfolio valuation"
                    value={data.investing.snapshot_date
                      ? `${data.investing.snapshot_date} · ${data.investing.valuation_status}`
                      : 'N/A'}
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
      </PageShell>
  );
};

type MetricCardProps = {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  accent: string;
  testId?: string;
};

const MetricCard = ({ label, value, note, icon, accent, testId }: MetricCardProps) => (
  <div className={`relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br ${accent} p-6 shadow-xl shadow-black/10`}>
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-slate-400">{label}</p>
        <p data-testid={testId} className="mt-3 text-3xl font-bold tracking-tight text-white">{value}</p>
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

const formatPerformanceMetric = (
  amount: number | string,
  percentage: number | string | null,
  currency: string,
  preference: 'symbol' | 'code',
) => {
  const numericAmount = toNumber(amount);
  const sign = numericAmount > 0 ? '+' : '';
  const percentageLabel = percentage == null
    ? ''
    : ` (${toNumber(percentage) > 0 ? '+' : ''}${toNumber(percentage).toFixed(2)}%)`;
  return `${sign}${formatCurrency(numericAmount, currency, preference)}${percentageLabel}`;
};
