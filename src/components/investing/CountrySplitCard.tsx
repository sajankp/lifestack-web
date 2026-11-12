import React from 'react';
import { Globe } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/Card';
import type { CountryWeight } from '../../utils/portfolioReport';

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
