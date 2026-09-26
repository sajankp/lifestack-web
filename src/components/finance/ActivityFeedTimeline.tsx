import React from 'react';
import {
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight,
  Building2,
  Coins,
  LineChart,
  Search,
  Tag,
  Wallet,
} from 'lucide-react';
import { formatCurrency } from '../../utils/numberFormat';
import { formatDate } from '../../utils/dateFormat';
import { useDisplayProfile } from '../../hooks/useDisplayProfile';
import { DropdownSelect } from '../DropdownSelect';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import type { Account, ActivityFeedItem } from '../../types/finance';

interface ActivityFeedTimelineProps {
  items: ActivityFeedItem[];
  total: number;
  limit: number;
  offset: number;
  onPageChange: (offset: number) => void;
  accounts: Account[];
  selectedAccountId?: string | null;
  onSelectAccount?: (accountId: string | null) => void;
  selectedEventType?: string | null;
  onSelectEventType?: (eventType: string | null) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  isLoading?: boolean;
}

export const ActivityFeedTimeline: React.FC<ActivityFeedTimelineProps> = ({
  items,
  total,
  limit,
  offset,
  onPageChange,
  accounts,
  selectedAccountId,
  onSelectAccount,
  selectedEventType,
  onSelectEventType,
  searchQuery = '',
  onSearchChange,
  isLoading = false,
}) => {
  const displayProfile = useDisplayProfile();

  const eventTypeFilters = [
    { value: null, label: 'All Activity' },
    { value: 'spend', label: 'Spending & Income' },
    { value: 'transfer', label: 'Transfers' },
    { value: 'order', label: 'Trades' },
    { value: 'dividend', label: 'Dividends' },
  ];

  const accountOptions = accounts.map((a) => ({
    value: a.public_id,
    label: `${a.name} (${a.account_type})`,
  }));

  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.description && item.description.toLowerCase().includes(q)) ||
      (item.symbol && item.symbol.toLowerCase().includes(q)) ||
      (item.account_name && item.account_name.toLowerCase().includes(q)) ||
      (item.counterpart_account_name &&
        item.counterpart_account_name.toLowerCase().includes(q))
    );
  });

  const getItemVisuals = (item: ActivityFeedItem) => {
    const amtStr = String(item.amount ?? '0');
    switch (item.event_type) {
      case 'spend': {
        const isIncome = amtStr.startsWith('+');
        return {
          icon: isIncome ? ArrowUpRight : ArrowDownRight,
          iconBg: isIncome ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400',
          badgeText: isIncome ? 'Income' : 'Spend',
          badgeBg: isIncome ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700',
          amountColor: isIncome ? 'text-emerald-400' : 'text-slate-200',
        };
      }
      case 'transfer': {
        const isReceive = amtStr.startsWith('+');
        return {
          icon: ArrowRightLeft,
          iconBg: 'bg-blue-500/10 text-blue-400',
          badgeText: isReceive ? 'Transfer In' : 'Transfer Out',
          badgeBg: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
          amountColor: isReceive ? 'text-emerald-400' : 'text-slate-200',
        };
      }
      case 'order': {
        const isBuy = item.order_type === 'buy';
        return {
          icon: LineChart,
          iconBg: isBuy ? 'bg-violet-500/10 text-violet-400' : 'bg-emerald-500/10 text-emerald-400',
          badgeText: isBuy ? 'Buy Order' : 'Sell Order',
          badgeBg: isBuy ? 'bg-violet-500/10 text-violet-300 border-violet-500/20' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
          amountColor: isBuy ? 'text-slate-200' : 'text-emerald-400',
        };
      }
      case 'dividend': {
        return {
          icon: Coins,
          iconBg: 'bg-emerald-500/10 text-emerald-400',
          badgeText: item.income_type?.toUpperCase() ?? 'DIVIDEND',
          badgeBg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
          amountColor: 'text-emerald-400 font-bold',
        };
      }
      default:
        return {
          icon: Wallet,
          iconBg: 'bg-slate-800 text-slate-400',
          badgeText: 'Event',
          badgeBg: 'bg-slate-800 text-slate-400 border-slate-700',
          amountColor: 'text-slate-200',
        };
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-4">
      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
        {/* Event Type Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {eventTypeFilters.map((tab) => {
            const isSelected =
              tab.value === selectedEventType ||
              (tab.value === null && !selectedEventType);
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => onSelectEventType?.(tab.value)}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Account Filter & Search */}
        <div className="flex items-center gap-2">
          {onSearchChange && (
            <div className="relative w-48 sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <Input
                type="text"
                placeholder="Search activity..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="h-8 pl-8 text-xs bg-slate-800/80 border-slate-700"
              />
            </div>
          )}

          {onSelectAccount && (
            <div className="w-40 sm:w-48">
              <DropdownSelect
                options={accountOptions}
                value={selectedAccountId ?? ''}
                onChange={(val) => onSelectAccount(val ? val : null)}
                placeholder="All Accounts"
                clearLabel="All Accounts"
              />
            </div>
          )}
        </div>
      </div>

      {/* Activity Items List */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 shadow-sm backdrop-blur overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading activity feed...</div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Wallet className="h-10 w-10 text-slate-600 mb-3" />
            <h4 className="text-sm font-semibold text-slate-300">No activity recorded</h4>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Transactions, transfers, trade orders, and dividends will appear here in chronological order.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredItems.map((item) => {
              const visuals = getItemVisuals(item);
              const Icon = visuals.icon;
              const amtStr = String(item.amount ?? '0');
              const numAmt = parseFloat(amtStr.replace('+', '')) || 0;
              const isPositive = amtStr.startsWith('+');

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3.5 hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`rounded-xl p-2.5 shrink-0 ${visuals.iconBg}`}>
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-white truncate max-w-xs sm:max-w-md">
                          {item.description}
                        </span>
                        <span
                          className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${visuals.badgeBg}`}
                        >
                          {visuals.badgeText}
                        </span>
                        {item.category_name && (
                          <span
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium border"
                            style={{
                              backgroundColor: `${item.category_color ?? '#64748B'}15`,
                              color: item.category_color ?? '#94A3B8',
                              borderColor: `${item.category_color ?? '#64748B'}30`,
                            }}
                          >
                            <Tag className="h-2.5 w-2.5" />
                            {item.category_name}
                          </span>
                        )}
                        {item.fx_display && (
                          <span className="rounded bg-blue-950/40 border border-blue-800/40 px-1.5 py-0.5 text-[10px] font-mono text-blue-300">
                            {item.fx_display}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span>{formatDate(item.date)}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-slate-500" />
                          {item.account_name}
                        </span>
                        {item.counterpart_account_name && (
                          <>
                            <span>→</span>
                            <span className="text-slate-300 font-medium">
                              {item.counterpart_account_name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-3">
                    <span className={`block font-mono text-xs sm:text-sm ${visuals.amountColor}`}>
                      {isPositive ? '+' : ''}
                      {formatCurrency(
                        numAmt,
                        item.currency,
                        displayProfile.currencyDisplay,
                        displayProfile.locale,
                        displayProfile.decimalPlaces,
                      )}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">
                      {item.currency}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Footer */}
        {total > limit && (
          <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/80 px-4 py-2.5 text-xs text-slate-400">
            <span>
              Showing {Math.min(offset + 1, total)} - {Math.min(offset + limit, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={offset === 0}
                onClick={() => onPageChange(Math.max(0, offset - limit))}
                className="h-7 text-xs border border-slate-700 bg-slate-800 text-slate-300"
              >
                Previous
              </Button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={offset + limit >= total}
                onClick={() => onPageChange(offset + limit)}
                className="h-7 text-xs border border-slate-700 bg-slate-800 text-slate-300"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
