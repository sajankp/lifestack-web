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
    const country =
      (obj.country ?? obj.name ?? obj.code ?? obj.label) as string | undefined;
    const weight =
      obj.weight ?? obj.value ?? obj.pct ?? obj.w ?? obj.percent;
    if (!country || weight == null) continue;
    const numericWeight = Number(weight);
    if (Number.isFinite(numericWeight) && numericWeight > 0) {
      weights.push({ country: String(country), weight: numericWeight });
    }
  }

  return weights.sort((a, b) => b.weight - a.weight);
};