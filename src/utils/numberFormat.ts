export const toNumber = (value: number | string | null | undefined): number => {
  if (value == null) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Holding quantities are stored with up to 8 decimal places (fractional shares,
 * crypto), but whole-share counts shouldn't render as "10.00000000". Round to
 * maxDecimals then strip trailing zeros so desktop and mobile always agree.
 */
export const formatQuantity = (value: number | string | null | undefined, maxDecimals = 8): string => {
  const str = toNumber(value).toFixed(maxDecimals);
  return str.includes('.') ? str.replace(/0+$/, '').replace(/\.$/, '') : str;
};

/**
 * Default display locale/decimal-places when the caller doesn't have a
 * finance-settings-derived value yet (e.g. unauthenticated, or before the
 * settings query resolves). Deliberately fixed rather than the browser's
 * implicit locale (`undefined`) -- spec-075: formatting must be
 * deterministic and testable, not dependent on where the browser is set.
 */
export const DEFAULT_DISPLAY_LOCALE = 'en-US';
export const DEFAULT_DECIMAL_PLACES = 2;

// Intl.NumberFormat/toFixed both throw a RangeError outside 0-100 (spec says
// 0-20 in practice) -- clamp defensively so a bad value from the API or a
// caller degrades to the default instead of crashing the render.
const clampDecimalPlaces = (decimalPlaces: number): number => {
  const parsed = Number(decimalPlaces);
  return Number.isFinite(parsed) ? Math.min(20, Math.max(0, Math.floor(parsed))) : DEFAULT_DECIMAL_PLACES;
};

export const formatCurrency = (
  amount: number | string | null | undefined,
  currency: string | null | undefined = 'USD',
  currencyDisplay: 'symbol' | 'code' = 'symbol',
  locale: string = DEFAULT_DISPLAY_LOCALE,
  decimalPlaces: number = DEFAULT_DECIMAL_PLACES,
): string => {
  const normalizedCurrency = (currency || 'USD').trim().toUpperCase();
  const numericAmount = toNumber(amount);
  const parsedDecimals = clampDecimalPlaces(decimalPlaces);

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: normalizedCurrency,
      currencyDisplay,
      minimumFractionDigits: parsedDecimals,
      maximumFractionDigits: parsedDecimals,
    }).format(numericAmount);
  } catch {
    return `${normalizedCurrency} ${numericAmount.toFixed(parsedDecimals)}`;
  }
};

/**
 * Plain (non-currency) number formatting that honors the same display
 * profile as formatCurrency -- for quantities/percentages shown alongside
 * money that should still use the user's grouping (e.g. Indian digit
 * grouping) even though they're not a currency amount.
 */
export const formatNumber = (
  value: number | string | null | undefined,
  locale: string = DEFAULT_DISPLAY_LOCALE,
  decimalPlaces: number = DEFAULT_DECIMAL_PLACES,
): string => {
  const numericValue = toNumber(value);
  const parsedDecimals = clampDecimalPlaces(decimalPlaces);
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: parsedDecimals,
      maximumFractionDigits: parsedDecimals,
    }).format(numericValue);
  } catch {
    return numericValue.toFixed(parsedDecimals);
  }
};
