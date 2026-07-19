import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, RefreshCw } from 'lucide-react';
import { summariesService } from '../services/summaries';
import { queryKeys } from '../lib/queryKeys';
import { PageHero } from '../components/layout/PageHero';
import { PageShell } from '../components/layout/PageShell';
import { Pagination } from '../components/Pagination';
import { Button } from '../components/ui/button';
import { useToast } from '../components/ui/toast';
import { SkeletonList, EmptyState, ErrorBanner } from '../components/ui/FeedbackStates';
import { formatCurrency, toNumber } from '../utils/numberFormat';
import { formatDate, formatDateTime } from '../utils/dateFormat';
import type { WeeklySummary } from '../services/summaries';

export const WeeklySummariesPage: React.FC = () => {
  const [offset, setOffset] = useState(0);
  const limit = 12;
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const markedRef = useRef<string | null>(null);
  const [regenerateReasons, setRegenerateReasons] = useState<Record<string, string>>({});
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['summaries', 'weekly', offset],
    queryFn: () => summariesService.listWeekly(limit, offset),
  });

  // spec-076: manual regeneration. The list/latest endpoints only ever
  // return the current (non-superseded) row for a week, so every item
  // rendered here is always eligible to regenerate again.
  const regenerateMutation = useMutation({
    mutationFn: (payload: { summaryId: string; reason: string }) =>
      summariesService.regenerate(payload.summaryId, payload.reason || undefined),
    onSuccess: (_data, variables) => {
      setRegenerateReasons((prev) => {
        const next = { ...prev };
        delete next[variables.summaryId];
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ['summaries', 'weekly'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.briefing() });
    },
    onError: () => showToast('Failed to regenerate summary. Please try again.', 'error'),
  });

  // Opening this page counts as reading the latest summary (spec-080): mark it
  // read so the dashboard's "summary is ready" briefing line clears. Only the
  // newest (first page, top item) is the one the briefing surfaces; guard so we
  // fire once per summary and never re-mark an already-read one. Depend on the
  // primitive id/read_at, not the `latest` object, so a query-data refetch that
  // returns an equal-but-new object reference doesn't re-run the effect.
  const latest = offset === 0 ? data?.items?.[0] : undefined;
  const latestId = latest?.public_id;
  const latestReadAt = latest?.read_at;
  useEffect(() => {
    if (!latestId || latestReadAt || markedRef.current === latestId) return;
    markedRef.current = latestId;
    void summariesService
      .markRead(latestId)
      .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.briefing() }))
      .catch(() => {
        // Non-critical: a failed mark-read just leaves the briefing line until
        // the freshness window lapses. Allow a retry on the next render.
        markedRef.current = null;
      });
  }, [latestId, latestReadAt, queryClient]);

  return (
    <PageShell>
      <PageHero
        title="Weekly Summaries"
        subtitle="A readable weekly view of productivity, spending, and portfolio movement."
      />

      {isLoading ? (
        <SkeletonList rows={4} />
      ) : isError ? (
        <ErrorBanner
          message="Failed to load weekly summaries. Please try again."
          onRetry={() => void refetch()}
        />
      ) : data?.items?.length ? (
        <>
          <div className="space-y-4">
            {data.items.map((item) => (
              <article
                key={item.public_id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-black/10"
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-white">
                      Week of {formatDate(`${item.week_start}T00:00:00Z`, { fallback: 'N/A' })}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Generated {formatDateTime(item.generated_at, { fallback: 'N/A' })}
                      {item.regenerated_at && (
                        <>
                          {' · Regenerated '}
                          {formatDateTime(item.regenerated_at, { fallback: 'N/A' })}
                          {item.regeneration_reason && ` — ${item.regeneration_reason}`}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
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
                    <input
                      type="text"
                      placeholder="Reason (optional)"
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
                  </div>
                </div>
                {item.data_revised_after_snapshot && (
                  <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-800/60 bg-amber-950/20 p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    <p className="text-sm text-amber-200">
                      The Net Worth and Investing figures below may reflect an import that was
                      later reverted. The underlying valuation snapshot can't be recomputed after
                      the fact, so this figure is preserved as originally recorded — treat the
                      movement numbers with that in mind.
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
              </article>
            ))}
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
          title="No weekly summaries yet"
          description="Weekly summaries are automatically generated by backend jobs after activity is recorded for a full week."
        />
      )}
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
  return (
    <SummaryCard title="Spending">
      <Metric
        label="Recorded income"
        value={formatCurrency(summary.total_income, summary.currency)}
      />
      <Metric
        label="Recorded expense"
        value={formatCurrency(summary.total_expense, summary.currency)}
      />
      <Metric label="Net recorded amount" value={formatCurrency(summary.net, summary.currency)} />
      {summary.budget_utilization_pct != null && (
        <Metric label="Budget utilization" value={`${summary.budget_utilization_pct}%`} />
      )}
      <Metric label="Budgets breached" value={summary.budgets_breached ?? 0} />
      {(summary.top_categories ?? []).slice(0, 3).map((category) => (
        <Metric
          key={category.name}
          label={category.name}
          value={formatCurrency(category.amount, summary.currency)}
        />
      ))}
    </SummaryCard>
  );
};

const InvestingCard = ({ summary }: { summary: WeeklySummary['investing_summary'] }) => {
  if (summary?.status !== 'complete' || !summary?.currency) {
    return (
      <SummaryCard title="Investing">
        <p className="text-sm text-amber-300">
          Weekly comparison unavailable because compatible start and end snapshots were not found.
        </p>
      </SummaryCard>
    );
  }

  const change = toNumber(summary.week_change);
  const changePct = toNumber(summary.week_change_pct);
  const changeSign = change > 0 ? '+' : '';
  const pctSign = changePct > 0 ? '+' : '';
  const movementClass =
    change > 0 ? 'text-emerald-300' : change < 0 ? 'text-rose-300' : 'text-slate-200';
  return (
    <SummaryCard title="Investing">
      <Metric
        label="Portfolio value"
        value={formatCurrency(summary.portfolio_value_end, summary.currency)}
      />
      <Metric label="Investment cash" value={formatCurrency(summary.cash_end, summary.currency)} />
      <Metric
        label="Weekly movement"
        value={
          changeSign +
          formatCurrency(change, summary.currency) +
          ' (' +
          pctSign +
          changePct.toFixed(2) +
          '%)'
        }
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
  if (!summary || summary.status !== 'complete') {
    return (
      <SummaryCard title="Dividend Income">
        <p className="text-sm text-amber-300">
          Dividend income is unavailable because this week contains multiple currencies.
        </p>
      </SummaryCard>
    );
  }
  return (
    <SummaryCard title="Dividend Income">
      <Metric
        label="Received"
        value={
          summary.currency
            ? formatCurrency(summary.total_net, summary.currency)
            : (summary.total_net ?? '0')
        }
      />
      <Metric label="Payments" value={summary.count} />
      {summary.by_symbol.slice(0, 3).map((row) => (
        <Metric
          key={row.symbol}
          label={row.symbol}
          value={
            summary.currency ? formatCurrency(row.net_amount, summary.currency) : row.net_amount
          }
        />
      ))}
    </SummaryCard>
  );
};

const NetWorthCard = ({ summary }: { summary: WeeklySummary['net_worth_summary'] }) => {
  if (!summary || summary.status !== 'complete' || !summary.currency) {
    return (
      <SummaryCard title="Net Worth">
        <p className="text-sm text-amber-300">
          Weekly comparison unavailable because compatible start and end snapshots were not found.
        </p>
      </SummaryCard>
    );
  }
  const change = toNumber(summary.week_change);
  const changePct = toNumber(summary.week_change_pct);
  const changeSign = change > 0 ? '+' : '';
  const pctSign = changePct > 0 ? '+' : '';
  const movementClass =
    change > 0 ? 'text-emerald-300' : change < 0 ? 'text-rose-300' : 'text-slate-200';
  return (
    <SummaryCard title="Net Worth">
      <Metric label="Net worth" value={formatCurrency(summary.net_worth_end, summary.currency)} />
      <Metric
        label="Weekly movement"
        value={
          changeSign +
          formatCurrency(change, summary.currency) +
          ' (' +
          pctSign +
          changePct.toFixed(2) +
          '%)'
        }
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
