import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, PiggyBank, TrendingDown } from 'lucide-react';
import { investingService } from '../../../services/investing';
import { queryKeys } from '../../../lib/queryKeys';
import type { TaxOpportunity } from '../../../types/taxPlanning';
import { toNumber } from '../../../utils/numberFormat';
import { formatDate } from '../../../utils/dateFormat';
import { useCurrencyFormatter } from '../../../hooks/useDisplayProfile';
import { SkeletonList } from '../../ui/FeedbackStates';

const KIND_ICON: Record<string, React.ReactNode> = {
  harvest_loss: <TrendingDown className="h-4 w-4 text-rose-300" aria-hidden />,
  wait_for_long_term: <CalendarClock className="h-4 w-4 text-cyan-300" aria-hidden />,
  use_exemption: <PiggyBank className="h-4 w-4 text-emerald-300" aria-hidden />,
};

/** "Ways to pay less" (spec-113 §5.4): the engine-valued opportunities, best first. */
export const WaysToPayLess: React.FC = () => {
  const money = useCurrencyFormatter();
  const inr = (value: string | number) => money(toNumber(value), 'INR');
  const query = useQuery({
    queryKey: queryKeys.investing.tax.opportunities(),
    queryFn: () => investingService.getTaxOpportunities(),
  });

  return (
    <section
      className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4"
      data-testid="tax-ways-to-pay-less"
    >
      <h3 className="text-sm font-semibold text-slate-100">Ways to pay less</h3>
      {query.isLoading ? (
        <div className="mt-3">
          <SkeletonList rows={2} />
        </div>
      ) : query.isError ? (
        <p className="mt-2 text-sm text-rose-200">Could not load the suggestions. Try again.</p>
      ) : (
        <>
          {query.data && toNumber(query.data.total_saves_this_fy_inr) > 0 ? (
            <p className="mt-1 text-xs text-slate-400" data-testid="tax-total-saves">
              Together these could save about {inr(query.data.total_saves_this_fy_inr)} this year.
            </p>
          ) : null}
          {(query.data?.warnings ?? []).map((warning) => (
            <p key={warning} className="mt-2 text-xs text-amber-300">
              {warning}
            </p>
          ))}
          {(query.data?.opportunities ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-slate-400" data-testid="tax-no-opportunities">
              Nothing to do right now. Suggestions appear here when selling, waiting or using your
              tax-free allowance would lower this year&apos;s tax.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {query.data?.opportunities.map((item: TaxOpportunity, index: number) => (
                <li
                  key={`${item.kind}-${item.symbol}-${index}`}
                  className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3"
                  data-testid={`tax-opportunity-${item.kind}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                      {KIND_ICON[item.kind]}
                      {item.headline}
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        item.timing === 'later_years'
                          ? 'bg-slate-700/60 text-slate-200'
                          : 'bg-emerald-950/50 text-emerald-200'
                      }`}
                    >
                      saves about {inr(item.saves_inr)}
                      {item.timing === 'later_years' ? ' in later years' : ' this year'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{item.detail}</p>
                  {item.lots.length > 0 ? (
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead>
                          <tr className="border-b border-slate-700/50 text-slate-400">
                            <th className="py-1 pr-3 font-medium">Holding</th>
                            <th className="py-1 pr-3 font-medium">Units</th>
                            <th className="py-1 font-medium">Gain</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.lots.map((lot, lotIndex) => (
                            <tr
                              key={`${lot.symbol}-${lotIndex}`}
                              className="border-b border-slate-800/60"
                            >
                              <td className="py-1 pr-3 text-slate-100">{lot.symbol}</td>
                              <td className="py-1 pr-3">{toNumber(lot.quantity)}</td>
                              <td className="py-1">{inr(lot.gain_inr)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {item.act_by ? (
                    <p className="mt-2 text-[11px] text-slate-500">
                      {item.kind === 'wait_for_long_term' ? 'Long-term from' : 'Act by'}{' '}
                      {formatDate(item.act_by)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
};
