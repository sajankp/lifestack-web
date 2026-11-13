import React from 'react';
import { Maximize2 } from 'lucide-react';
import { useCurrencyFormatter } from '../../hooks/useDisplayProfile';
import type { LrsHeadroom } from '../../types/investing';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';

interface LrsHeadroomCardProps {
  lrsHeadroom: LrsHeadroom | null | undefined;
  asOf?: string;
  currencyDisplayPreference?: 'symbol' | 'code';
}

export const LrsHeadroomCard: React.FC<LrsHeadroomCardProps> = ({
  lrsHeadroom,
  asOf,
  currencyDisplayPreference = 'symbol',
}) => {
  const formatCurrency = useCurrencyFormatter();
  const headroomInr = lrsHeadroom?.lrs_headroom_inr ?? null;
  const hasData = headroomInr != null;

  return (
    <Card data-testid="lrs-headroom-card" className="p-5">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
            <Maximize2 className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>LRS Headroom</CardTitle>
            <CardDescription>
              Liberalized Remittance Scheme headroom remaining (INR)
            </CardDescription>
          </div>
        </div>
        {asOf && (
          <Badge variant="outline" title={`Report as of ${asOf}`}>
            As of {asOf}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="rounded-xl border border-slate-700/30 bg-slate-900/30 p-6 text-center text-xs text-slate-400">
            No LRS headroom data
          </div>
        ) : (
          <div className="text-center">
            <div className="text-3xl font-bold text-white">
              {formatCurrency(headroomInr, 'INR', currencyDisplayPreference)}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Headroom remaining under the annual LRS limit
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
