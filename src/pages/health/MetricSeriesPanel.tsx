import React, { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import { healthRecordsService } from '../../services/healthRecords';
import { formatDate } from '../../utils/dateFormat';
import { InRangeChip } from './InRangeChip';
import { MetricSeriesChart } from './MetricSeriesChart';
import { formatRange, formatReading, sourceLabel, trimDecimal } from './recordsFormat';

const Tile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div
    data-testid={`tile-${label}`}
    className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3"
  >
    <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 text-lg font-semibold text-white">{value}</p>
  </div>
);

const delta = (value: string | null, unit: string): string => {
  if (value == null) return '—';
  const n = Number(value);
  return `${n >= 0 ? '+' : ''}${trimDecimal(n.toFixed(2))}${unit}`;
};

export const MetricSeriesPanel: React.FC<{
  code: string;
  onClose: () => void;
  onOpenRecord: (publicId: string) => void;
}> = ({ code, onClose, onOpenRecord }) => {
  const scrollPanelIntoView = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    // Opened from a card in the Results list — bring the panel into view so
    // the data is visible without scrolling (health page UX fix).
    try {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch {
      // scrollIntoView unavailable in this environment — non-fatal.
    }
  }, []);

  const query = useQuery({
    queryKey: queryKeys.health.series(code),
    queryFn: () => healthRecordsService.getSeries(code),
    staleTime: 60 * 1000,
  });

  if (query.isLoading) return <div className="h-40 animate-pulse rounded-xl bg-slate-800/60" />;
  if (query.isError || !query.data) {
    return (
      <p role="alert" className="rounded-xl border border-rose-500/40 p-4 text-sm text-rose-300">
        Could not load this metric.
      </p>
    );
  }

  const { metric, points, stats } = query.data;
  const unit = metric.canonical_unit ? ` ${metric.canonical_unit}` : '';
  const isNumeric = metric.value_type === 'numeric';

  return (
    <div
      ref={scrollPanelIntoView}
      data-testid="metric-series-panel"
      className="space-y-4 rounded-xl border border-slate-700/60 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-white">{metric.name}</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-medium text-cyan-400 hover:text-cyan-300"
        >
          Close
        </button>
      </div>

      {isNumeric ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile
              label="Latest"
              value={stats.latest != null ? `${trimDecimal(stats.latest)}${unit}` : '—'}
            />
            <Tile label="Δ 7 days" value={delta(stats.delta_7d, unit)} />
            <Tile label="Δ 30 days" value={delta(stats.delta_30d, unit)} />
            <Tile label="Results" value={String(stats.count)} />
          </div>
          <MetricSeriesChart metric={metric} points={points} />
        </>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" data-testid="metric-points-table">
          <thead className="text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Result</th>
              <th className="py-2 pr-3">Report range</th>
              <th className="py-2 pr-3">Note</th>
              <th className="py-2">Source</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.public_id} className="border-t border-slate-800 align-top">
                <td className="py-2 pr-3 text-slate-300">{formatDate(p.measured_on)}</td>
                <td className="py-2 pr-3 text-white">
                  <span>{formatReading(p)}</span> <InRangeChip value={p.in_range} />
                  {p.converted && p.canonical_value != null ? (
                    <span className="ml-2 text-xs text-slate-400">
                      = {trimDecimal(p.canonical_value)}
                      {unit} (converted from {p.unit})
                    </span>
                  ) : null}
                </td>
                <td className="py-2 pr-3 text-slate-400">{formatRange(p)}</td>
                <td className="py-2 pr-3 text-slate-400">{p.note ?? ''}</td>
                <td className="py-2 text-xs text-slate-400">
                  {p.record_public_id ? (
                    <button
                      type="button"
                      onClick={() => onOpenRecord(p.record_public_id as string)}
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      {sourceLabel(p.source_type)}
                    </button>
                  ) : (
                    sourceLabel(p.source_type)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {query.data.has_more ? (
          <p className="mt-2 text-xs text-slate-400">
            Showing the latest {points.length} of {query.data.total}.
          </p>
        ) : null}
      </div>
    </div>
  );
};
