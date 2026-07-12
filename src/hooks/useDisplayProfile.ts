import { useQuery } from '@tanstack/react-query';
import { financeService } from '../services/finance';
import { queryKeys } from '../lib/queryKeys';
import { DEFAULT_DECIMAL_PLACES, DEFAULT_DISPLAY_LOCALE } from '../utils/numberFormat';

export interface DisplayProfile {
  locale: string;
  decimalPlaces: number;
  currencyDisplay: 'symbol' | 'code';
}

/**
 * The effective currency-display profile (locale, decimal places, symbol
 * vs. code) for the current user, workspace-default with a per-user
 * override (spec-075). Shares its query key with every other reader of
 * GET /finance/settings/user, so React Query dedupes the request rather
 * than each page re-fetching independently.
 */
export const useDisplayProfile = (): DisplayProfile => {
  const { data } = useQuery({
    queryKey: queryKeys.finance.settings('user'),
    queryFn: () => financeService.getUserSettings(),
  });

  return {
    locale: data?.effective_locale ?? DEFAULT_DISPLAY_LOCALE,
    decimalPlaces: data?.effective_decimal_places ?? DEFAULT_DECIMAL_PLACES,
    currencyDisplay: data?.effective_currency_display_preference ?? 'symbol',
  };
};
