import { format } from 'date-fns';

/**
 * Single source of truth for date display across the app, e.g. "9-Jun-2027".
 * Centralizing this makes a future user-configurable date format a one-place change.
 */
export const DATE_FORMAT = 'd-MMM-yyyy';
export const MONTH_YEAR_FORMAT = 'MMM yyyy';
export const MONTH_YEAR_FORMAT_LONG = 'MMMM yyyy';

const toDate = (value: Date | string | number): Date =>
  value instanceof Date ? value : new Date(value);

/**
 * API dates/timestamps are UTC instants; rendering them with the local time zone
 * can shift the displayed day. Re-anchoring to the UTC calendar fields before
 * formatting keeps the displayed date stable regardless of the viewer's time zone.
 */
const toUtcCalendarDate = (date: Date): Date =>
  new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
  );

export interface FormatDateOptions {
  /** Defaults to true: treat the value's calendar date as UTC (matches API data). */
  utc?: boolean;
  fallback?: string;
}

export const formatDate = (
  value: Date | string | number | null | undefined,
  options?: FormatDateOptions,
): string => {
  const fallback = options?.fallback ?? '-';
  if (value == null || value === '') return fallback;
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return fallback;
  const target = options?.utc === false ? date : toUtcCalendarDate(date);
  return format(target, DATE_FORMAT);
};

export const formatMonthYear = (
  value: Date | string | number | null | undefined,
  options?: FormatDateOptions & { long?: boolean },
): string => {
  const fallback = options?.fallback ?? '-';
  if (value == null || value === '') return fallback;
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return fallback;
  const target = options?.utc === false ? date : toUtcCalendarDate(date);
  return format(target, options?.long ? MONTH_YEAR_FORMAT_LONG : MONTH_YEAR_FORMAT);
};

export const formatDateTime = (
  value: Date | string | number | null | undefined,
  options?: FormatDateOptions,
): string => {
  const fallback = options?.fallback ?? '-';
  if (value == null || value === '') return fallback;
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return fallback;
  const target = options?.utc === false ? date : toUtcCalendarDate(date);
  return format(target, `${DATE_FORMAT} HH:mm`);
};
