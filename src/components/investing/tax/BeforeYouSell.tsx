import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { investingService } from '../../../services/investing';
import { queryKeys } from '../../../lib/queryKeys';
import type { SaleSimulation } from '../../../types/taxPlanning';
import { toNumber } from '../../../utils/numberFormat';
import { formatDate } from '../../../utils/dateFormat';
import { useCurrencyFormatter } from '../../../hooks/useDisplayProfile';

interface Request {
  holdingId: string;
  quantity: string;
}

/** The date every short-term lot in this sale is long-term: the latest of their dates. */
const laterSaleDate = (today: SaleSimulation | undefined): string | null => {
  if (!today) return null;
  const dates = today.lots
    .filter((lot) => !lot.is_long_term && lot.long_term_from)
    .map((lot) => lot.long_term_from as string)
    .sort();
  return dates.length > 0 ? dates[dates.length - 1] ?? null : null;
};

const STATUS_NOTES: Record<string, string> = {
  insufficient_quantity: 'You asked for more units than can be sold. This shows what can be.',
  missing_fx_rate: 'The exchange rate for this sale is missing, so no tax figure can be shown.',
};

/** "Before you sell" (spec-113 §5.4): pick a holding and units, see tax today vs the long-term date. */
export const BeforeYouSell: React.FC = () => {
  const money = useCurrencyFormatter();
  const inr = (value: string | number) => money(toNumber(value), 'INR');
  const [holdingId, setHoldingId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [request, setRequest] = useState<Request | null>(null);

  const holdings = useQuery({
    queryKey: queryKeys.investing.holdings(),
    queryFn: () => investingService.getHoldings(200, 0),
  });
  const options = useMemo(
    () => (holdings.data?.items ?? []).filter((h) => toNumber(h.quantity) > 0 && h.public_id),
    [holdings.data],
  );

  const today = useQuery({
    queryKey: queryKeys.investing.tax.simulation({ ...request, when: 'today' }),
    queryFn: () =>
      investingService.simulateSale({
        holding_id: request?.holdingId ?? '',
        quantity: request?.quantity ?? '0',
      }),
    enabled: request !== null,
  });
  const laterDate = laterSaleDate(today.data);
  const later = useQuery({
    queryKey: queryKeys.investing.tax.simulation({ ...request, when: laterDate }),
    queryFn: () =>
      investingService.simulateSale({
        holding_id: request?.holdingId ?? '',
        quantity: request?.quantity ?? '0',
        sale_date: laterDate ?? undefined,
      }),
    enabled: request !== null && laterDate !== null,
  });

  const canCheck = holdingId !== '' && toNumber(quantity) > 0;
  const result = today.data;
  const taxToday = result?.tax ? toNumber(result.tax.incremental_tax_inr) : null;
  const taxLater = later.data?.tax ? toNumber(later.data.tax.incremental_tax_inr) : null;

  return (
    <section
      className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4"
      data-testid="tax-before-you-sell"
    >
      <h3 className="text-sm font-semibold text-slate-100">Before you sell</h3>
      <p className="mt-1 text-xs text-slate-400">
        Nothing is sold. Pick a holding and how many units to see the tax today and on the day it
        turns long-term.
      </p>
      <form
        className="mt-3 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (canCheck) setRequest({ holdingId, quantity });
        }}
      >
        <label className="text-xs text-slate-400">
          Holding
          <select
            data-testid="tax-sell-holding"
            value={holdingId}
            onChange={(event) => setHoldingId(event.target.value)}
            className="mt-1 block h-10 w-56 rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100"
          >
            <option value="">Choose…</option>
            {options.map((h) => (
              <option key={h.public_id} value={h.public_id}>
                {h.symbol}
                {h.account_name ? ` · ${h.account_name}` : ''} ({toNumber(h.quantity)})
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          Units
          <input
            data-testid="tax-sell-quantity"
            inputMode="decimal"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="mt-1 block h-10 w-28 rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100"
          />
        </label>
        <button
          type="submit"
          disabled={!canCheck}
          data-testid="tax-sell-check"
          className="h-10 rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          Check the tax
        </button>
      </form>

      {today.isError ? (
        <p className="mt-3 text-sm text-rose-200">Could not run that check. Try again.</p>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-3" data-testid="tax-sell-result">
          {STATUS_NOTES[result.status] ? (
            <p className="text-xs text-amber-300">{STATUS_NOTES[result.status]}</p>
          ) : null}
          {result.message ? <p className="text-xs text-amber-300">{result.message}</p> : null}
          {toNumber(result.sale.quantity_locked) > 0 ? (
            <p className="text-xs text-amber-300" data-testid="tax-sell-locked">
              {toNumber(result.sale.quantity_locked)} units locked until{' '}
              {formatDate(result.sale.locked_until)} are left out.
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
              <div className="text-xs text-slate-400">Selling today</div>
              <div
                className="mt-1 text-lg font-semibold text-slate-100"
                data-testid="tax-sell-today"
              >
                {taxToday === null ? '—' : inr(taxToday)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
              <div className="text-xs text-slate-400">
                {laterDate ? `Selling on ${formatDate(laterDate)}` : 'Later'}
              </div>
              <div
                className="mt-1 text-lg font-semibold text-slate-100"
                data-testid="tax-sell-later"
              >
                {laterDate === null ? 'Already long-term' : taxLater === null ? '—' : inr(taxLater)}
              </div>
              {taxToday !== null && taxLater !== null && taxToday > taxLater ? (
                <div className="mt-0.5 text-xs text-emerald-300" data-testid="tax-sell-saving">
                  Waiting saves about {inr(taxToday - taxLater)}
                </div>
              ) : null}
            </div>
          </div>

          {result.lots.length > 0 ? (
            <div className="overflow-x-auto">
              <table
                className="w-full text-left text-xs text-slate-300"
                data-testid="tax-sell-lots"
              >
                <thead>
                  <tr className="border-b border-slate-700/50 text-slate-400">
                    <th className="py-1 pr-3 font-medium">Bought</th>
                    <th className="py-1 pr-3 font-medium">Units</th>
                    <th className="py-1 pr-3 font-medium">Gain</th>
                    <th className="py-1 pr-3 font-medium">Today it is</th>
                    <th className="py-1 font-medium">Long-term from</th>
                  </tr>
                </thead>
                <tbody>
                  {result.lots.map((lot) => (
                    <tr key={lot.fifo_position} className="border-b border-slate-800/60">
                      <td className="py-1 pr-3">{formatDate(lot.acquired_date)}</td>
                      <td className="py-1 pr-3">{toNumber(lot.quantity)}</td>
                      <td className="py-1 pr-3">
                        {lot.gain_inr === null ? '—' : inr(lot.gain_inr)}
                      </td>
                      <td className="py-1 pr-3">{lot.is_long_term ? 'Long-term' : 'Short-term'}</td>
                      <td className="py-1">
                        {lot.is_long_term ? '—' : formatDate(lot.long_term_from)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
