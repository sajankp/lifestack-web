import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trash2, Upload } from 'lucide-react';
import { financeService } from '../../services/finance';
import type { FxRateHistoryImportRow, NetWorthHistoryImportRow } from '../../types/finance';
import { formatCurrency } from '../../utils/numberFormat';
import { formatDate } from '../../utils/dateFormat';
import { useInvalidatingMutation } from '../../hooks/useInvalidatingMutation';
import { queryKeys } from '../../lib/queryKeys';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

const refreshKeys = [queryKeys.netWorth.all, queryKeys.finance.all];

type ImportResult = {
  imported: number;
  skipped: number;
  rejected: { row: number; reason: string }[];
};

function parseCsvRows(text: string): Record<string, string>[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const [header, ...rows] = lines;
  const cols = header.split(',').map((c) => c.trim().toLowerCase());
  return rows.map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const record: Record<string, string> = {};
    cols.forEach((c, idx) => {
      record[c] = values[idx] ?? '';
    });
    return record;
  });
}

export const HistoricalDataPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<'net-worth' | 'fx'>('net-worth');

  const [nwCsv, setNwCsv] = useState('');
  const [nwResult, setNwResult] = useState<ImportResult | null>(null);
  const [fxCsv, setFxCsv] = useState('');
  const [fxResult, setFxResult] = useState<ImportResult | null>(null);

  const userPointsRes = useQuery({
    queryKey: queryKeys.netWorth.userPoints(),
    queryFn: () => financeService.getNetWorthUserPoints(200, 0),
    enabled: isOpen,
  });
  const userPoints = useMemo(() => userPointsRes.data?.items ?? [], [userPointsRes.data]);

  const userFxRes = useQuery({
    queryKey: queryKeys.netWorth.userFxRates(),
    queryFn: () => financeService.getFxHistory(200, 0),
    enabled: isOpen,
  });
  const userFxRates = useMemo(() => userFxRes.data?.items ?? [], [userFxRes.data]);

  const nwImportMutation = useInvalidatingMutation(
    (rows: NetWorthHistoryImportRow[]) => financeService.importNetWorthHistory(rows),
    refreshKeys,
    { successMessage: 'Net-worth history imported', onSuccess: (r) => setNwResult(r) },
  );

  const fxImportMutation = useInvalidatingMutation(
    (rows: FxRateHistoryImportRow[]) => financeService.importFxHistory(rows),
    refreshKeys,
    { successMessage: 'FX history imported', onSuccess: (r) => setFxResult(r) },
  );

  const deletePointMutation = useInvalidatingMutation(
    (id: number) => financeService.deleteNetWorthUserPoint(id),
    refreshKeys,
    { successMessage: 'Point deleted' },
  );

  const deleteFxMutation = useInvalidatingMutation(
    (id: number) => financeService.deleteFxHistoryRow(id),
    refreshKeys,
    { successMessage: 'FX rate deleted' },
  );

  const onImportNetWorth = () => {
    const parsed = parseCsvRows(nwCsv);
    if (parsed.length === 0) return;
    const rows: NetWorthHistoryImportRow[] = parsed.map((r) => ({
      date: r.date,
      total_net_worth: Number(r.total_net_worth ?? r.total ?? '0'),
      holdings_value: r.holdings_value ? Number(r.holdings_value) : null,
      investing_cash: r.investing_cash ? Number(r.investing_cash) : null,
      spending_cash: r.spending_cash ? Number(r.spending_cash) : null,
      reporting_currency: (r.reporting_currency || r.currency || 'USD').toUpperCase(),
    }));
    nwImportMutation.mutate(rows);
  };

  const onImportFx = () => {
    const parsed = parseCsvRows(fxCsv);
    if (parsed.length === 0) return;
    const rows: FxRateHistoryImportRow[] = parsed.map((r) => ({
      base_currency_code: (r.base || r.base_currency_code || '').toUpperCase(),
      quote_currency_code: (r.quote || r.quote_currency_code || '').toUpperCase(),
      rate: Number(r.rate ?? '0'),
      as_of_date: r.date || r.as_of_date,
    }));
    fxImportMutation.mutate(rows);
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setIsOpen(true)}>
        <Upload className="h-4 w-4 mr-1" /> Add historical data
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => !open && setIsOpen(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add historical data</DialogTitle>
            <DialogDescription>
              Backfill net-worth points or historical FX rates you already know. Every row is tagged
              as user-provided and never overwrites a live-computed value; a net-worth point is only
              accepted for a date before your history began tracking live.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 border-b border-border">
            <button
              type="button"
              className={`px-3 py-2 text-sm ${tab === 'net-worth' ? 'border-b-2 border-cyan-500 text-foreground' : 'text-muted-foreground'}`}
              onClick={() => setTab('net-worth')}
            >
              Net worth backfill
            </button>
            <button
              type="button"
              className={`px-3 py-2 text-sm ${tab === 'fx' ? 'border-b-2 border-cyan-500 text-foreground' : 'text-muted-foreground'}`}
              onClick={() => setTab('fx')}
            >
              Historical FX
            </button>
          </div>

          {tab === 'net-worth' ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                CSV headers:
                date,total_net_worth,holdings_value,investing_cash,spending_cash,reporting_currency
                — components are optional but must be all-or-none per row.
              </p>
              <textarea
                className="w-full h-28 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                value={nwCsv}
                onChange={(e) => setNwCsv(e.target.value)}
                placeholder="date,total_net_worth,holdings_value,investing_cash,spending_cash,reporting_currency"
              />
              {nwResult ? (
                <div className="text-xs space-y-1">
                  <p>
                    Imported {nwResult.imported}, skipped {nwResult.skipped}, rejected{' '}
                    {nwResult.rejected.length}
                  </p>
                  {nwResult.rejected.map((r) => (
                    <p key={r.row} className="text-rose-500">
                      Row {r.row}: {r.reason}
                    </p>
                  ))}
                </div>
              ) : null}
              <Button
                type="button"
                size="sm"
                onClick={onImportNetWorth}
                disabled={nwImportMutation.isPending}
              >
                Import
              </Button>

              {userPoints.length > 0 ? (
                <div className="rounded-lg border border-border overflow-x-auto mt-4">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-right">Total</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {userPoints.map((p) => (
                        <tr key={p.id} className="border-t border-border/60">
                          <td className="px-3 py-2">{formatDate(p.snapshot_date)}</td>
                          <td className="px-3 py-2 text-right">
                            {formatCurrency(p.total_net_worth, p.reporting_currency)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-rose-500"
                              onClick={() => deletePointMutation.mutate(p.id)}
                              aria-label="Delete point"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                CSV headers: base,quote,rate,date — used only when no system rate exists for that
                date; never affects present-day live figures.
              </p>
              <textarea
                className="w-full h-28 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                value={fxCsv}
                onChange={(e) => setFxCsv(e.target.value)}
                placeholder="base,quote,rate,date"
              />
              {fxResult ? (
                <div className="text-xs space-y-1">
                  <p>
                    Imported {fxResult.imported}, skipped {fxResult.skipped}, rejected{' '}
                    {fxResult.rejected.length}
                  </p>
                  {fxResult.rejected.map((r) => (
                    <p key={r.row} className="text-rose-500">
                      Row {r.row}: {r.reason}
                    </p>
                  ))}
                </div>
              ) : null}
              <Button
                type="button"
                size="sm"
                onClick={onImportFx}
                disabled={fxImportMutation.isPending}
              >
                Import
              </Button>

              {userFxRates.length > 0 ? (
                <div className="rounded-lg border border-border overflow-x-auto mt-4">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Pair</th>
                        <th className="px-3 py-2 text-right">Rate</th>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {userFxRates.map((r) => (
                        <tr key={r.id} className="border-t border-border/60">
                          <td className="px-3 py-2">
                            {r.base_currency_code}/{r.quote_currency_code}
                          </td>
                          <td className="px-3 py-2 text-right">{r.rate}</td>
                          <td className="px-3 py-2">{formatDate(r.as_of_date)}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-rose-500"
                              onClick={() => deleteFxMutation.mutate(r.id)}
                              aria-label="Delete rate"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
