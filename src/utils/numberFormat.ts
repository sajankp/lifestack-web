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

export const formatCurrency = (
  amount: number | string | null | undefined,
  currency: string | null | undefined = 'USD',
  currencyDisplay: 'symbol' | 'code' = 'symbol',
): string => {
  const normalizedCurrency = (currency || 'USD').trim().toUpperCase();
  const numericAmount = toNumber(amount);

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalizedCurrency,
      currencyDisplay,
      minimumFractionDigits: 2,
    }).format(numericAmount);
  } catch {
    return `${normalizedCurrency} ${numericAmount.toFixed(2)}`;
  }
};
