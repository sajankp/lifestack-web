import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Layers, PieChart } from 'lucide-react';
import { Link } from 'react-router';
import { investingService } from '../../services/investing';
import { toNumber } from '../../utils/numberFormat';
import { useCurrencyFormatter } from '../../hooks/useDisplayProfile';
import { DatePicker } from '../../components/DatePicker';
import { queryKeys } from '../../lib/queryKeys';
import { SkeletonList } from '../../components/ui/FeedbackStates';
import { formatDateInput } from './format';
import { PortfolioAllocationCard } from '../../components/investing/PortfolioAllocationCard';
import { ThemeSplitCard } from '../../components/investing/ThemeSplitCard';
import { useActiveWorkspace } from '../../hooks/useActiveWorkspace';

// Fixed-order categorical palette (validated for the app's dark surface —
// see .agent/skills dataviz reference). "Other" gets the neutral slate tone
// already used for rollup buckets elsewhere in the app (spending breakdown).
const CONCENTRATION_COLORS = ['#3987e5', '#199e70', '#c98500', '#008300', '#9085e9', '#e66767'];
const CONCENTRATION_OTHER_COLOR = '#94a3b8';
const CONCENTRATION_TOP_N = 6;
const CONCENTRATION_GAP = 3; // svg units between donut segments

interface ExposureTabProps {
  currencyDisplayPreference: 'symbol' | 'code';
}

/**
 * Exposure (spec-113 §5.3): look-through in plain words, overlap, themes and the data warnings
 * as one line. Instrument and constituent admin lives in Settings > Instruments.
 */
