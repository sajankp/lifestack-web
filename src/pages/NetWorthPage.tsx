import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Building2, Landmark, PieChart, TrendingUp, Wallet } from 'lucide-react';
import { financeService } from '../services/finance';
import { formatCurrency } from '../utils/numberFormat';
import { formatDate } from '../utils/dateFormat';
import { PageHero } from '../components/layout/PageHero';
import { PageShell } from '../components/layout/PageShell';
import { queryKeys } from '../lib/queryKeys';
import type { NetWorthHistoryItem } from '../types/finance';

const accountTypeLabel = (type: string): string => {
  switch (type) {
    case 'bank':
      return 'Bank';
    case 'brokerage':
      return 'Brokerage';
    case 'wallet':
      return 'Wallet';
    case 'card':
      return 'Card';
    case 'gift_card':
      return 'Gift Card';
    default:
      return type;
  }
};

const StatusBanner: React.FC<{ status: string; reportingCurrency: string | null }> = ({
  status,
  reportingCurrency,
}) => {
  if (status === 'ok' || status === 'empty') return null;

  let message = '';
  if (status === 'no_reporting_currency') {
    message =
      'Configure a reporting currency in Master Config to see converted totals across all accounts.';
  } else if (status === 'partial') {
    message = reportingCurrency
      ? `Some balances could not be converted to ${reportingCurrency} — FX rates may be missing for one or more currencies.`
      : 'Partial data available. Configure a reporting currency and FX rates for full totals.';
  }

  if (!message) return null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
};

const SummaryCard: React.FC<{
  label: string;
  value: string | null;
  currency: string | null;
  icon: React.ReactNode;
  highlight?: boolean;
  unavailable?: boolean;
}> = ({ label, value, currency, icon, highlight = false, unavailable = false }) => (
  <div
    className={`rounded-2xl border p-5 ${
      highlight
        ? 'border-cyan-500/40 bg-gradient-to-br from-cyan-500/10 to-slate-800/60'
        : 'border-slate-700/60 bg-slate-800/40'
    }`}
  >
    <div className="mb-3 flex items-center gap-2 text-slate-400">
      {icon}
      <span className="text-xs font-semibold uppercase tracking-widest">{label}</span>
    </div>
    {unavailable ? (
      <p className="text-lg font-semibold text-slate-500">—</p>
    ) : (
      <p className={`text-2xl font-bold ${highlight ? 'text-cyan-300' : 'text-white'}`}>
        {value != null ? formatCurrency(value, currency) : '—'}
      </p>
    )}
    {currency && !unavailable && (
      <p className="mt-1 text-xs text-slate-500 uppercase tracking-wider">{currency}</p>
    )}
  </div>
);

