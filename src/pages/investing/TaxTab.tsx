import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Calculator, Coins, FileText, Info, Scale, Settings } from 'lucide-react';
import { investingService } from '../../services/investing';
import type { TaxBucket, TaxPosition, TaxRegime, TaxSummary } from '../../types/investing';
import { toNumber } from '../../utils/numberFormat';
import { useCurrencyFormatter } from '../../hooks/useDisplayProfile';
import { queryKeys } from '../../lib/queryKeys';
import { TaxInfoTip } from '../../components/investing/TaxInfoTip';
import { DropdownSelect } from '../../components/DropdownSelect';
import { SkeletonList } from '../../components/ui/FeedbackStates';

/** Indian financial-year labels, most recent first. */
const FY_OPTIONS = (() => {
  const now = new Date();
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: 6 }, (_, i) => {
    const y = startYear - i;
    return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
  });
})();

const REGIME_LABELS: Record<string, string> = {
  foreign: 'Foreign / US listed (no STT)',
  indian: 'Indian listed (STT paid)',
};

const CLASSIFIED_BY_LABELS: Record<string, string> = {
  explicit_regime: 'Workspace override',
  instrument_override: 'Holding override',
  security_master: 'Security master',
  account_market_scope: 'Account default',
  currency_fallback: 'Currency fallback',
};

const regimeShort = (regime: string) =>
  regime === 'indian' ? 'Indian' : regime === 'foreign' ? 'Foreign' : regime;

const bucketLabel = (key: string) => {
  const [regime, term] = key.split(':');
  return `${regimeShort(regime ?? '')} ${term === 'long_term' ? 'long-term' : 'short-term'}`;
};

