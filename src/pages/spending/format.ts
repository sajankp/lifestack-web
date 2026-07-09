import type { RecurringFrequency } from '../../types/spending';
import { formatMonthYear, formatDateInputValue } from '../../utils/dateFormat';

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

export const localDateInputValue = () => formatDateInputValue(new Date());

export const formatDueDate = (dateStr: string) => {
  if (!dateStr) return { label: 'N/A', color: 'text-slate-400 bg-slate-800' };
  const datePart = dateStr.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length !== 3) return { label: 'N/A', color: 'text-slate-400 bg-slate-800' };
  const [year, month, day] = parts.map(Number);
  const due = new Date(year, month - 1, day);
  if (Number.isNaN(due.getTime())) return { label: 'N/A', color: 'text-slate-400 bg-slate-800' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, color: 'text-red-400 bg-red-500/10' };
  if (diffDays === 0) return { label: 'Due today', color: 'text-amber-400 bg-amber-500/10' };
  if (diffDays === 1) return { label: 'Due tomorrow', color: 'text-amber-400 bg-amber-500/10' };
  return { label: `Due in ${diffDays}d`, color: 'text-slate-400 bg-slate-800' };
};

export const getCurrentMonthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabelFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Short month name (e.g. "Jan") from a `YYYY-MM` value. Falls back to the
// raw input for anything that doesn't match, so callers can pass it through
// safely without a separate regex guard.
export const monthShortLabel = (monthValue: string) => {
  const [, m] = monthValue.split('-');
  return MONTH_SHORT_NAMES[Number(m) - 1] ?? monthValue;
};

export const formatMonthLabel = (monthValue: string) => {
  if (!/^\d{4}-\d{2}$/.test(monthValue)) return monthValue;
  const [yearStr, monthStr] = monthValue.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || month < 1 || month > 12) return monthValue;
  return monthLabelFormatter.format(new Date(Date.UTC(year, month - 1, 1)));
};

export const buildMonthOptions = (pastCount = 24, futureCount = 12) => {
  const options: Array<{ value: string; label: string }> = [];
  const now = new Date();
  for (let offset = futureCount; offset >= -pastCount; offset -= 1) {
    const monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    const value = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, '0')}`;
    options.push({ value, label: formatMonthLabel(value) });
  }
  return options;
};

export const monthStartToMonthValue = (monthStart: string) => monthStart.slice(0, 7);

// Range-containment check mirroring the API's non-overlap/coverage model
// (spec-064): a budget covers `monthValue` when its start is on/before it and
// its end (null = ongoing) is on/after it.
export const monthValueCoveredByRange = (
  monthValue: string,
  startMonth: string,
  endMonth: string | null
) => {
  const start = monthStartToMonthValue(startMonth);
  if (monthValue < start) return false;
  if (endMonth == null) return true;
  return monthValue <= monthStartToMonthValue(endMonth);
};

export const formatBudgetRangeLabel = (startMonth: string, endMonth: string | null) => {
  const startLabel = formatMonthLabel(monthStartToMonthValue(startMonth));
  return endMonth ? `${startLabel} – ${formatMonthLabel(monthStartToMonthValue(endMonth))}` : `${startLabel} – ongoing`;
};

export const monthValueToDateRange = (monthValue: string) => {
  if (!monthValue || !/^\d{4}-\d{2}$/.test(monthValue)) {
    return {
      fromDate: '',
      toDate: '',
      monthStart: '',
      label: 'Invalid Month',
      isValid: false,
    };
  }

  const [yearStr, monthStr] = monthValue.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return {
    fromDate: start.toISOString(),
    toDate: end.toISOString(),
    monthStart: `${monthValue}-01`,
    label: formatMonthYear(start, { long: true }),
    isValid: true,
  };
};
