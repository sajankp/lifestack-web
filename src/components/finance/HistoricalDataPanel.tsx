import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trash2, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { financeService } from '../../services/finance';
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

export const HistoricalDataPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<'net-worth' | 'fx'>('net-worth');


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

  return (
    <>
      <Button variant="secondary" size="sm" data-testid="historical-data-open" onClick={() => setIsOpen(true)}>
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
              <Button asChild variant="secondary" size="sm">
                <Link to="/imports?module=finance-net-worth-history">
                  <Upload className="h-4 w-4 mr-1" /> Import Net Worth CSV
                </Link>
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
                        <tr key={p.id} data-testid={`historical-networth-row-${p.id}`} className="border-t border-border/60">
                          <td className="px-3 py-2">{formatDate(p.snapshot_date)}</td>
                          <td className="px-3 py-2 text-right">
                            {formatCurrency(p.total_net_worth, p.reporting_currency)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              data-testid={`historical-networth-delete-${p.id}`}
                              className="text-muted-foreground hover:text-rose-500 disabled:opacity-50"
                              disabled={deletePointMutation.isPending}
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
              <Button asChild variant="secondary" size="sm">
                <Link to="/imports?module=finance-fx-rates">
                  <Upload className="h-4 w-4 mr-1" /> Import FX Rates CSV
                </Link>
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
                              className="text-muted-foreground hover:text-rose-500 disabled:opacity-50"
                              disabled={deleteFxMutation.isPending}
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