export const ExposureTab: React.FC<ExposureTabProps> = ({ currencyDisplayPreference }) => {
  const formatCurrency = useCurrencyFormatter();
  const [analyticsAsOf, setAnalyticsAsOf] = useState(formatDateInput(new Date()));

  const exposureRes = useQuery({
    queryKey: queryKeys.investing.exposure(analyticsAsOf),
    queryFn: () => investingService.getExposureAnalytics(analyticsAsOf),
  });
  const exposure = exposureRes.data;
  const exposureLoading = exposureRes.isLoading;

  const overlapRes = useQuery({
    queryKey: queryKeys.investing.overlap(analyticsAsOf),
    queryFn: () => investingService.getOverlapAnalytics(analyticsAsOf),
  });
  const overlap = overlapRes.data;
  const overlapLoading = overlapRes.isLoading;

  const analyticsCurrency = exposureRes.data?.currency;

  const { activeWorkspaceId } = useActiveWorkspace(true);
  const portfolioReportsRes = useQuery({
    queryKey: queryKeys.investing.portfolioReports.list({
      workspaceId: activeWorkspaceId ?? undefined,
      limit: 1,
    }),
    queryFn: () =>
      investingService.getPortfolioReports(activeWorkspaceId!, undefined, undefined, 1),
    enabled: !!activeWorkspaceId,
  });
  const latestReport = portfolioReportsRes.data?.items?.[0] ?? null;

  const sortedExposureRows = useMemo(
    () =>
      [...(exposure?.exposure ?? [])].sort(
        (a, b) => toNumber(b.lookthrough_exposure) - toNumber(a.lookthrough_exposure),
      ),
    [exposure],
  );

  const concentration = useMemo(() => {
    const total = toNumber(exposure?.total_lookthrough_exposure ?? 0);
    if (!sortedExposureRows.length || total <= 0) return { slices: [], total: 0 };

    const top = sortedExposureRows.slice(0, CONCENTRATION_TOP_N);
    const rest = sortedExposureRows.slice(CONCENTRATION_TOP_N);
    const slices = top.map((row, index) => {
      const value = toNumber(row.lookthrough_exposure);
      return {
        key: row.company_id,
        label: row.company_ticker || row.company_name,
        value,
        pct: value / total,
        color: CONCENTRATION_COLORS[index % CONCENTRATION_COLORS.length],
      };
    });
    const restTotal = rest.reduce((sum, row) => sum + toNumber(row.lookthrough_exposure), 0);
    if (restTotal > 0) {
      slices.push({
        key: 'other',
        label: `Other (${rest.length})`,
        value: restTotal,
        pct: restTotal / total,
        color: CONCENTRATION_OTHER_COLOR,
      });
    }
    return { slices, total };
  }, [sortedExposureRows, exposure?.total_lookthrough_exposure]);

  return (
    <div className="space-y-6" data-testid="investing-exposure">
      <PortfolioAllocationCard
        asOf={analyticsAsOf}
        currencyDisplayPreference={currencyDisplayPreference}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="lg:col-span-1 space-y-4">
          <div className="space-y-4 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4">
            <h3 className="font-semibold text-white">Look-through settings</h3>
            <label className="block text-xs text-slate-300">
              As of date
              <DatePicker
                value={analyticsAsOf}
                onChange={setAnalyticsAsOf}
                placeholder="Select date"
                className="mt-1"
              />
            </label>
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3 text-xs text-slate-300">
              {/* spec-091 / #183: "Coverage: 0 / Status: partial" read as
                    contradicting charts that visibly show data — the number
                    was correct but unscoped. It measures look-through
                    decomposition (resolving funds into underlying companies),
                    not whether holdings/charts have data at all. */}
              <p>
                Look-through coverage:{' '}
                {exposure?.snapshot_coverage != null
                  ? `${(Number(exposure.snapshot_coverage) * 100).toFixed(0)}% of portfolio value`
                  : 'N/A'}
              </p>
              <p>Decomposition status: {exposure?.analysis_status ?? 'N/A'}</p>
              <p className="mt-2 text-xs text-slate-400">
                Instruments, their constituents and the minimum constituent size are managed in{' '}
                <Link
                  to="/settings/instruments"
                  data-testid="exposure-settings-link"
                  className="font-medium text-cyan-300 hover:text-cyan-200"
                >
                  Settings
                </Link>
                .
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4">
          <div className="mb-3 flex items-center gap-2 text-slate-100">
            <Layers className="h-4 w-4" />
            <h3 className="font-semibold">Exposure (Look-through)</h3>
          </div>
          {exposureLoading ? (
            <SkeletonList rows={3} />
          ) : (
            <div className="space-y-2 text-sm text-slate-300">
              <p className="text-xs text-slate-500">
                Market-value basis, converted to the reporting currency.
              </p>
              <p className="text-slate-200" data-testid="investing-exposure-summary">
                Whole portfolio, seen through funds{' '}
                <span
                  className="font-semibold text-white"
                  data-testid="investing-total-lookthrough"
                >
                  {exposure?.total_lookthrough_exposure != null && analyticsCurrency
                    ? formatCurrency(
                        exposure.total_lookthrough_exposure,
                        analyticsCurrency,
                        currencyDisplayPreference,
                      )
                    : '—'}
                </span>
                {' · '}of which stocks you hold directly{' '}
                <span className="font-semibold text-white" data-testid="investing-total-direct">
                  {exposure?.total_direct_exposure != null &&
                  analyticsCurrency &&
                  toNumber(exposure.total_direct_exposure) !== 0
                    ? formatCurrency(
                        exposure.total_direct_exposure,
                        analyticsCurrency,
                        currencyDisplayPreference,
                      )
                    : '—'}
                </span>
              </p>
              {!!exposure?.warnings?.length && (
                <details
                  className="text-xs text-amber-300"
                  data-testid="analytics-warnings-summary"
                >
                  <summary className="cursor-pointer">
                    {new Set(exposure.warnings).size} data warning
                    {new Set(exposure.warnings).size === 1 ? '' : 's'} — view
                  </summary>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {/* The API can repeat a warning (the same fund missing a constituent
                        snapshot), so dedupe before using it as a React key. */}
                    {[...new Set(exposure.warnings)].map((warning) => (
                      <li key={warning} data-testid="analytics-warning-item">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {exposure && (
                <p className="text-xs text-slate-500">
                  Showing constituents at or above {exposure.display_threshold_pct}% of the
                  portfolio
                  {exposure.hidden_exposure_count > 0
                    ? ` (${exposure.hidden_exposure_count} smaller constituents hidden)`
                    : ''}
                  .
                </p>
              )}
              {concentration.slices.length > 0 && (
                <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-4">
                  <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
                    <PieChart className="h-3.5 w-3.5" />
                    Concentration
                  </h4>
                  <div className="flex flex-col items-center gap-6 sm:flex-row">
                    <div
                      className="relative h-32 w-32 flex-shrink-0"
                      data-testid="investing-concentration-donut"
                    >
                      <svg className="h-full w-full" viewBox="0 0 200 200">
                        {(() => {
                          const circumference = 2 * Math.PI * 60;
                          // A single slice (100% in one holding) must render as a
                          // continuous ring — subtracting the inter-segment gap
                          // would leave a small broken notch.
                          const gap = concentration.slices.length > 1 ? CONCENTRATION_GAP : 0;
                          let cumulative = 0;
                          return concentration.slices.map((slice) => {
                            const sliceLength = slice.pct * circumference;
                            const dash = Math.max(sliceLength - gap, 0);
                            const offset = -cumulative;
                            cumulative += sliceLength;
                            return (
                              <circle
                                key={slice.key}
                                cx={100}
                                cy={100}
                                r={60}
                                fill="transparent"
                                stroke={slice.color}
                                strokeWidth="14"
                                strokeDasharray={`${dash} ${circumference}`}
                                strokeDashoffset={offset}
                                transform="rotate(-90 100 100)"
                              >
                                <title>{`${slice.label}: ${(slice.pct * 100).toFixed(1)}%`}</title>
                              </circle>
                            );
                          });
                        })()}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                          Total
                        </span>
                        <span className="text-xs font-extrabold text-white">
                          {analyticsCurrency
                            ? formatCurrency(
                                concentration.total,
                                analyticsCurrency,
                                currencyDisplayPreference,
                              )
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div className="w-full flex-1 space-y-1.5">
                      {concentration.slices.map((slice) => (
                        <div key={slice.key} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className="h-2.5 w-2.5 flex-shrink-0 rounded"
                              style={{ backgroundColor: slice.color }}
                            />
                            <span className="truncate font-medium text-slate-300">
                              {slice.label}
                            </span>
                          </div>
                          <span className="flex-shrink-0 font-semibold text-slate-400">
                            {(slice.pct * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="max-h-96 overflow-auto rounded-lg border border-slate-700/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/60 text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Company</th>
                      <th className="px-3 py-2">Direct market value</th>
                      <th className="px-3 py-2">Look-through market value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedExposureRows.map((row) => (
                      <tr key={row.company_id} className="border-t border-slate-700/40">
                        <td className="px-3 py-2">{row.company_ticker ?? row.company_name}</td>
                        <td className="px-3 py-2">
                          {analyticsCurrency
                            ? formatCurrency(
                                row.direct_exposure,
                                analyticsCurrency,
                                currencyDisplayPreference,
                              )
                            : 'N/A'}
                        </td>
                        <td className="px-3 py-2">
                          {analyticsCurrency
                            ? formatCurrency(
                                row.lookthrough_exposure,
                                analyticsCurrency,
                                currencyDisplayPreference,
                              )
                            : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1 rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4">
          <div className="mb-3 flex items-center gap-2 text-slate-100">
            <BarChart3 className="h-4 w-4" />
            <h3 className="font-semibold">Overlap</h3>
          </div>
          {overlapLoading ? (
            <SkeletonList rows={3} />
          ) : (
            <div className="space-y-2 text-sm text-slate-300">
              <p>
                Top 5 concentration:{' '}
                {(toNumber(overlap?.top_5_concentration_pct ?? 0) * 100).toFixed(2)}%
              </p>
              <p>
                Duplicate exposure index:{' '}
                {(toNumber(overlap?.duplicate_exposure_index ?? 0) * 100).toFixed(2)}%
              </p>
              <ol className="space-y-1 text-xs">
                {(overlap?.overlaps ?? []).slice(0, 8).map((row) => (
                  <li
                    key={row.company_id}
                    className="flex items-center justify-between rounded border border-slate-700/50 px-2 py-1"
                  >
                    <span>{row.company_ticker ?? row.company_name}</span>
                    <span>{(toNumber(row.portfolio_share) * 100).toFixed(2)}%</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      {latestReport ? <ThemeSplitCard themeWeights={latestReport.theme_weights} /> : null}
    </div>
  );
};
