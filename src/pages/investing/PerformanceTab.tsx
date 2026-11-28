import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { financeService } from '../../services/finance';
import { queryKeys } from '../../lib/queryKeys';
import { HermesNote } from '../../components/investing/HermesNote';
import { ReturnMetricsPanel } from '../../components/investing/ReturnMetricsPanel';
import { PortfolioPerformanceChart } from '../../components/investing/PortfolioPerformanceChart';
import { DividendTrajectoryCard } from '../../components/investing/DividendTrajectoryCard';
import { DividendsSection } from '../../components/investing/DividendsSection';

interface PerformanceTabProps {
  currencyDisplayPreference: 'symbol' | 'code';
}

/** Performance (spec-113 §5.2): the Hermes note, labelled returns, the chart and dividends. */
export const PerformanceTab: React.FC<PerformanceTabProps> = ({ currencyDisplayPreference }) => {
  const accountsQuery = useQuery({
    queryKey: queryKeys.finance.accounts(),
    queryFn: () => financeService.getAccounts(),
  });
  const accounts = useMemo(() => accountsQuery.data?.items ?? [], [accountsQuery.data]);

  return (
    <div className="space-y-6" data-testid="investing-performance">
      <HermesNote />
      <ReturnMetricsPanel currencyDisplayPreference={currencyDisplayPreference} />
      <PortfolioPerformanceChart currencyDisplayPreference={currencyDisplayPreference} />
      <DividendTrajectoryCard currencyDisplayPreference={currencyDisplayPreference} />
      <DividendsSection
        accounts={accounts}
        accountFilter=""
        currencyDisplayPreference={currencyDisplayPreference}
      />
    </div>
  );
};
