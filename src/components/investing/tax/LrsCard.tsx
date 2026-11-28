import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { financeService } from '../../../services/finance';
import { queryKeys } from '../../../lib/queryKeys';
import { toNumber } from '../../../utils/numberFormat';
import { useCurrencyFormatter } from '../../../hooks/useDisplayProfile';

/** LRS used and headroom, live from /finance/lrs/summary (spec-113 §5.4). */
export const LrsCard: React.FC = () => {
  const money = useCurrencyFormatter();
  const query = useQuery({
    queryKey: queryKeys.finance.lrs(),
    queryFn: () => financeService.getLrsSummary(),
  });
  const lrs = query.data;
  if (query.isLoading || query.isError || !lrs) return null;
  const pct = Math.min(100, Math.max(0, toNumber(lrs.pct_of_cap)));

  return (
    <section
      className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4"
      data-testid="tax-lrs"
    >
      <h3 className="text-sm font-semibold text-slate-100">Money sent abroad (LRS)</h3>
      <p className="mt-1 text-sm text-slate-300">
        <span className="font-medium text-slate-100" data-testid="tax-lrs-used">
          {money(toNumber(lrs.total_usd), 'USD')}
        </span>{' '}
        of {money(toNumber(lrs.cap_usd), 'USD')} used in {lrs.fy_label}.{' '}
        <span data-testid="tax-lrs-headroom">
          {lrs.cap_exceeded
            ? 'The limit has been passed.'
            : `${money(toNumber(lrs.cap_remaining_usd), 'USD')} left.`}
        </span>
      </p>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Share of the LRS limit used"
      >
        <div
          className={`h-full ${lrs.cap_exceeded ? 'bg-rose-500' : 'bg-cyan-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {lrs.tcs_applicable ? (
        <p className="mt-2 text-xs text-amber-300" data-testid="tax-lrs-tcs">
          Tax collected at source applies above {money(toNumber(lrs.tcs_threshold_inr), 'INR')}:
          about {money(toNumber(lrs.tcs_amount_inr), 'INR')} so far.
        </p>
      ) : null}
    </section>
  );
};