const NetWorthHistoryChart: React.FC<{
  history: NetWorthHistoryItem[] | undefined;
  currency: string | null;
}> = ({ history, currency }) => {
  if (!history || history.length < 2) {
    return (
      <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-8 text-center">
        <TrendingUp className="mx-auto mb-3 h-8 w-8 text-slate-500" />
        <h3 className="font-semibold text-slate-300">History builds from here</h3>
        <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
          We've started tracking your net worth today. Once daily snapshots accumulate, a stacked area trend chart will appear here.
        </p>
      </div>
    );
  }

  const width = 800;
  const height = 280;
  const paddingX = 40;
  const paddingY = 20;

  // Convert string values to numbers
  const points = history.map(item => ({
    dateStr: item.snapshot_date,
    spending: parseFloat(item.spending_cash || '0'),
    investing: parseFloat(item.investing_cash || '0'),
    holdings: parseFloat(item.holdings_value || '0'),
    total: parseFloat(item.total_net_worth || '0'),
  }));

  const maxVal = Math.max(...points.map(p => p.total), 1);

  const getX = (index: number) => {
    return paddingX + (index / (points.length - 1)) * (width - 2 * paddingX);
  };

  const getY = (val: number) => {
    const scale = (height - 2 * paddingY) / maxVal;
    return height - paddingY - val * scale;
  };

  // Stack 3: Total (Spending + Investing + Holdings)
  const pathTotal = points.map((p, i) => `${getX(i)},${getY(p.total)}`).join(' L ');
  const areaTotal = `M ${getX(0)},${height - paddingY} L ${pathTotal} L ${getX(points.length - 1)},${height - paddingY} Z`;

  // Stack 2: Spending + Investing
  const pathInvest = points.map((p, i) => `${getX(i)},${getY(p.spending + p.investing)}`).join(' L ');
  const areaInvest = `M ${getX(0)},${height - paddingY} L ${pathInvest} L ${getX(points.length - 1)},${height - paddingY} Z`;

  // Stack 1: Spending
  const pathSpend = points.map((p, i) => `${getX(i)},${getY(p.spending)}`).join(' L ');
  const areaSpend = `M ${getX(0)},${height - paddingY} L ${pathSpend} L ${getX(points.length - 1)},${height - paddingY} Z`;

  const formatShortDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
    } catch {
      return dateStr;
    }
  };

  const formatShortValue = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
    return val.toFixed(0);
  };

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-800/30 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-300">Net worth history</h3>
          <p className="text-xs text-slate-500 mt-0.5">Stacked breakdown over time {currency ? `(${currency})` : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span>Holdings</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
            <span>Investing Cash</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
            <span>Spending Cash</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-white" />
            <span className="text-slate-300">Total Net Worth</span>
          </div>
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg className="w-full min-w-[640px]" viewBox={`0 0 ${width} ${height}`}>
          <defs>
            <linearGradient id="colorHoldings" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="colorInvesting" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="colorSpending" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={paddingX} y1={getY(maxVal)} x2={width - paddingX} y2={getY(maxVal)} stroke="#334155" strokeDasharray="3 3" />
          <line x1={paddingX} y1={getY(maxVal / 2)} x2={width - paddingX} y2={getY(maxVal / 2)} stroke="#334155" strokeDasharray="3 3" />
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#334155" />

          {/* Value labels */}
          <text x={paddingX - 8} y={getY(maxVal) + 4} textAnchor="end" className="text-[10px] fill-slate-500 font-medium">
            {formatShortValue(maxVal)}
          </text>
          <text x={paddingX - 8} y={getY(maxVal / 2) + 4} textAnchor="end" className="text-[10px] fill-slate-500 font-medium">
            {formatShortValue(maxVal / 2)}
          </text>
          <text x={paddingX - 8} y={height - paddingY + 4} textAnchor="end" className="text-[10px] fill-slate-500 font-medium">
            0
          </text>

          {/* Stacked Areas */}
          <path d={areaTotal} fill="url(#colorHoldings)" />
          <path d={areaInvest} fill="url(#colorInvesting)" />
          <path d={areaSpend} fill="url(#colorSpending)" />

          {/* Divider lines between stacks */}
          <path d={`M ${pathTotal}`} fill="none" stroke="#10b981" strokeWidth={1} strokeOpacity={0.5} />
          <path d={`M ${pathInvest}`} fill="none" stroke="#6366f1" strokeWidth={1} strokeOpacity={0.5} />
          <path d={`M ${pathSpend}`} fill="none" stroke="#06b6d4" strokeWidth={1} strokeOpacity={0.5} />

          {/* White line on top for Total Net Worth */}
          <path d={`M ${pathTotal}`} fill="none" stroke="#ffffff" strokeWidth={2} />

          {/* Dot anchors */}
          {points.map((p, i) => (
            <g key={i} className="group cursor-pointer">
              <circle cx={getX(i)} cy={getY(p.total)} r={4} fill="#ffffff" stroke="#1e293b" strokeWidth={1.5} />
            </g>
          ))}

          {/* X Axis Labels */}
          {points.length > 0 && (
            <>
              <text x={getX(0)} y={height - paddingY + 16} textAnchor="start" className="text-[10px] fill-slate-500 font-medium">
                {formatShortDate(points[0].dateStr)}
              </text>
              {points.length > 2 && (
                <text x={getX(Math.floor(points.length / 2))} y={height - paddingY + 16} textAnchor="middle" className="text-[10px] fill-slate-500 font-medium">
                  {formatShortDate(points[Math.floor(points.length / 2)].dateStr)}
                </text>
              )}
              <text x={getX(points.length - 1)} y={height - paddingY + 16} textAnchor="end" className="text-[10px] fill-slate-500 font-medium">
                {formatShortDate(points[points.length - 1].dateStr)}
              </text>
            </>
          )}
        </svg>
      </div>
    </div>
  );
};

