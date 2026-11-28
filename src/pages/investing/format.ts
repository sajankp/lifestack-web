import { toNumber, formatCurrency } from '../../utils/numberFormat';
import { formatDate, formatDateInputValue, formatDateTimeInputValue } from '../../utils/dateFormat';
import { valuationNote } from '../../utils/valuationWording';
import type { Holding, InstrumentType } from '../../types/investing';

export const formatDateInput = formatDateInputValue;
export const formatLocalDateInput = formatDateInputValue;
export const formatDateTimeLocalInput = formatDateTimeInputValue;

export const statusLabel = (status: string | undefined): string => {
  switch (status) {
    case 'empty':
      return 'No investing data yet.';
    case 'single_currency_native':
      return 'Native valuation available (single currency).';
    case 'multi_currency_unconverted':
      return 'Multiple currencies detected. Configure reporting currency + FX conversion.';
    case 'conversion_required':
      return 'Reporting currency set. Conversion data required for totals.';
    case 'converted_available':
      return 'Converted totals available in reporting currency.';
    default:
      return 'Unavailable.';
  }
};

export const instrumentTypeLabel = (type: InstrumentType | undefined): string => {
  switch (type) {
    case 'etf':
      return 'ETF';
    case 'mutual_fund':
      return 'Mutual Fund';
    default:
      return 'Stock';
  }
};

// book_value is server-computed and should always be present (added
// alongside FIFO cost-basis support). The client-side fallback only
// guards a possible deploy-ordering window where the frontend ships
// before the backend that populates it — remove once that's no
// longer a concern.
export const deriveBookValue = (
  h: Pick<Holding, 'quantity' | 'avg_cost' | 'book_value'>,
): number =>
  h.book_value != null ? toNumber(h.book_value) : toNumber(h.quantity) * toNumber(h.avg_cost);

export const formatPerformanceMetric = (
  amount: number | string,
  percentage: number | string | null,
  currency: string,
  preference: 'symbol' | 'code',
  locale?: string,
  decimalPlaces?: number,
) => {
  const numericAmount = toNumber(amount);
  const sign = numericAmount > 0 ? '+' : '';
  const percentageLabel =
    percentage == null
      ? ''
      : ` (${toNumber(percentage) > 0 ? '+' : ''}${toNumber(percentage).toFixed(2)}%)`;
  return `${sign}${formatCurrency(
    numericAmount,
    currency,
    preference,
    locale,
    decimalPlaces,
  )}${percentageLabel}`;
};

export { accountTypeOptions } from '../../utils/accountTypes';

export const instrumentTypeOptions = [
  { value: 'stock', label: 'Stock' },
  { value: 'etf', label: 'ETF' },
  { value: 'mutual_fund', label: 'Mutual Fund' },
] as const;

export type SortDir = 'asc' | 'desc';

const NEEDS_CONVERSION = new Set(['multi_currency_unconverted', 'conversion_required']);

/**
 * The single valuation line on Investments (spec-113 §2.2). Two statuses feed it, the summary's
 * currency-conversion state and the performance snapshot's price quality, and they are folded into
 * one ladder so the page can never show "Converted totals available" next to "estimated".
 *
 * Precedence: nothing to value -> a conversion step the user must take -> estimated prices ->
 * the as-of date.
 */
export const valuationLine = ({
  summaryStatus,
  performanceStatus,
  snapshotDate,
}: {
  summaryStatus: string | undefined;
  performanceStatus: string | undefined;
  snapshotDate: string | null | undefined;
}): string => {
  if (summaryStatus === 'empty' || (performanceStatus === 'empty' && !snapshotDate)) {
    return statusLabel('empty');
  }
  if (summaryStatus && NEEDS_CONVERSION.has(summaryStatus)) {
    return statusLabel(summaryStatus);
  }
  const estimate = valuationNote(performanceStatus, snapshotDate);
  if (estimate) return estimate;
  const date = formatDate(snapshotDate, { fallback: '' });
  return date ? `Valuation as of ${date}` : 'Valuation date unavailable';
};
