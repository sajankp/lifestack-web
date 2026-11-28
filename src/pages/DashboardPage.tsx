import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboard';
import { financeService } from '../services/finance';
import { notificationsService } from '../services/notifications';
import { spendingService } from '../services/spending';
import { todoService } from '../services/todo';
import { RefreshCw, AlertCircle, Clock3 } from 'lucide-react';
import { PageHero } from '../components/layout/PageHero';
import { PageShell } from '../components/layout/PageShell';
import { OnboardingChecklist } from '../components/dashboard/OnboardingChecklist';
import type { OnboardingChecklistStep } from '../components/dashboard/OnboardingChecklist';
import { GoodToKnowSection } from './today/GoodToKnowSection';
import { NeedsYouSection } from './today/NeedsYouSection';
import { NetWorthSection } from './today/NetWorthSection';
import { NextUpSection } from './today/NextUpSection';
import { ThisMonthSection } from './today/ThisMonthSection';
import { DEFAULT_DECIMAL_PLACES, DEFAULT_DISPLAY_LOCALE } from '../utils/numberFormat';
import { formatDateTime } from '../utils/dateFormat';
import { queryKeys } from '../lib/queryKeys';
import { useWorkspaceStore } from '../store/workspaceStore';

// "Today" (spec-113 §3): net worth, what needs you, this month, what is next, and a collapsed
// "Good to know". The route stays `/`. Every section reads data this page already fetches, plus the
// period change and today's dose schedule: both light, and neither touches Investing analytics.
export const DashboardPage: React.FC = () => {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.dashboard.summary(),
    queryFn: () => dashboardService.getSummary(),
  });
  const { data: userFinanceSettings } = useQuery({
    queryKey: queryKeys.finance.settings('user'),
    queryFn: () => financeService.getUserSettings(),
  });
  const { data: insightsData, refetch: refetchInsights } = useQuery({
    queryKey: queryKeys.dashboard.insights(),
    queryFn: () => notificationsService.list(5, 0, { category: 'insight', is_read: false }),
  });
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);

  // Cheap existence probes for the onboarding checklist — each only asks for
  // the paginated `total`, not the records themselves, so they're safe to
  // fetch alongside the dashboard summary without a heavier dedicated endpoint.
  const { data: accountsData } = useQuery({
    queryKey: queryKeys.finance.accounts('dashboard-checklist'),
    queryFn: () => financeService.getAccounts(1, 0),
  });
  const { data: todosData } = useQuery({
    queryKey: queryKeys.todo.list('dashboard-checklist'),
    queryFn: () => todoService.getTodos(undefined, 1, 0),
  });
  const { data: transactionsData } = useQuery({
    queryKey: queryKeys.spending.transactions('dashboard-checklist'),
    queryFn: () => spendingService.getTransactions(1, 0),
  });
  const { data: pushSubscriptions } = useQuery({
    queryKey: queryKeys.notifications.pushSubscriptions(),
    queryFn: () => notificationsService.listPushSubscriptions(),
  });
  const {
    data: briefingData,
    isLoading: isBriefingLoading,
    isError: isBriefingError,
    refetch: refetchBriefing,
    isFetching: isBriefingFetching,
  } = useQuery({
    queryKey: queryKeys.dashboard.briefing(),
    queryFn: () => dashboardService.getBriefing(),
  });

  const displayCurrency = userFinanceSettings?.effective_reporting_currency_code ?? 'USD';
  const currencyDisplayPreference =
    userFinanceSettings?.effective_currency_display_preference ?? 'symbol';
  const displayLocale = userFinanceSettings?.effective_locale ?? DEFAULT_DISPLAY_LOCALE;
  const decimalPlaces = userFinanceSettings?.effective_decimal_places ?? DEFAULT_DECIMAL_PLACES;

  const generatedAt = data?.system.generated_at
    ? formatDateTime(data.system.generated_at, { utc: false, fallback: '' }) || null
    : null;
  const briefingLines = briefingData?.lines ?? [];
  const informationLines = briefingLines.filter((line) => !line.actionable);

  const checklistSteps: OnboardingChecklistStep[] = [
    {
      id: 'currency',
      label: 'Set your reporting currency',
      done: Boolean(userFinanceSettings?.workspace_reporting_currency_code),
      to: '/settings/currency',
    },
    {
      id: 'account',
      label: 'Add your first account',
      done: (accountsData?.total ?? 0) > 0,
      to: '/settings/accounts',
    },
    {
      id: 'activity',
      label: 'Add your first transaction or todo',
      done: (transactionsData?.total ?? 0) > 0 || (todosData?.total ?? 0) > 0,
      actions: [
        { label: 'Add transaction', to: '/money?new=1' },
        { label: 'Add todo', to: '/todo?new=1' },
      ],
    },
    {
      id: 'push',
      label: 'Enable push reminders',
      done: (pushSubscriptions?.length ?? 0) > 0,
      to: '/notifications',
      optional: true,
    },
  ];

  return (
    <PageShell>
      <PageHero
        title="Today"
        actions={
          <button
            onClick={() => {
              void refetch();
              void refetchInsights();
              void refetchBriefing();
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching || isBriefingFetching ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        }
      />

      {isLoading ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-slate-800 bg-slate-900/60">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />
        </div>
      ) : isError ? (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-100">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5" />
            <p className="font-semibold">Dashboard data could not be loaded.</p>
          </div>
          <p className="mt-2 text-sm text-rose-100/80">
            Try refreshing the page or check the backend service.
          </p>
        </div>
      ) : data ? (
        <>
          <OnboardingChecklist workspaceId={activeWorkspaceId} steps={checklistSteps} />

          <div className="space-y-4 sm:space-y-6">
            <NetWorthSection
              fallbackCurrency={displayCurrency}
              currencyDisplay={currencyDisplayPreference}
              locale={displayLocale}
              decimalPlaces={decimalPlaces}
              portfolioValue={data.investing.portfolio_value}
              valuationStatus={data.investing.valuation_status}
              snapshotDate={data.investing.snapshot_date}
            />

            <NeedsYouSection
              isLoading={isBriefingLoading}
              isError={isBriefingError}
              lines={briefingData?.lines}
            />

            <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
              <ThisMonthSection
                monthBudget={data.month_budget}
                currency={displayCurrency}
                currencyDisplay={currencyDisplayPreference}
                locale={displayLocale}
                decimalPlaces={decimalPlaces}
              />
              <NextUpSection todos={data.todos.next_due_items} />
            </div>

            <GoodToKnowSection lines={informationLines} insights={insightsData?.items ?? []} />
          </div>

          {generatedAt ? (
            <p
              data-testid="dashboard-data-as-of"
              className="mt-6 flex items-center gap-2 text-xs text-slate-500"
            >
              <Clock3 className="h-3.5 w-3.5" />
              Data as of {generatedAt}
            </p>
          ) : null}
        </>
      ) : null}
    </PageShell>
  );
};