export const NetWorthPage: React.FC = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.netWorth.summary(),
    queryFn: () => financeService.getNetWorth(),
    staleTime: 60_000,
  });

  const rc = data?.reporting_currency ?? null;
  const isEmpty = data?.valuation_status === 'empty';

  const { data: historyData } = useQuery({
    queryKey: queryKeys.netWorth.history(),
    queryFn: () => financeService.getNetWorthHistory(),
    staleTime: 60_000,
    enabled: !isEmpty && !!rc,
  });

  const summaryCards = [
    {
      label: 'Spending Cash',
      value: data?.spending_total ?? null,
      currency: rc,
      icon: <Wallet className="h-4 w-4" />,
      unavailable: data?.spending_total == null || !rc,
    },
    {
      label: 'Investing Cash',
      value: data?.investing_cash_total ?? null,
      currency: rc,
      icon: <Landmark className="h-4 w-4" />,
      unavailable: data?.investing_cash_total == null || !rc,
    },
    {
      label: 'Portfolio Holdings',
      value: data?.holdings_value ?? null,
      currency: rc,
      icon: <TrendingUp className="h-4 w-4" />,
      unavailable: data?.holdings_value == null || !rc,
    },
    {
      label: 'Total Net Worth',
      value: data?.total_net_worth ?? null,
      currency: rc,
      icon: <PieChart className="h-4 w-4" />,
      highlight: true,
      unavailable: data?.total_net_worth == null || !rc,
    },
  ];

  if (isLoading) {
    return (
      <PageShell animated>
        <div className="animate-pulse space-y-5">
          <div className="h-16 w-64 rounded-xl bg-slate-800" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-slate-800" />
            ))}
          </div>
          <div className="h-48 rounded-2xl bg-slate-800" />
        </div>
      </PageShell>
    );
  }

  if (isError) {
    return (
      <PageShell>
        <PageHero title="Net Worth" subtitle="Your complete financial picture" />
        <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Failed to load net worth data. Please try again.</span>
        </div>
      </PageShell>
    );
  }

  const spendingAccounts = data?.spending_accounts ?? [];
  const brokerageCashAccounts = data?.investing_accounts ?? [];

  return (
    <PageShell animated>
      <PageHero
        title="Net Worth"
        subtitle={
          rc ? `Your complete financial picture in ${rc}` : 'Your complete financial picture'
        }
      />

      <StatusBanner status={data?.valuation_status ?? ''} reportingCurrency={rc} />

      {isEmpty ? (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-800/30 px-8 py-16 text-center">
          <PieChart className="mx-auto mb-4 h-10 w-10 text-slate-600" />
          <p className="text-lg font-semibold text-slate-400">No financial data yet</p>
          <p className="mt-2 text-sm text-slate-600">
            Add spending transactions, investing holdings, or cash balances to see your net worth.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {summaryCards.map((card) => (
              <SummaryCard key={card.label} {...card} />
            ))}
          </div>

          {/* History Chart */}
          {rc && (
            <NetWorthHistoryChart history={historyData} currency={rc} />
          )}

          {/* Investing breakdown */}
          {(data?.investing_cash_total != null || data?.holdings_value != null) && (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500">
                Investing breakdown
              </h2>
              <div className="overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-800/30">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/60">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">
                        Component
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-500">
                        {rc ? `Value (${rc})` : 'Value'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-800">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Landmark className="h-3.5 w-3.5 text-slate-500" />
                          <span className="text-slate-200">Cash balances</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-slate-200">
                        {data?.investing_cash_total != null && rc
                          ? formatCurrency(data.investing_cash_total, rc)
                          : '—'}
                      </td>
                    </tr>
                    <tr className="border-t border-slate-800">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-3.5 w-3.5 text-slate-500" />
                          <span className="text-slate-200">Holdings (market value)</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-slate-200">
                        {data?.holdings_value != null && rc
                          ? formatCurrency(data.holdings_value, rc)
                          : '—'}
                      </td>
                    </tr>
                    {data?.investing_total != null && rc && (
                      <tr className="border-t border-slate-700">
                        <td className="px-5 py-3 font-semibold text-slate-300">Investing total</td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-200">
                          {formatCurrency(data.investing_total, rc)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Brokerage cash accounts breakdown */}
          {brokerageCashAccounts.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500">
                Brokerage cash
              </h2>
              <div className="overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-800/30">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/60">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">
                        Account
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-500">
                        Native balance
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-500">
                        {rc ? `In ${rc}` : 'Converted'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {brokerageCashAccounts.map((account) => (
                      <tr
                        key={`${account.account_public_id}-${account.currency_code}`}
                        className="border-t border-slate-800"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <Landmark className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                            <span className="font-medium text-slate-100">
                              {account.account_name}
                            </span>
                          </div>
                          <p className="mt-0.5 pl-5 text-xs text-slate-500">Brokerage</p>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-slate-300">
                            {formatCurrency(account.balance, account.currency_code)}
                          </span>
                          <span className="ml-1.5 text-xs text-slate-600 uppercase">
                            {account.currency_code}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {account.balance_in_reporting_currency != null && rc ? (
                            <span className="font-medium text-slate-200">
                              {formatCurrency(account.balance_in_reporting_currency, rc)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-600">No FX rate</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {data?.investing_cash_total != null && rc && (
                      <tr className="border-t border-slate-700">
                        <td className="px-5 py-3 font-semibold text-slate-300" colSpan={2}>
                          Investing cash total
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-200">
                          {formatCurrency(data.investing_cash_total, rc)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Spending accounts breakdown */}
          {spendingAccounts.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500">
                Spending accounts
              </h2>
              <div className="overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-800/30">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/60">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-500">
                        Account
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-500">
                        Native balance
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-500">
                        {rc ? `In ${rc}` : 'Converted'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {spendingAccounts.map((account) => (
                      <tr key={account.account_public_id} className="border-t border-slate-800">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                            <span className="font-medium text-slate-100">
                              {account.account_name}
                            </span>
                          </div>
                          <p className="mt-0.5 pl-5 text-xs text-slate-500">
                            {accountTypeLabel(account.account_type)}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-slate-300">
                            {formatCurrency(account.balance, account.currency_code)}
                          </span>
                          <span className="ml-1.5 text-xs text-slate-600 uppercase">
                            {account.currency_code}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {account.balance_in_reporting_currency != null && rc ? (
                            <span className="font-medium text-slate-200">
                              {formatCurrency(account.balance_in_reporting_currency, rc)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-600">No FX rate</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {data?.spending_total != null && rc && (
                      <tr className="border-t border-slate-700">
                        <td className="px-5 py-3 font-semibold text-slate-300" colSpan={2}>
                          Spending total
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-200">
                          {formatCurrency(data.spending_total, rc)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Grand total bar */}
          {data?.total_net_worth != null && (
            <div className="flex items-center justify-between rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-slate-800/60 px-6 py-5">
              <div className="flex items-center gap-3">
                <PieChart className="h-5 w-5 text-cyan-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Total Net Worth
                  </p>
                  {data.fx_as_of && (
                    <p className="text-xs text-slate-600">
                      FX rates as of{' '}
                      {formatDate(data.fx_as_of)}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-3xl font-bold text-cyan-300">
                {rc ? (
                  <>
                    {formatCurrency(data.total_net_worth, rc)}
                    <span className="ml-2 text-lg font-semibold text-cyan-500">{rc}</span>
                  </>
                ) : (
                  '—'
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
};
