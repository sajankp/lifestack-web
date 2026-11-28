import { formatDate } from './dateFormat';

/**
 * Plain-English note for a degraded portfolio valuation (spec-113 §2.2), or null when there is
 * nothing to say. The raw status word ("estimated", "cost_basis_fallback", ...) is never shown.
 *
 * Shared by the dashboard alert and the Investments valuation line so both say the same thing.
 */
export const valuationNote = (
  status: string | null | undefined,
  updatedOn?: string | null,
): string | null => {
  switch (status?.toLowerCase()) {
    case 'estimated': {
      const date = formatDate(updatedOn, { fallback: '' });
      return date ? `Some prices are estimates (updated ${date}).` : 'Some prices are estimates.';
    }
    case 'cost_basis_fallback':
      return 'Some holdings are shown at cost because no current price is available.';
    case 'multi_currency_unconverted':
    case 'conversion_required':
      return 'Some holdings are in other currencies and have not been converted yet.';
    default:
      return null;
  }
};
