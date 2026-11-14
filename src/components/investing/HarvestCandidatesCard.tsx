import React from 'react';
import { TrendingDown, Percent } from 'lucide-react';
import { useCurrencyFormatter } from '../../hooks/useDisplayProfile';
import { formatQuantity, toNumber } from '../../utils/numberFormat';
import type { HarvestCandidate } from '../../types/investing';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';

// Portfolio report harvest candidates can be any object (backend returns list[Any])\n// API test data uses { symbol, loss_inr } but frontend expects { symbol, quantity, loss, tax_saved }\n// Cron script may send yet another format - be defensive\n
type HarvestCandidateInput = HarvestCandidate | Record<string, unknown>;

interface Totals {
  loss: number;
  taxSaved: number;
}

interface HarvestCandidatesCardProps {
  harvestCandidates: HarvestCandidateInput[];
}

export const HarvestCandidatesCard: React.FC<HarvestCandidatesCardProps> = ({
  harvestCandidates,
}) => {
  const formatCurrency = useCurrencyFormatter();

  // Extract loss/tax_saved from either HarvestCandidate or generic object
  const getLoss = (c: HarvestCandidateInput): number =>
    toNumber('loss' in c ? c.loss : (c.loss_inr as string | number | undefined) ?? 0);
  const getTaxSaved = (c: HarvestCandidateInput): number =>
    toNumber('tax_saved' in c ? c.tax_saved : (c.tax_saved_inr as string | number | undefined) ?? 0);
  const getSymbol = (c: HarvestCandidateInput): string =>
    'symbol' in c ? c.symbol : ((c.symbol as string) ?? '—');
  const getQuantity = (c: HarvestCandidateInput): string | number =>
    'quantity' in c ? c.quantity : ((c.quantity as string | number) ?? '—');

  const candidates = harvestCandidates.filter((c) => getLoss(c) > 0);

  const totals = candidates.reduce(
    (acc: Totals, c: HarvestCandidateInput) => ({
      loss: acc.loss + getLoss(c),
      taxSaved: acc.taxSaved + getTaxSaved(c),
    }),
    { loss: 0, taxSaved: 0 } as Totals,
  );

  if (candidates.length === 0) {
    return (
      <Card data-testid="harvest-candidates-card" className="p-5">
        <CardHeader>
          <CardTitle>Harvest Candidates</CardTitle>
          <CardDescription>Realize losses to save tax</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-slate-700/30 bg-slate-900/30 p-6 text-center text-xs text-slate-400">
            No harvest candidates
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="harvest-candidates-card" className="p-5">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-rose-500/10 p-2 text-rose-400">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Harvest Candidates</CardTitle>
            <CardDescription>Realize losses to save tax</CardDescription>
          </div>
        </div>
        <Percent className="h-5 w-5 text-emerald-400" />
      </CardHeader>
      <CardContent className="pt-3 space-y-2">
        {candidates.map((candidate, idx) => (
          <div
            key={getSymbol(candidate) || String(idx)}
            className="flex items-center justify-between gap-3 px-2 py-2 rounded-lg border border-slate-700/40 bg-slate-900/30 hover:border-slate-700/60 transition-colors"
            data-testid={`harvest-row-${idx}`}
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-medium text-slate-200 truncate">
                {getSymbol(candidate)}
              </span>
              <span className="text-[11px] text-slate-500">
                {formatQuantity(getQuantity(candidate))} qty
              </span>
            </div>
            <div className="flex flex-col items-end gap-0.5 min-w-0">
              <span className="font-mono text-xs text-rose-400 text-right">
                − {formatCurrency(getLoss(candidate), 'INR', 'code')}
              </span>
              <span className="font-mono text-xs text-emerald-300 text-right">
                Tax saved {formatCurrency(getTaxSaved(candidate), 'INR', 'code')}
              </span>
            </div>
          </div>
        ))}
        <div className="mt-2 border-t border-slate-700/40 pt-2 flex justify-between text-xs">
          <div className="text-slate-500">Total ({candidates.length})</div>
          <div className="flex gap-4 text-right">
            <span className="font-mono font-semibold text-rose-400 text-right" data-testid="harvest-total-loss">
              − {formatCurrency(String(totals.loss), 'INR', 'code')}
            </span>
            <span className="font-mono font-semibold text-emerald-300 text-right" data-testid="harvest-total-tax-saved">
              {formatCurrency(String(totals.taxSaved), 'INR', 'code')}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};