import React from 'react';
import { useCurrencyFormatter } from '../../hooks/useDisplayProfile';
import { toNumber } from '../../utils/numberFormat';
import type { TaxBucket } from '../../types/investing';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

interface TaxBucketsCardProps {
  taxBuckets: TaxBucket[];
  currencyDisplayPreference?: 'symbol' | 'code';
}

export const TaxBucketsCard: React.FC<TaxBucketsCardProps> = ({
  taxBuckets,
  currencyDisplayPreference = 'symbol',
}) => {
  const formatCurrency = useCurrencyFormatter();
  const buckets = taxBuckets.filter((b) => toNumber(b.gain_inr) !== 0 || toNumber(b.tax) !== 0);

  const totals = buckets.reduce(
    (acc, b) => ({
      gain: acc.gain + toNumber(b.gain_inr),
      tax: acc.tax + toNumber(b.tax),
    }),
    { gain: 0, tax: 0 },
  );

  const regimeVariant = (regime: string) => {
    const r = regime.toLowerCase();
    if (r.includes('foreign')) return 'default';
    if (r.includes('domestic') || r.includes('indian')) return 'secondary';
    return 'outline';
  };

  if (buckets.length === 0) {
    return (
      <Card data-testid="tax-buckets-card" className="p-5">
        <CardHeader>
          <CardTitle>Tax Buckets</CardTitle>
          <CardDescription>Capital gains by tax regime and section</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-slate-700/30 bg-slate-900/30 p-6 text-center text-xs text-slate-400">
            No tax buckets recorded
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="tax-buckets-card" className="p-5">
      <CardHeader>
        <CardTitle>Tax Buckets</CardTitle>
        <CardDescription>Capital gains by tax regime and section</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-slate-700/40 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Regime</TableHead>
                <TableHead>Section</TableHead>
                <TableHead align="right">Rate %</TableHead>
                <TableHead align="right">Gain (INR)</TableHead>
                <TableHead align="right">Tax (INR)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buckets.map((bucket, idx) => (
                <TableRow key={`${bucket.section}-${idx}`} data-testid={`tax-bucket-row-${idx}`}>
                  <TableCell>
                    <Badge variant={regimeVariant(bucket.regime)}>
                      {bucket.regime.charAt(0).toUpperCase() + bucket.regime.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-300">
                    {bucket.section || '—'}
                  </TableCell>
                  <TableCell align="right" className="font-mono text-slate-200">
                    {bucket.rate_pct || '0'}%
                  </TableCell>
                  <TableCell align="right" className="font-mono text-slate-200">
                    {formatCurrency(bucket.gain_inr, 'INR', currencyDisplayPreference)}
                  </TableCell>
                  <TableCell align="right" className="font-mono text-slate-200">
                    {formatCurrency(bucket.tax, 'INR', currencyDisplayPreference)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3 flex justify-between text-xs">
          <div className="text-slate-500">Totals</div>
          <div className="flex gap-4 text-right">
            <span className="font-mono font-semibold text-white" data-testid="tax-buckets-total-gain">
              {formatCurrency(String(totals.gain), 'INR', currencyDisplayPreference)}
            </span>
            <span className="font-mono font-semibold text-white" data-testid="tax-buckets-total-tax">
              {formatCurrency(String(totals.tax), 'INR', currencyDisplayPreference)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
