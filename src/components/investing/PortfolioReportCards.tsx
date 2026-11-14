import React from 'react';
import { EmptyState } from '../ui/FeedbackStates';
import { Folder } from 'lucide-react';
import type { PortfolioReport, TaxBucket, HarvestCandidate } from '../../types/investing';
import { CountrySplitCard } from './CountrySplitCard';
import { extractCountryWeights } from '../../utils/portfolioReport';
import { HarvestCandidatesCard } from './HarvestCandidatesCard';
import { LrsHeadroomCard } from './LrsHeadroomCard';
import { TaxBucketsCard } from './TaxBucketsCard';
import { ThemeSplitCard } from './ThemeSplitCard';

// Local type to match HarvestCandidatesCard's expected input
type HarvestCandidateInput = HarvestCandidate | Record<string, unknown>;

interface PortfolioReportCardsProps {
  report: PortfolioReport | null;
  currencyDisplayPreference: 'symbol' | 'code';
}

export const PortfolioReportCards: React.FC<PortfolioReportCardsProps> = ({
  report,
  currencyDisplayPreference,
}) => {
  if (!report) {
    return (
      <EmptyState
        icon={<Folder className="h-6 w-6" />}
        title="No portfolio report available"
        description={
          "Run a biweekly foundation report to see LRS headroom, tax buckets, theme, country and harvest cards."
        }
      />
    );
  }

  return (
    <div
      data-testid="portfolio-report-cards"
      className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      <LrsHeadroomCard
        lrsHeadroom={report.lrs_headroom_inr ? { lrs_headroom_inr: report.lrs_headroom_inr } : null}
        asOf={report.as_of || undefined}
        currencyDisplayPreference={currencyDisplayPreference}
      />
      <TaxBucketsCard
        taxBuckets={report.tax_buckets as Record<string, TaxBucket>}
        currencyDisplayPreference={currencyDisplayPreference}
      />
      <ThemeSplitCard themeWeights={report.theme_weights} />
      <CountrySplitCard
        countryWeights={extractCountryWeights(report.foundation_json as Record<string, string> | null)}
      />
      <HarvestCandidatesCard harvestCandidates={report.harvest_candidates as HarvestCandidateInput[]} />
    </div>
  );
};
