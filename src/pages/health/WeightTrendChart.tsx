import React from 'react';
import { Scale } from 'lucide-react';
import { formatShortDate } from '../../utils/dateFormat';
import type { WeightEntry } from '../../services/health';

type WeightTrendChartProps = {
  entries: WeightEntry[];
};

/** Single-series line/area chart for weight trend — reuses the hand-rolled
 * SVG viewBox scaling pattern from NetWorthPage's NetWorthHistoryChart
 * (spec-069 §D: "reusing the net-worth chart component patterns"). */
export const WeightTrendChart: React.FC<WeightTrendChartProps> = ({ entries }) => {
  if (entries.length < 2) {
    return (
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-6 text-center">
        <Scale className="mx-auto mb-2 h-6 w-6 text-slate-500" />
        <p className="text-sm text-slate-400">Log a couple more entries to see a trend line here.</p>
      </div>
    );
  }

  // Chart wants oldest-first; the trend API returns newest-first.
  const points = [...entries].reverse().map((e) => ({
    id: e.public_id,
    dateStr: e.measured_at,
    value: parseFloat(e.weight_kg || '0'),
  }));

  const width = 640;
  const height = 200;
  const paddingX = 32;
  const paddingY = 16;

  const values = points.map((p) => p.value);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const range = maxVal - minVal || 1;

  const getX = (index: number) => paddingX + (index / Math.max(points.length - 1, 1)) * (width - 2 * paddingX);
  const getY = (val: number) => {
    const scale = (height - 2 * paddingY) / range;
    return height - paddingY - (val - minVal) * scale;
  };

  const path = points.map((p, i) => `${getX(i)},${getY(p.value)}`).join(' L ');
  const area = `M ${getX(0)},${height - paddingY} L ${path} L ${getX(points.length - 1)},${height - paddingY} Z`;

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
      <div className="relative w-full overflow-x-auto">
        <svg className="w-full min-w-[480px]" viewBox={`0 0 ${width} ${height}`} data-testid="weight-trend-chart">
          <defs>
            <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1={paddingX} x2={width - paddingX} y1={getY(maxVal)} y2={getY(maxVal)} stroke="#334155" strokeDasharray="4 4" />
          <line x1={paddingX} x2={width - paddingX} y1={getY(minVal)} y2={getY(minVal)} stroke="#334155" strokeDasharray="4 4" />
          <path d={area} fill="url(#weightGradient)" />
          <path d={`M ${path}`} fill="none" stroke="#06b6d4" strokeWidth={2} />
          {points.map((p, i) => (
            <circle key={p.id} cx={getX(i)} cy={getY(p.value)} r={2.5} fill="#06b6d4" />
          ))}
          <text x={paddingX} y={height - 2} fill="#94a3b8" fontSize="10">
            {formatShortDate(points[0].dateStr)}
          </text>
          <text x={width - paddingX} y={height - 2} fill="#94a3b8" fontSize="10" textAnchor="end">
            {formatShortDate(points[points.length - 1].dateStr)}
          </text>
          <text x={paddingX} y={getY(maxVal) - 4} fill="#94a3b8" fontSize="10">
            {maxVal.toFixed(1)} kg
          </text>
          <text x={paddingX} y={getY(minVal) + 12} fill="#94a3b8" fontSize="10">
            {minVal.toFixed(1)} kg
          </text>
        </svg>
      </div>
    </div>
  );
};
