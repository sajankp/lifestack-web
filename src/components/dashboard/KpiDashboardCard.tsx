import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Gauge } from 'lucide-react';
import { queryKeys } from '../../lib/queryKeys';
import { spendingService } from '../../services/spending';
import { formatCurrency } from '../../utils/numberFormat';

interface KpiDashboardCardProps {
  currencyDisplayPreference: 'symbol' | 'code';
}

/**
 * Dashboard KPI surface (spec-077). Deliberately self-contained: fetches
 * GET /v1/spending/kpis directly rather than folding into DashboardSummary
 * — the backend touch for spec-077 is confined to app/spending/ plus one
 * guardrails-job line, so the aggregated dashboard endpoint stays untouched.
 */
export const KpiDashboardCard: React.FC<KpiDashboardCardProps> = ({ currencyDisplayPreference }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.spending.kpis('dashboard'),
    queryFn: () => spendingService.getKpis(20, 0),
  });

  // Additive, not load-bearing — a failed fetch should never block the rest
  // of the dashboard, same rule as BriefingCard.
  if (isError) return null;
  const kpis = data?.items ?? [];
  if (!isLoading && kpis.length === 0) return null;

  return (
    <div className="mt-6">
      <section
        data-testid="dashboard-kpi-card"
        className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl shadow-black/10"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Gauge className="h-5 w-5 text-cyan-400" />
            <h2 className="text-xl font-semibold text-white">Custom KPIs</h2>
          </div>
          <Link to="/spending?tab=kpis" className="text-xs font-medium text-cyan-400 hover:text-cyan-300">
            Manage
          </Link>
        </div>

        {isLoading ? (
          <div className="mt-4 h-16 animate-pulse rounded-2xl bg-slate-800/50" />
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {kpis.map((kpi) => {
              const current = parseFloat(kpi.current_value.toString());
              const target = kpi.target_value != null ? parseFloat(kpi.target_value.toString()) : null;
              return (
                <div
                  key={kpi.public_id}
                  data-testid={`dashboard-kpi-card-item-${kpi.public_id}`}
                  className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-semibold text-white">{kpi.name}</p>
                    {kpi.is_breached ? (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                    ) : null}
                  </div>
                  <p className={`mt-1 text-lg font-bold ${kpi.is_breached ? 'text-rose-300' : 'text-white'}`}>
                    {formatCurrency(current, kpi.currency_code, currencyDisplayPreference)}
                  </p>
                  {target != null ? (
                    <p className="mt-0.5 text-xs text-slate-400">
                      target {kpi.target_direction === 'lte' ? '≤' : '≥'}{' '}
                      {formatCurrency(target, kpi.currency_code, currencyDisplayPreference)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
