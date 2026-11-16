import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import { queryKeys } from '../../lib/queryKeys';
import { healthRecordsService } from '../../services/healthRecords';
import { formatDate } from '../../utils/dateFormat';
import { MetricSeriesPanel } from './MetricSeriesPanel';
import { RecordDetailPanel } from './RecordDetailPanel';
import { trimDecimal } from './recordsFormat';

/** Results over time (spec-110): read-only here. Weight keeps its own section above. */
export const RecordsSection: React.FC = () => {
  const [metricCode, setMetricCode] = React.useState<string | null>(null);
  const [recordId, setRecordId] = React.useState<string | null>(null);

  const metricsQuery = useQuery({
    queryKey: queryKeys.health.metrics(),
    queryFn: () => healthRecordsService.getMetrics(),
    staleTime: 60 * 1000,
  });
  const recordsQuery = useQuery({
    queryKey: queryKeys.health.records(),
    queryFn: () => healthRecordsService.getRecords(),
    staleTime: 60 * 1000,
  });

  const metrics = (metricsQuery.data ?? []).filter(
    (m) => m.code !== 'body_weight' && m.measurement_count > 0,
  );
  const records = recordsQuery.data?.items ?? [];

  if (metricsQuery.isLoading || recordsQuery.isLoading) {
    return <div className="h-24 animate-pulse rounded-xl bg-slate-800/60" />;
  }
  if (metricsQuery.isError || recordsQuery.isError) {
    return (
      <p role="alert" className="rounded-xl border border-rose-500/40 p-4 text-sm text-rose-300">
        Could not load results.
      </p>
    );
  }
  if (metrics.length === 0 && records.length === 0) {
    return (
      <div
        data-testid="records-empty"
        className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 py-10 text-center"
      >
        <FlaskConical className="h-8 w-8 text-slate-600" />
        <p className="text-sm text-slate-400">No results yet</p>
        <p className="max-w-sm text-xs text-slate-500">
          Lab results, prescriptions and other readings are added through your AI assistant (MCP)
          and show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {metrics.length > 0 ? (
        <ul
          data-testid="metrics-list"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {metrics.map((m) => (
            <li key={m.code}>
              <button
                type="button"
                data-testid={`metric-${m.code}`}
                onClick={() => {
                  setMetricCode(m.code);
                  setRecordId(null);
                }}
                className="w-full rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3 text-left hover:border-cyan-500/60"
              >
                <p className="text-xs uppercase tracking-wide text-slate-400">{m.category}</p>
                <p className="mt-0.5 font-medium text-white">{m.name}</p>
                <p className="mt-1 text-sm text-slate-300">
                  {m.latest
                    ? `${m.latest.comparator ?? ''}${
                        m.latest.value != null
                          ? trimDecimal(m.latest.value)
                          : m.latest.value_text ?? ''
                      }${m.latest.unit ? ` ${m.latest.unit}` : ''}`
                    : '—'}
                  {m.latest ? (
                    <span className="ml-2 text-xs text-slate-500">
                      {formatDate(m.latest.measured_on)}
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-slate-500">
                  {m.measurement_count} result{m.measurement_count === 1 ? '' : 's'}
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {metricCode ? (
        <MetricSeriesPanel
          code={metricCode}
          onClose={() => setMetricCode(null)}
          onOpenRecord={(id) => setRecordId(id)}
        />
      ) : null}

      {records.length > 0 ? (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Records
          </h3>
          <ul
            data-testid="records-list"
            className="divide-y divide-slate-800 rounded-xl border border-slate-700/60"
          >
            {records.map((r) => (
              <li key={r.public_id}>
                <button
                  type="button"
                  data-testid={`record-${r.public_id}`}
                  onClick={() => setRecordId(r.public_id)}
                  className="flex w-full flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-left hover:bg-slate-800/40"
                >
                  <span className="text-sm font-medium text-white">{r.title}</span>
                  <span className="text-xs text-slate-400">
                    {formatDate(r.recorded_on)}
                    {r.provider ? ` · ${r.provider}` : ''} · {r.measurement_count} result
                    {r.measurement_count === 1 ? '' : 's'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {recordId ? <RecordDetailPanel id={recordId} onClose={() => setRecordId(null)} /> : null}
      <InRangeLegend />
    </div>
  );
};

const InRangeLegend: React.FC = () => (
  <p className="text-xs text-slate-500">
    Range chips compare a result with the range printed on its own report. They are not medical
    advice.
  </p>
);
