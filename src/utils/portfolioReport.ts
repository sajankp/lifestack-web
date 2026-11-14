import { TaxBucketSchema, type HarvestCandidate, type TaxBucket } from '../types/investing';
import { toNumber } from './numberFormat';

/**
 * Extracts a country-level split from a report's ``foundation_json`` payload.
 *
 * Backend ``foundation_json`` is free-form JSONB, so the frontend convention is
 * deliberately tolerant. Shapes tried, in order:
 *   1. ``foundation_json.countries`` — array of { country, weight|value|pct }
 *      (values may be JSON-encoded strings, mirroring the record<string,string>
 *      frontend type)
 *   2. ``foundation_json.country_weights`` — record of country -> weight
 *   3. ``foundation_json.country`` — record of country -> weight
 *
 * Returns entries sorted by weight (descending), zero/negative weights dropped.
 */
export interface CountryWeight {
  country: string;
  weight: number;
}

export const extractCountryWeights = (
  foundationJson?: Record<string, string> | null,
): CountryWeight[] => {
  if (!foundationJson) return [];

  const raw =
    foundationJson.countries ??
    (foundationJson as Record<string, unknown>).country_weights ??
    (foundationJson as Record<string, unknown>).country;

  let list: unknown[];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
    } catch {
      return [];
    }
  } else if (raw && typeof raw === 'object') {
    list = Object.entries(raw as Record<string, unknown>).map(([country, value]) => ({
      country,
      weight: value,
    }));
  } else {
    return [];
  }

  const weights: CountryWeight[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    const country = (obj.country ?? obj.name ?? obj.code ?? obj.label) as string | undefined;
    const weight = obj.weight ?? obj.value ?? obj.pct ?? obj.w ?? obj.percent;
    if (!country || weight == null) continue;
    const numericWeight = Number(weight);
    if (Number.isFinite(numericWeight) && numericWeight > 0) {
      weights.push({ country: String(country), weight: numericWeight });
    }
  }

  return weights.sort((a, b) => b.weight - a.weight);
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const firstDefined = (...values: unknown[]): unknown =>
  values.find((value) => value !== undefined && value !== null);

const asNumeric = (value: unknown): number | string =>
  typeof value === 'number' || typeof value === 'string' ? value : 0;

/** tax / gain as a percentage string; 0 when there is no positive gain to divide by. */
const effectiveRatePct = (gain: unknown, tax: unknown): string => {
  const gainValue = toNumber(asNumeric(gain));
  if (gainValue <= 0) return '0';
  return String(Number(((toNumber(asNumeric(tax)) / gainValue) * 100).toFixed(2)));
};

const parseBucket = (value: unknown): TaxBucket | null => {
  const parsed = TaxBucketSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

/**
 * Report `tax_buckets` -> card buckets.
 *
 * The cron stores the scalars "tax" dict as-is (`lt_gain_inr`, `lt_tax_inr`,
 * `st_gain_inr`, `st_tax_inr`, `total_tax_inr`, ...), not per-regime bucket
 * objects. That flat shape is what production rows hold (and reports are
 * append-only), so it is read here, alongside the per-bucket shape the
 * capital-gains engine produces.
 */
export const normalizeTaxBuckets = (raw: unknown): TaxBucket[] => {
  if (Array.isArray(raw)) {
    return raw.flatMap((entry) => parseBucket(entry) ?? []);
  }
  if (!isRecord(raw)) return [];

  const isFlat =
    'lt_gain_inr' in raw || 'st_gain_inr' in raw || 'lt_tax_inr' in raw || 'st_tax_inr' in raw;
  if (isFlat) {
    const term = (regime: string, gain: unknown, tax: unknown): TaxBucket =>
      TaxBucketSchema.parse({
        regime,
        rate_pct: effectiveRatePct(gain, tax),
        gain_native: String(asNumeric(gain)),
        gain_inr: String(asNumeric(gain)),
        tax: String(asNumeric(tax)),
      });
    return [
      term('long-term', raw.lt_gain_inr, raw.lt_tax_inr),
      term('short-term', raw.st_gain_inr, raw.st_tax_inr),
    ];
  }

  return Object.entries(raw).flatMap(([key, value]) => {
    const bucket = parseBucket(value);
    return bucket ? [{ ...bucket, section: bucket.section || key }] : [];
  });
};

/**
 * Report `harvest_candidates` -> card rows. Production rows hold the
 * script's `harvest_detail` (`qty`, `unrealised_loss_inr`, `tax_saved_inr`);
 * the canonical keys (`quantity`, `loss`, `tax_saved`) and `loss_inr` are
 * accepted too. Entries without a symbol are dropped.
 */
export const normalizeHarvestCandidates = (raw: unknown): HarvestCandidate[] => {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): HarvestCandidate[] => {
    if (!isRecord(entry) || typeof entry.symbol !== 'string' || !entry.symbol) return [];
    return [
      {
        symbol: entry.symbol,
        quantity: asNumeric(firstDefined(entry.quantity, entry.qty)),
        loss: asNumeric(firstDefined(entry.loss, entry.unrealised_loss_inr, entry.loss_inr)),
        tax_saved: asNumeric(firstDefined(entry.tax_saved, entry.tax_saved_inr)),
      },
    ];
  });
};