export const TaxTab: React.FC = () => {
  const navigate = useNavigate();
  // The FY selector is a free picker: any FY can be typed, and an FY with
  // no recorded sells returns an explanatory empty state rather than a
  // disabled control.
  const [fy, setFy] = useState<string>(FY_OPTIONS[0] ?? '2026-27');

  const summaryQuery = useQuery({
    queryKey: queryKeys.investing.tax.summary(fy),
    queryFn: () => investingService.getTaxSummary(fy),
  });
  const regimesQuery = useQuery({
    queryKey: queryKeys.investing.tax.regimes(),
    queryFn: () => investingService.getTaxRegimes(),
  });

  const summary: TaxSummary | undefined = summaryQuery.data;
  const formatter = useCurrencyFormatter();

  const buckets = useMemo(
    () => Object.entries(summary?.buckets ?? {}),
    [summary?.buckets],
  );

  const positions = summary?.positions ?? [];
  const fxRates = summary?.fx_rates ?? [];

  const regimeByKey = useMemo(() => {
    const map: Record<string, TaxRegime> = {};
    (regimesQuery.data ?? []).forEach((r) => {
      map[r.key] = r;
    });
    return map;
  }, [regimesQuery.data]);

  if (summaryQuery.isLoading) {
    return <SkeletonList rows={4} />;
  }

  if (summaryQuery.isError) {
    return (
      <div className="rounded-xl border border-rose-700/50 bg-rose-950/30 p-4 text-sm text-rose-200">
        Failed to load the tax estimate. Please try again.
      </div>
    );
  }

  // The reconciliation guard refuses to produce a number when the FIFO
  // replay does not reproduce the broker's recorded per-trade figures.
  if (summary?.status === 'reconciliation_failed') {
    return (
      <div
        className="rounded-xl border border-amber-700/50 bg-amber-950/30 p-4"
        data-testid="investing-tax-reconciliation-failed"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          Tax estimate unavailable
        </div>
        <p className="mt-2 text-sm text-amber-100/90">{summary.message}</p>
        {summary.reconciliation_failures.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs text-amber-100/80">
              <thead>
                <tr className="border-b border-amber-800/40">
                  <th className="py-1 pr-3 font-medium">Symbol</th>
                  <th className="py-1 pr-3 font-medium">Recorded gain</th>
                  <th className="py-1 pr-3 font-medium">Computed gain</th>
                  <th className="py-1 font-medium">Order</th>
                </tr>
              </thead>
              <tbody>
                {summary.reconciliation_failures.map((f, i) => (
                  <tr key={`${f.public_id}-${i}`} className="border-b border-amber-800/20">
                    <td className="py-1 pr-3 font-medium text-amber-100">{f.symbol}</td>
                    <td className="py-1 pr-3">{f.expected_gain}</td>
                    <td className="py-1 pr-3">{f.computed_gain}</td>
                    <td className="py-1 font-mono text-[10px]">{f.public_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    );
  }

  // A foreign sale with no Rule 115 rate cannot be converted. The engine
  // reports the gap rather than dropping the gain, so the UI must not show
  // a number either — the tax would be understated.
  if (summary?.status === 'missing_fx_rate') {
    return (
      <div
        className="rounded-xl border border-amber-700/50 bg-amber-950/30 p-4"
        data-testid="investing-tax-missing-fx"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          Tax estimate unavailable
        </div>
        <p className="mt-2 text-sm text-amber-100/90">{summary.message}</p>
        {summary.missing_fx_rates.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs text-amber-100/80">
            {summary.missing_fx_rates.map((rate) => (
              <li key={`${rate.month}-${rate.currency}`}>
                <span className="font-medium">{rate.month}</span> — {rate.currency} to INR
                <span className="ml-1.5 text-amber-200/70">
                  (specified date: last day of the preceding month)
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-3 text-xs text-amber-100/70">
          Add the Rule 115 rate for those months in your tax profile, or seed the
          app&apos;s FX rate for the month, and the estimate will appear here.
        </p>
      </div>
    );
  }

  const hasSells = buckets.length > 0;

  return (
    <div className="space-y-6" data-testid="investing-tax-tab">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-100">
                Capital gains tax estimate
              </h2>
              <TaxInfoTip
                label="About this estimate"
                content={
                  <>
                    <strong>An estimate, not a filing-ready liability.</strong> It taxes
                    your capital gains at your marginal rate using the FIFO cost basis
                    already recorded on each lot. It does not compute your total income,
                    other heads, or your actual tax payable. Verify with your CA.
                  </>
                }
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Financial year {summary?.fy_label ?? fy} ·{' '}
              {summary?.currency ?? 'INR'}
            </p>
          </div>
          <div className="w-44">
            <label className="mb-1 block text-xs text-slate-400" htmlFor="tax-fy-select">
              Financial year
            </label>
            <DropdownSelect
              testId="tax-fy-select"
              options={FY_OPTIONS.map((label) => ({ value: label, label }))}
              value={fy}
              onChange={setFy}
              placeholder="Select FY"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate('/settings/tax')}
            className="flex items-center gap-1.5 text-xs font-medium text-cyan-300 hover:text-cyan-200"
          >
            <Settings className="h-3.5 w-3.5" />
            Configure tax profile
          </button>
        </div>

        {hasSells ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
              <div className="text-xs text-slate-400">Estimated tax</div>
              <div
                className="mt-1 text-xl font-semibold text-emerald-300"
                data-testid="tax-total-tax"
              >
                {formatter(toNumber(summary?.total_tax_inr ?? 0), 'INR')}
              </div>
            </div>
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
              <div className="text-xs text-slate-400">Total capital gain</div>
              <div
                className="mt-1 text-xl font-semibold text-slate-100"
                data-testid="tax-total-gain"
              >
                {formatter(toNumber(summary?.total_gain_inr ?? 0), 'INR')}
              </div>
            </div>
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                Effective rate
                <TaxInfoTip
                  label="Effective rate"
                  content="Total estimated tax divided by the total capital gain. It is not the rate you pay on your income — the gain is taxed at your marginal rate."
                />
              </div>
              <div
                className="mt-1 text-xl font-semibold text-slate-100"
                data-testid="tax-effective-rate"
              >
                {toNumber(summary?.effective_rate_pct ?? 0).toFixed(2)}%
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {!hasSells ? (
        <div
          className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-6 text-center"
          data-testid="tax-empty-state"
        >
          <Scale className="mx-auto h-8 w-8 text-slate-600" />
          <p className="mt-3 text-sm font-medium text-slate-200">
            No capital gains recorded for {summary?.fy_label ?? fy}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Tax is computed from recorded <em>sell</em> orders. Add the sells for this
            financial year and the estimate will appear here.
          </p>
        </div>
      ) : null}

      {/* ── Buckets ────────────────────────────────────────────────────── */}
      {hasSells ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-200">Gains by regime</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {buckets.map(([key, bucket]: [string, TaxBucket]) => {
              const regime = regimeByKey[bucket.regime];
              const isIndian = bucket.regime === 'indian';
              return (
                <div
                  key={key}
                  className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4"
                  data-testid={`tax-bucket-${key}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-100">
                        {bucketLabel(key)}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {REGIME_LABELS[bucket.regime] ?? bucket.regime} · Sec{' '}
                        {bucket.section}
                      </div>
                    </div>
                    <TaxInfoTip
                      label="About this regime"
                      content={
                        regime ? (
                          <>
                            <strong>{regime.label}</strong>
                            <br />
                            {regime.description}
                          </>
                        ) : (
                          'Long-term and short-term gains are taxed under different sections.'
                        )
                      }
                    />
                  </div>

                  <dl className="mt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-slate-400">Gain (INR)</dt>
                      <dd className="font-medium text-slate-100">
                        {formatter(toNumber(bucket.gain_inr), 'INR')}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-400">Rate applied</dt>
                      <dd className="font-medium text-slate-100">
                        {toNumber(bucket.rate_pct) * 100}% + cess
                      </dd>
                    </div>
                    {isIndian && toNumber(bucket.exemption_applied) > 0 ? (
                      <div className="flex justify-between">
                        <dt className="text-slate-400">₹1.25L exemption used</dt>
                        <dd className="font-medium text-slate-100">
                          {formatter(toNumber(bucket.exemption_applied), 'INR')}
                        </dd>
                      </div>
                    ) : null}
                    {!isIndian && bucket.regime === 'foreign' ? (
                      <div className="flex justify-between">
                        <dt className="flex items-center gap-1 text-slate-400">
                          Exemption
                          <TaxInfoTip
                            label="No exemption"
                            content="The ₹1.25 lakh long-term exemption applies only to Indian listed securities with STT paid. Foreign shares are taxable from the first rupee."
                          />
                        </dt>
                        <dd className="font-medium text-slate-400">None</dd>
                      </div>
                    ) : null}
                    <div className="flex justify-between border-t border-slate-700/50 pt-1.5">
                      <dt className="text-slate-200">Tax</dt>
                      <dd className="font-semibold text-emerald-300">
                        {formatter(toNumber(bucket.tax), 'INR')}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-xs text-slate-500">
                    {bucket.sell_count} {bucket.sell_count === 1 ? 'sell' : 'sells'} ·{' '}
                    {bucket.lot_count} {bucket.lot_count === 1 ? 'lot' : 'lots'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ── Slab ───────────────────────────────────────────────────────── */}
      {summary?.slab ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-100">How the rate was chosen</h3>
            <TaxInfoTip
              label="About the marginal rate"
              content={
                <>
                  A slab is a <strong>marginal</strong> rate: short-term gains are added
                  to your other income, and the combined total sets the rate. That is
                  why the rate depends on your other income rather than on the gain
                  alone.
                </>
              }
            />
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            <div className="flex justify-between">
              <dt className="text-slate-400">Marginal rate</dt>
              <dd className="font-medium text-slate-100">
                {toNumber(summary.slab.rate_pct) * 100}%
                <span className="ml-1.5 text-xs text-slate-500">
                  ({summary.slab.source === 'override' ? 'entered' : 'derived'})
                </span>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Tax regime</dt>
              <dd className="font-medium text-slate-100">
                {summary.slab.tax_regime === 'new' ? 'New (115BAC)' : 'Old'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Surcharge</dt>
              <dd className="font-medium text-slate-100">
                {toNumber(summary.slab.surcharge_pct) * 100}%
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Total income considered</dt>
              <dd className="font-medium text-slate-100">
                {formatter(toNumber(summary.slab.total_income_considered), 'INR')}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      {/* ── FX ─────────────────────────────────────────────────────────── */}
      {fxRates.length > 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-100">
              Exchange rates used (Rule 115)
            </h3>
            <TaxInfoTip
              label="About the exchange rate"
              content={
                <>
                  Capital gains convert to INR at the <strong>SBI telegraphic transfer
                  buying rate</strong> on the last day of the month before the month of
                  transfer. An <em>estimated</em> rate is the app's stored market rate —
                  check it against SBI's published card before filing.
                </>
              }
            />
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="tax-fx-table">
              <thead>
                <tr className="border-b border-slate-700/50 text-xs text-slate-400">
                  <th className="py-1.5 pr-4 font-medium">Sale month</th>
                  <th className="py-1.5 pr-4 font-medium">Specified date</th>
                  <th className="py-1.5 pr-4 font-medium">Rate</th>
                  <th className="py-1.5 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {fxRates.map((rate) => (
                  <tr key={rate.month} className="border-b border-slate-800/60">
                    <td className="py-1.5 pr-4 text-slate-200">{rate.month}</td>
                    <td className="py-1.5 pr-4 text-slate-300">{rate.specified_date}</td>
                    <td className="py-1.5 pr-4 font-medium text-slate-100">
                      {rate.currency} {rate.rate}
                    </td>
                    <td className="py-1.5">
                      {rate.is_estimated ? (
                        <span
                          className="inline-flex items-center gap-1 rounded border border-amber-700/50 bg-amber-950/40 px-1.5 py-0.5 text-xs text-amber-200"
                          data-testid={`tax-fx-estimated-${rate.month}`}
                        >
                          <Info className="h-3 w-3" />
                          estimated
                        </span>
                      ) : (
                        <span className="rounded border border-slate-600/60 px-1.5 py-0.5 text-xs text-slate-300">
                          manual
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* ── Per-transaction detail ─────────────────────────────────────── */}
      {positions.length > 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">
            Lot-level detail
            <span className="ml-2 text-xs font-normal text-slate-400">
              {positions.length} {positions.length === 1 ? 'lot' : 'lots'} sold in{' '}
              {summary?.fy_label ?? fy}
            </span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="tax-positions-table">
              <thead>
                <tr className="border-b border-slate-700/50 text-xs text-slate-400">
                  <th className="py-1.5 pr-3 font-medium">Symbol</th>
                  <th className="py-1.5 pr-3 font-medium">Account</th>
                  <th className="py-1.5 pr-3 font-medium">Acquired</th>
                  <th className="py-1.5 pr-3 font-medium">Long-term from</th>
                  <th className="py-1.5 pr-3 font-medium">Held</th>
                  <th className="py-1.5 pr-3 font-medium">Bucket</th>
                  <th className="py-1.5 pr-3 font-medium">Gain</th>
                  <th className="py-1.5 pr-3 font-medium">Gain (INR)</th>
                  <th className="py-1.5 font-medium">Classified by</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((lot: TaxPosition, i: number) => (
                  <tr key={`${lot.symbol}-${i}`} className="border-b border-slate-800/60">
                    <td className="py-1.5 pr-3 font-medium text-slate-100">
                      {lot.symbol}
                    </td>
                    <td className="py-1.5 pr-3 text-slate-300">{lot.account_name}</td>
                    <td className="py-1.5 pr-3 text-slate-300">
                      {lot.acquired_at.slice(0, 10)}
                    </td>
                    <td className="py-1.5 pr-3 text-slate-400">
                      {lot.long_term_mark_date.slice(0, 10)}
                    </td>
                    <td className="py-1.5 pr-3 text-slate-300">{lot.holding_months} mo</td>
                    <td className="py-1.5 pr-3">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          lot.is_long_term
                            ? 'bg-emerald-950/50 text-emerald-200'
                            : 'bg-amber-950/50 text-amber-200'
                        }`}
                      >
                        {lot.is_long_term ? 'Long-term' : 'Short-term'}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-slate-100">
                      {lot.currency} {lot.gain_native}
                    </td>
                    <td className="py-1.5 pr-3 font-medium text-slate-100">
                      {formatter(toNumber(lot.gain_inr), 'INR')}
                    </td>
                    <td className="py-1.5">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                        {CLASSIFIED_BY_LABELS[lot.classified_by] ?? lot.classified_by}
                        <TaxInfoTip
                          label="How this was classified"
                          content={lot.classification_detail}
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* ── Assumptions ────────────────────────────────────────────────── */}
      {summary && summary.assumptions.length > 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-200">Assumptions</h3>
          <ul className="list-inside list-disc space-y-1 text-xs text-slate-400">
            {summary.assumptions.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary && summary.disclaimers.length > 0 ? (
        <div
          className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-4"
          data-testid="tax-disclaimers"
        >
          <h3 className="mb-2 text-sm font-semibold text-amber-200">Please read</h3>
          <ul className="list-inside list-disc space-y-1 text-xs text-amber-100/80">
            {summary.disclaimers.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};
