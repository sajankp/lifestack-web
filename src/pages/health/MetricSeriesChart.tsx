import React from 'react';
import { formatShortDate } from '../../utils/dateFormat';
import type { HealthMetric, MeasurementPoint } from '../../services/healthRecords';
import { toCanonical, trimDecimal } from './recordsFormat';

type Props = { metric: HealthMetric; points: MeasurementPoint[] };

const dayMs = (iso: string): number => new Date(`${iso}T00:00:00Z`).getTime();

/** Line chart of one metric in its canonical unit, positioned by calendar day, with a shaded
 * band for the most recent report's own reference range. Threshold (`<0.5`) and text results
 * are listed in the table but not plotted. */
export const MetricSeriesChart: React.FC<Props> = ({ metric, points }) => {
  const plotted = points
    .filter((p) => p.comparator == null && p.canonical_value != null)
    .map((p) => ({
      id: p.public_id,
      day: p.measured_on,
      x: dayMs(p.measured_on),
      y: Number(p.canonical_value),
    }))
    .sort((a, b) => a.x - b.x);

  if (plotted.length < 2) {
    return (
      <p className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-6 text-center text-sm text-slate-400">
        Two or more results are needed to draw a trend.
      </p>
    );
  }

  const withRange = points.find((p) => p.ref_low != null || p.ref_high != null);
  const bandLow =
    withRange?.ref_low != null ? toCanonical(withRange.ref_low, withRange.unit, metric) : null;
  const bandHigh =
    withRange?.ref_high != null ? toCanonical(withRange.ref_high, withRange.unit, metric) : null;

  const width = 640;
  const height = 200;
  const padX = 36;
  const padY = 18;
  const ys = plotted.map((p) => p.y);
  const lo = Math.min(...ys, ...(bandLow != null ? [bandLow] : []));
  const hi = Math.max(...ys, ...(bandHigh != null ? [bandHigh] : []));
  const range = hi - lo || 1;
  const x0 = plotted[0].x;
  const xSpan = plotted[plotted.length - 1].x - x0 || 1;
  const getX = (x: number) => padX + ((x - x0) / xSpan) * (width - 2 * padX);
  const getY = (y: number) => height - padY - ((y - lo) / range) * (height - 2 * padY);
  const line = plotted.map((p) => `${getX(p.x)},${getY(p.y)}`).join(' L ');
  const unit = metric.canonical_unit ? ` ${metric.canonical_unit}` : '';

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
      <div className="relative w-full overflow-x-auto">
        <svg
          className="w-full min-w-[480px]"
          viewBox={`0 0 ${width} ${height}`}
          data-testid="metric-series-chart"
        >
          {bandLow != null || bandHigh != null ? (
            <rect
              data-testid="reference-band"
              x={padX}
              width={width - 2 * padX}
              y={getY(bandHigh ?? hi)}
              height={Math.max(getY(bandLow ?? lo) - getY(bandHigh ?? hi), 1)}
              fill="#10b981"
              fillOpacity={0.12}
            />
          ) : null}
          <path d={`M ${line}`} fill="none" stroke="#06b6d4" strokeWidth={2} />
          {plotted.map((p) => (
            <circle key={p.id} cx={getX(p.x)} cy={getY(p.y)} r={2.5} fill="#06b6d4" />
          ))}
          <text x={padX} y={height - 2} fill="#94a3b8" fontSize="10">
            {formatShortDate(plotted[0].day)}
          </text>
          <text x={width - padX} y={height - 2} fill="#94a3b8" fontSize="10" textAnchor="end">
            {formatShortDate(plotted[plotted.length - 1].day)}
          </text>
          <text x={padX} y={getY(hi) - 4} fill="#94a3b8" fontSize="10">
            {trimDecimal(String(hi))}
            {unit}
          </text>
          <text x={padX} y={getY(lo) + 12} fill="#94a3b8" fontSize="10">
            {trimDecimal(String(lo))}
            {unit}
          </text>
        </svg>
      </div>
      {bandLow != null || bandHigh != null ? (
        <p className="mt-2 text-xs text-slate-400">
          Shaded: the range printed on the latest report.
        </p>
      ) : null}
    </div>
  );
};
