import { toNumber, formatCurrency } from '../../utils/numberFormat';
import type { Holding, InstrumentType } from '../../types/investing';

export const formatDateInput = (d: Date): string => {
  const tzOffsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 10);
};

export const formatLocalDateInput = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const formatDateTimeLocalInput = (d: Date): string => {
  const tzOffsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
};

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
      return 'Valuation status unavailable.';
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
export const deriveBookValue = (h: Pick<Holding, 'quantity' | 'avg_cost' | 'book_value'>): number =>
  h.book_value != null ? toNumber(h.book_value) : toNumber(h.quantity) * toNumber(h.avg_cost);

export const formatPerformanceMetric = (
  amount: number | string,
  percentage: number | string | null,
  currency: string,
  preference: 'symbol' | 'code',
) => {
  const numericAmount = toNumber(amount);
  const sign = numericAmount > 0 ? '+' : '';
  const percentageLabel = percentage == null
    ? ''
    : ` (${toNumber(percentage) > 0 ? '+' : ''}${toNumber(percentage).toFixed(2)}%)`;
  return `${sign}${formatCurrency(numericAmount, currency, preference)}${percentageLabel}`;
};

export const accountTypeOptions = [
  { value: 'brokerage', label: 'Brokerage' },
  { value: 'bank', label: 'Bank' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'card', label: 'Card' },
  { value: 'gift_card', label: 'Gift Card' },
] as const;

export const instrumentTypeOptions = [
  { value: 'stock', label: 'Stock' },
  { value: 'etf', label: 'ETF' },
  { value: 'mutual_fund', label: 'Mutual Fund' },
] as const;

export type SortDir = 'asc' | 'desc';
