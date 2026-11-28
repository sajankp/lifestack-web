import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { TaxSummary } from '../../../types/investing';
import { toNumber } from '../../../utils/numberFormat';
import { useCurrencyFormatter } from '../../../hooks/useDisplayProfile';
import { TaxInfoTip } from '../TaxInfoTip';
import { bucketName, termName } from './labels';

interface YearSoFarProps {
  summary: TaxSummary;
}

/**
 * "This year so far" (spec-113 §5.4): each bucket on one line, gain -> after losses set off ->
 * after the exemption -> tax, then what the set-off did, in sentences.
 */
export const YearSoFar: React.FC<YearSoFarProps> = ({ summary }) => {
  const money = useCurrencyFormatter();
  const inr = (value: string | number) => money(toNumber(value), 'INR');
  const buckets = Object.entries(summary.buckets);
  const unabsorbed = summary.unabsorbed_loss;
  const unabsorbedNotes = [
    ['short_term', unabsorbed.short_term],
    ['long_term', unabsorbed.long_term],
  ].filter(([, amount]) => toNumber(amount ?? '0') > 0);
  const broughtForward = summary.carry_forward.used.filter((row) => toNumber(row.used_inr) > 0);

  return (
    <section
      className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4"
      data-testid="tax-year-so-far"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-100">This year so far</h3>
            <TaxInfoTip
              label="About this estimate"
              content={
                <>
                  <strong>An estimate, not a filing-ready liability.</strong> It taxes your capital
                  gains at your marginal rate using the FIFO cost basis recorded on each lot. It
                  does not compute your total income or your actual tax payable. Verify with your
                  CA.
                </>
              }
            />
          </div>
          <p className="mt-0.5 text-xs text-slate-400">Financial year {summary.fy_label}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
          <div className="text-xs text-slate-400">Estimated tax</div>
          <div className="mt-1 text-xl font-semibold text-emerald-300" data-testid="tax-total-tax">
            {inr(summary.total_tax_inr)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
          <div className="text-xs text-slate-400">Total capital gain</div>
          <div className="mt-1 text-xl font-semibold text-slate-100" data-testid="tax-total-gain">
            {inr(summary.total_gain_inr)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            Effective rate
            <TaxInfoTip
              label="Effective rate"
              content="Total estimated tax divided by the total capital gain. It is not the rate you pay on your income."
            />
          </div>
          <div
            className="mt-1 text-xl font-semibold text-slate-100"
            data-testid="tax-effective-rate"
          >
            {toNumber(summary.effective_rate_pct).toFixed(2)}%
          </div>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {buckets.map(([key, bucket]) => {
          const gain = toNumber(bucket.gain_inr);
          const absorbed =
            toNumber(bucket.set_off_inr) + toNumber(bucket.carry_forward_set_off_inr);
          const exemption = toNumber(bucket.exemption_applied);
          return (
            <li
              key={key}
              className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3"
              data-testid={`tax-bucket-${key}`}
            >
              <div className="text-sm font-medium text-slate-100">{bucketName(key)}</div>
              {gain < 0 ? (
                <p className="mt-1 text-sm text-slate-300">
                  Loss of {inr(Math.abs(gain))}, set off against the gains in the other lines. Tax{' '}
                  <span className="font-semibold text-emerald-300">{inr(0)}</span>.
                </p>
              ) : (
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-300">
                  <span>
                    Gains <span className="font-medium text-slate-100">{inr(gain)}</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                  <span>
                    after losses{' '}
                    <span className="font-medium text-slate-100">{inr(gain - absorbed)}</span>
                  </span>
                  {bucket.regime === 'indian' && key.endsWith('long_term') ? (
                    <>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                      <span>
                        after the ₹1.25L exemption{' '}
                        <span className="font-medium text-slate-100">
                          {inr(gain - absorbed - exemption)}
                        </span>
                      </span>
                    </>
                  ) : null}
                  <ArrowRight className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                  <span>
                    tax <span className="font-semibold text-emerald-300">{inr(bucket.tax)}</span>
                  </span>
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {summary.set_off_steps.length > 0 ||
      unabsorbedNotes.length > 0 ||
      broughtForward.length > 0 ? (
        <ul
          className="mt-4 list-inside list-disc space-y-1 text-xs text-slate-400"
          data-testid="tax-set-off-notes"
        >
          {summary.set_off_steps.map((step, index) => (
            <li key={`${step.loss_from}-${step.applied_to}-${index}`}>
              {inr(step.amount_inr)} of {bucketName(step.loss_from)} loss set off against{' '}
              {bucketName(step.applied_to)} gains (taxed at {toNumber(step.rate_pct) * 100}%).
            </li>
          ))}
          {unabsorbedNotes.map(([term, amount]) => (
            <li key={term}>
              {inr(amount ?? '0')} of {termName(term ?? '')} loss has no gain to absorb it this
              year.
            </li>
          ))}
          {broughtForward.map((row, index) => (
            <li key={`${row.arising_fy}-${row.term}-${index}`}>
              {inr(row.used_inr)} of the {inr(row.amount_inr)} {termName(row.term)} loss brought
              forward from {row.arising_fy} was used.
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
};
