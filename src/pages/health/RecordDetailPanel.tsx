import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import { healthRecordsService } from '../../services/healthRecords';
import { formatDate } from '../../utils/dateFormat';
import { InRangeChip } from './InRangeChip';
import { formatRange, formatReading, sourceLabel } from './recordsFormat';

export const RecordDetailPanel: React.FC<{ id: string; onClose: () => void }> = ({
  id,
  onClose,
}) => {
  const query = useQuery({
    queryKey: queryKeys.health.record(id),
    queryFn: () => healthRecordsService.getRecord(id),
    staleTime: 60 * 1000,
  });

  if (query.isLoading) return <div className="h-32 animate-pulse rounded-xl bg-slate-800/60" />;
  if (query.isError || !query.data) {
    return (
      <p role="alert" className="rounded-xl border border-rose-500/40 p-4 text-sm text-rose-300">
        Could not load this record.
      </p>
    );
  }

  const record = query.data;
  return (
    <div
      data-testid="record-detail-panel"
      className="space-y-3 rounded-xl border border-slate-700/60 p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-white">{record.title}</h3>
          <p className="text-xs text-slate-400">
            {formatDate(record.recorded_on)} · {record.kind.replace(/_/g, ' ')}
            {record.provider ? ` · ${record.provider}` : ''} · {sourceLabel(record.source_type)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-medium text-cyan-400 hover:text-cyan-300"
        >
          Close
        </button>
      </div>
      {record.note ? (
        <p
          data-testid="record-note"
          className="whitespace-pre-wrap rounded-lg bg-slate-800/50 p-3 text-sm text-slate-300"
        >
          {record.note}
        </p>
      ) : null}
      {record.source_ref ? (
        <p className="text-xs text-slate-500">Source reference: {record.source_ref}</p>
      ) : null}
      <ul className="divide-y divide-slate-800">
        {record.measurements.map((m) => (
          <li
            key={m.public_id}
            className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm"
          >
            <span className="text-slate-300">{m.metric_name ?? m.metric_code}</span>
            <span className="text-white">
              {formatReading(m)} <InRangeChip value={m.in_range} />
              {formatRange(m) ? (
                <span className="ml-2 text-xs text-slate-400">range {formatRange(m)}</span>
              ) : null}
              {m.note ? <span className="ml-2 text-xs text-slate-400">{m.note}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
