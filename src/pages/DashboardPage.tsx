import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboard';
import { financeService } from '../services/finance';
import { notificationsService } from '../services/notifications';
import { RefreshCw, AlertCircle, Clock3, CircleAlert, PiggyBank, Wallet, BriefcaseBusiness, Lightbulb, ArrowRight } from 'lucide-react';
import { PageHero } from '../components/layout/PageHero';
import { PageShell } from '../components/layout/PageShell';
import { formatCurrency, toNumber } from '../utils/numberFormat';
import { formatDateTime } from '../utils/dateFormat';
import { queryKeys } from '../lib/queryKeys';

export const DashboardPage: React.FC = () => {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.dashboard.summary(),
    queryFn: () => dashboardService.getSummary(),
  });
  const { data: userFinanceSettings } = useQuery({
    queryKey: queryKeys.finance.settings('user'),
    queryFn: () => financeService.getUserSettings(),
  });
  const {
    data: insightsData,
    isLoading: isInsightsLoading,
    isError: isInsightsError,
    refetch: refetchInsights,
  } = useQuery({
    queryKey: queryKeys.dashboard.insights(),
    queryFn: () => notificationsService.list(5, 0, { category: 'insight', is_read: false }),
  });
  const insights = insightsData?.items ?? [];
  const displayCurrency = userFinanceSettings?.effective_reporting_currency_code ?? 'USD';
  const currencyDisplayPreference =
    userFinanceSettings?.effective_currency_display_preference ?? 'symbol';

  const generatedAt = data?.system.generated_at
    ? formatDateTime(data.system.generated_at, { utc: false, fallback: '' }) || null
    : null;
  const budgetSpotlight = data?.spending.budget_spotlight ?? [];
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
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                to="/todo"
                label="Open todos"
                value={data.todos.open_count.toString()}
                note={`${data.todos.overdue_count} overdue`}
                icon={<CircleAlert className="h-5 w-5" />}
                accent="from-cyan-500/25 to-sky-500/10"
              />
              <MetricCard
                to="/spending?tab=budgets"
                label="This month spent"
                value={formatCurrency(data.spending.month_spent, displayCurrency, currencyDisplayPreference)}
                note={budgetSpotlight.length > 0 ? `${budgetSpotlight.length} group budget${budgetSpotlight.length > 1 ? 's' : ''} tracked below` : 'No group budgets set'}
                icon={<PiggyBank className="h-5 w-5" />}
                accent="from-emerald-500/25 to-teal-500/10"
              />
              <MetricCard
                to="/investing"
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

            {budgetSpotlight.length > 0 ? (
              <div className="mt-6">
                <section data-testid="dashboard-budget-spotlight" className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl shadow-black/10">
                  <div className="flex items-center gap-3">
                    <Wallet className="h-5 w-5 text-violet-400" />
                    <h2 className="text-xl font-semibold">Budget spotlight</h2>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {budgetSpotlight.map((item) => {
                      const utilization = Math.min(100, Math.max(0, item.utilization_pct));
                      const barColor = item.status === 'exceeded' ? 'bg-rose-500' : item.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500';
                      return (
                        <div
                          key={item.category_group_id}
                          data-testid="dashboard-budget-spotlight-card"
                          className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-white">{item.category_group_name}</p>
                            <span className="text-xs text-slate-400">{item.utilization_pct.toFixed(0)}%</span>
                          </div>
                          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-900/50">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${utilization}%` }} />
                          </div>
                          <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
                            <span>{formatCurrency(item.actual_amount, displayCurrency, currencyDisplayPreference)} of {formatCurrency(item.budget_amount, displayCurrency, currencyDisplayPreference)}</span>
                            <span>{formatCurrency(item.daily_amount_left, displayCurrency, currencyDisplayPreference)}/day left</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            ) : null}

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
                    <Link
                      to="/todo"
                      data-testid="dashboard-cue-overdue-todos"
                      className="flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-950/20 p-4 text-rose-200 transition hover:border-rose-500/40 hover:bg-rose-950/30"
                    >
                      <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                      <div className="flex-1">
                        <p className="font-semibold text-rose-100">Overdue Tasks</p>
                        <p className="mt-1 text-sm text-rose-300/90">
                          You have {overdueCount} task{overdueCount > 1 ? 's' : ''} overdue. View your todo list to update or complete them.
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                    </Link>
                  )}
                  {guardrailAlerts > 0 && (
                    <Link
                      to="/spending?tab=budgets"
                      data-testid="dashboard-cue-budget-guardrails"
                      className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4 text-amber-200 transition hover:border-amber-500/40 hover:bg-amber-950/30"
                    >
                      <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-amber-100">Budget Guardrails Triggered</p>
                        <p className="mt-1 text-sm text-amber-300/90">
                          {guardrailAlerts} active budget alert{guardrailAlerts > 1 ? 's' : ''} require attention. Spending in some categories exceeds guardrail thresholds.
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                    </Link>
                  )}
                  {overspentCategories.length > 0 && (
                    <Link
                      to="/spending?tab=budgets"
                      data-testid="dashboard-cue-overspent-budgets"
                      className="flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-950/20 p-4 text-rose-200 transition hover:border-rose-500/40 hover:bg-rose-950/30"
                    >
                      <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-rose-100">Overspent Budgets</p>
                        <p className="mt-1 text-sm text-rose-300/90">
                          You have exceeded monthly budget limits in: {overspentCategories.map(c => c.name || 'Unknown').join(', ')}.
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                    </Link>
                  )}
                  {isValuationStale && (
                    <Link
                      to="/investing"
                      data-testid="dashboard-cue-valuation-alert"
                      className="flex items-start gap-3 rounded-2xl border border-blue-500/20 bg-blue-950/20 p-4 text-blue-200 transition hover:border-blue-500/40 hover:bg-blue-950/30"
                    >
                      <AlertCircle className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-blue-100">Valuation Alert</p>
                        <p className="mt-1 text-sm text-blue-300/90">
                          Portfolio valuation status is '{data.investing.valuation_status}'. Some asset holdings or exchange rates may not reflect real-time prices.
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 mt-0.5 text-blue-400" />
                    </Link>
                  )}
                </div>
              );
            })()}

            <div className="mt-6">
              <section
                data-testid="dashboard-insights"
                className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl shadow-black/10"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Lightbulb className="h-5 w-5 text-cyan-400" />
                    <h2 className="text-xl font-semibold">Insights</h2>
                  </div>
                  <Link
                    to="/notifications"
                    data-testid="dashboard-insights-view-all"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-400 hover:text-cyan-300"
                  >
                    View all
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
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
                        <Link
                          key={insight.public_id}
                          to="/notifications"
                          data-testid="dashboard-insight-card"
                          className={`flex items-start gap-3 rounded-2xl border p-4 transition ${
                            isWarning
                              ? 'border-amber-500/20 bg-amber-950/20 text-amber-200 hover:border-amber-500/40 hover:bg-amber-950/30'
                              : 'border-cyan-500/20 bg-cyan-950/20 text-cyan-200 hover:border-cyan-500/40 hover:bg-cyan-950/30'
                          }`}
                        >
                          <AlertCircle
                            className={`h-5 w-5 shrink-0 mt-0.5 ${isWarning ? 'text-amber-400' : 'text-cyan-400'}`}
                          />
                          <div className="flex-1">
                            <p className={`font-semibold ${isWarning ? 'text-amber-100' : 'text-cyan-100'}`}>
                              {insight.title}
                            </p>
                            {insight.body ? (
                              <p className={`mt-1 text-sm ${isWarning ? 'text-amber-300/90' : 'text-cyan-300/90'}`}>
                                {insight.body}
                              </p>
                            ) : null}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {generatedAt ? (
              <p
                data-testid="dashboard-data-as-of"
                className="mt-6 inline-flex items-center gap-2 text-xs text-slate-500"
              >
                <Clock3 className="h-3.5 w-3.5" />
                Data as of {generatedAt}
              </p>
            ) : null}
          </>
        ) : null}
      </PageShell>
  );
};

type MetricCardProps = {
  to: string;
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  accent: string;
  testId?: string;
};

const MetricCard = ({ to, label, value, note, icon, accent, testId }: MetricCardProps) => (
  <Link
    to={to}
    className={`group relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br ${accent} p-6 shadow-xl shadow-black/10 transition hover:border-slate-600`}
  >
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-slate-400">{label}</p>
        <p data-testid={testId} className="mt-3 text-3xl font-bold tracking-tight text-white">{value}</p>
        <p className="mt-2 text-sm text-slate-300">{note}</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-white transition group-hover:bg-white/20">{icon}</div>
    </div>
  </Link>
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
