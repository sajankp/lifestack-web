import React from 'react';
import { Globe } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/Card';

export interface CountryWeight {
  country: string;
  weight: number;
}

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

interface CountrySplitCardProps {
  countryWeights: CountryWeight[];
}

export const CountrySplitCard: React.FC<CountrySplitCardProps> = ({
  countryWeights,
}) => {
  const totalWeight = countryWeights.reduce((acc, c) => acc + c.weight, 0);
  const hasData = totalWeight > 0;

  if (!hasData) {
    return (
      <Card data-testid="country-split-card" className="p-5">
        <CardHeader>
          <CardTitle>Country Split</CardTitle>
          <CardDescription>Portfolio weight by country of listing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-slate-700/30 bg-slate-900/30 p-6 text-center text-xs text-slate-400">
            No country split data
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="country-split-card" className="p-5">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-500/10 p-2 text-purple-400">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Country Split</CardTitle>
            <CardDescription>Portfolio weight by country of listing</CardDescription>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Markets
          </div>
          <div className="text-xl font-bold text-white">{countryWeights.length}</div>
        </div>
      </CardHeader>
      <CardContent className="pt-3 space-y-3">
        {countryWeights.map((c) => {
          const pct = totalWeight > 0 ? (c.weight / totalWeight) * 100 : 0;
          return (
            <div
              key={c.country}
              className="flex items-center gap-3"
              data-testid={`country-row-${c.country.replace(/\s+/g, '-')}`}
            >
              <span className="shrink-0 text-xs font-medium text-slate-200 w-16">
                {c.country}
              </span>
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div
                  className="h-full bg-cyan-500/80"
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <span className="shrink-0 font-mono text-xs text-slate-200 w-10 text-right">
                {pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
