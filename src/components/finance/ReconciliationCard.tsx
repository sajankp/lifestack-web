import React from 'react';
import type { ReconciliationSummary } from '../../types/finance';
import { formatCurrency } from '../../utils/numberFormat';
import { formatDate } from '../../utils/dateFormat';

interface ReconciliationCardProps {
  reconciliation: ReconciliationSummary;
  currencyDisplayPreference: 'symbol' | 'code';
  /** Distinguishes the two mount points' e2e hooks (investing- vs spending-ledger-). */
  testIdPrefix?: string;
}

// A discrepancy under this many currency units is rounding noise, not a real gap.
const DISCREPANCY_NEGLIGIBLE = 1;
// Beyond 5% of the projected balance (or 100 units on a near-zero balance) is a real discrepancy, not a minor gap.
const DISCREPANCY_TOLERANCE_RATIO = 0.05;
const DISCREPANCY_TOLERANCE_FLOOR = 100;

type ReconciliationStatus = 'balanced' | 'minor' | 'discrepancy' | 'no-snapshot';

const STATUS_META: Record<ReconciliationStatus, { label: string; badge: string; value: string }> = {
  balanced: { label: 'Balanced', badge: 'bg-emerald-500/15 text-emerald-400', value: 'text-emerald-400' },
  minor: { label: 'Minor gap', badge: 'bg-amber-500/15 text-amber-400', value: 'text-amber-400' },
  discrepancy: { label: 'Discrepancy', badge: 'bg-rose-500/15 text-rose-400', value: 'text-rose-400' },
  'no-snapshot': { label: 'No Snapshot', badge: 'bg-slate-700/50 text-slate-400', value: 'text-slate-400' },
};

/**
 * Compares a ledger's projected balance (derived from transactions/transfers/orders)
 * to the latest cash snapshot for that account. Shared by Spending's LedgerTab and
 * Investing's CashTab so both use the same tolerance rule and status vocabulary.
 */
export const ReconciliationCard: React.FC<ReconciliationCardProps> = ({
  reconciliation: r,
  currencyDisplayPreference,
  testIdPrefix = 'reconciliation',
}) => {
  const projected = Number(r.projected_balance);
  const snapshot = r.snapshot_balance !== null ? Number(r.snapshot_balance) : null;
  const disc = r.discrepancy !== null ? Number(r.discrepancy) : null;
  const discAbs = disc !== null ? Math.abs(disc) : 0;
  const threshold = projected !== 0 ? Math.abs(projected) * DISCREPANCY_TOLERANCE_RATIO : DISCREPANCY_TOLERANCE_FLOOR;

  const status: ReconciliationStatus =
    disc === null
      ? 'no-snapshot'
      : discAbs < DISCREPANCY_NEGLIGIBLE
      ? 'balanced'
      : discAbs >= threshold
      ? 'discrepancy'
      : 'minor';
  const meta = STATUS_META[status];

  const fmt = (v: number) => formatCurrency(v, r.currency_code, currencyDisplayPreference);

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Reconciliation{r.account_name ? ` — ${r.account_name}` : ''}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}>{meta.label}</span>
        </div>
        <span className="text-[11px] text-slate-500">
          {r.transaction_count} txns · {r.transfer_count} transfers · {r.order_count} trades
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Projected</p>
          <p
            data-testid={`${testIdPrefix}-projected`}
            className={`text-base font-bold ${projected >= 0 ? 'text-slate-200' : 'text-rose-400'}`}
          >
            {fmt(projected)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Snapshot</p>
          {snapshot !== null ? (
            <p className={`text-base font-bold ${snapshot >= 0 ? 'text-slate-200' : 'text-rose-400'}`}>{fmt(snapshot)}</p>
          ) : (
            <p className="text-base font-bold text-slate-500">—</p>
          )}
          {r.snapshot_as_of && (
            <p className="text-[10px] text-slate-500 mt-0.5">as of {formatDate(r.snapshot_as_of)}</p>
          )}
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Gap</p>
          <p data-testid={`${testIdPrefix}-discrepancy`} className={`text-base font-bold ${meta.value}`}>
            {disc !== null ? (disc > 0 ? '+' : '') + fmt(disc) : '—'}
          </p>
        </div>
      </div>
    </div>
  );
};
