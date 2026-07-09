import React, { useState } from 'react';
import { Scale } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { WeightTrendChart } from './WeightTrendChart';
import type { WeightTrend } from '../../services/health';

type WeightSectionProps = {
  trend: WeightTrend | undefined;
  isLoading: boolean;
  onLog: (weightKg: string) => void;
  isLogging?: boolean;
};

const StatTile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3">
    <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 text-lg font-semibold text-white">{value}</p>
  </div>
);

const formatDelta = (delta: string | null): string => {
  if (delta == null) return '—';
  const value = parseFloat(delta);
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)} kg`;
};

export const WeightSection: React.FC<WeightSectionProps> = ({ trend, isLoading, onLog, isLogging = false }) => {
  const [weightInput, setWeightInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = weightInput.trim();
    if (!trimmed) return;
    onLog(trimmed);
    setWeightInput('');
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium text-slate-300" htmlFor="weight-quick-log">
            Log weight (kg)
          </label>
          <input
            id="weight-quick-log"
            data-testid="weight-quick-log-input"
            type="number"
            step="0.1"
            min="0"
            inputMode="decimal"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            placeholder="e.g. 72.4"
            className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-white"
          />
        </div>
        <Button type="submit" loading={isLogging} disabled={!weightInput.trim()} data-testid="weight-quick-log-submit">
          Log
        </Button>
      </form>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-slate-800/60" />
      ) : trend && trend.entries.length > 0 ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Latest" value={trend.latest_kg ? `${parseFloat(trend.latest_kg).toFixed(1)} kg` : '—'} />
            <StatTile label="Δ 7 days" value={formatDelta(trend.delta_7d_kg)} />
            <StatTile label="Δ 30 days" value={formatDelta(trend.delta_30d_kg)} />
          </div>
          <WeightTrendChart entries={trend.entries} />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 py-10 text-center">
          <Scale className="h-8 w-8 text-slate-600" />
          <p className="text-sm text-slate-400">No weight entries yet</p>
        </div>
      )}
    </div>
  );
};
