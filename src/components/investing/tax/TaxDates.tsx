import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { investingService } from '../../../services/investing';
import { queryKeys } from '../../../lib/queryKeys';
import { formatDate } from '../../../utils/dateFormat';
import { SkeletonList } from '../../ui/FeedbackStates';

const when = (days: number): string =>
  days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;

/** Every upcoming tax date, nearest first (spec-113 §5.4). */
export const TaxDates: React.FC = () => {
  const query = useQuery({
    queryKey: queryKeys.investing.tax.dates(),
    queryFn: () => investingService.getTaxDates(),
  });

  return (
    <section
      className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4"
      data-testid="tax-dates"
    >
      <h3 className="text-sm font-semibold text-slate-100">Dates</h3>
      {query.isLoading ? (
        <div className="mt-3">
          <SkeletonList rows={2} />
        </div>
      ) : query.isError ? (
        <p className="mt-2 text-sm text-rose-200">Could not load the dates. Try again.</p>
      ) : (query.data?.dates ?? []).length === 0 ? (
        <p className="mt-2 text-sm text-slate-400" data-testid="tax-no-dates">
          No tax dates coming up.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {query.data?.dates.map((item, index) => (
            <li
              key={`${item.kind}-${item.date}-${index}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-700/50 bg-slate-800/30 p-3"
              data-testid={`tax-date-${item.kind}`}
            >
              <div>
                <div className="text-sm font-medium text-slate-100">{item.headline}</div>
                <p className="mt-0.5 text-xs text-slate-400">{item.detail}</p>
                {item.estimate ? (
                  <span className="mt-1 inline-block rounded border border-amber-700/50 bg-amber-950/40 px-1.5 py-0.5 text-[10px] text-amber-200">
                    estimate
                  </span>
                ) : null}
              </div>
              <div className="shrink-0 text-right text-xs text-slate-300">
                <div>{formatDate(item.date)}</div>
                <div className="text-slate-500">{when(item.days_until)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {(query.data?.warnings ?? []).map((warning) => (
        <p key={warning} className="mt-2 text-xs text-amber-300">
          {warning}
        </p>
      ))}
    </section>
  );
};
