import React from 'react';
import { ArrowRightLeft, Edit2, Trash2 } from 'lucide-react';
import { Pagination } from '../../components/Pagination';
import { AccountTypeBadge } from '../../components/finance/Badges';
import { formatCurrency } from '../../utils/numberFormat';
import { formatDate } from '../../utils/dateFormat';
import type { PaginatedResponse } from '../../types/common';
import type { CapitalTransfer } from '../../types/finance';

interface TransfersTabProps {
  transferItems: CapitalTransfer[];
  transfersResponse: PaginatedResponse<CapitalTransfer> | undefined;
  currencyDisplayPreference: 'symbol' | 'code';
  onEdit: (t: CapitalTransfer) => void;
  onRequestDelete: (t: CapitalTransfer) => void;
  onPageChange: (offset: number) => void;
}

export const TransfersTab: React.FC<TransfersTabProps> = ({
  transferItems,
  transfersResponse,
  currencyDisplayPreference,
  onEdit,
  onRequestDelete,
  onPageChange,
}) => {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <h3 className="text-xl font-semibold text-white">Transfer History</h3>
      {transferItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-800/30 p-12 text-center">
          <div className="mb-4 rounded-full bg-slate-800 p-4">
            <ArrowRightLeft className="h-8 w-8 text-slate-500" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-white">No transfers yet</h3>
          <p className="text-slate-400">Create an account-to-account transfer from the Transfer button above.</p>
        </div>
      ) : (
        <>
        {/* Mobile / tablet card list */}
        <div className="space-y-3 lg:hidden">
          {transferItems.map((t) => (
            <div
              key={t.public_id}
              className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4 backdrop-blur-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs text-slate-400">{formatDate(t.occurred_at, { fallback: 'N/A' })}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onEdit(t)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                    title="Edit transfer"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onRequestDelete(t)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-900/40 hover:text-red-400"
                    title="Delete transfer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex max-w-[130px] truncate rounded-full bg-slate-700/60 px-2.5 py-1 text-xs text-slate-200">
                  {t.from_account_name ?? `Account #${t.from_account_id}`}
                </span>
                {t.from_account_type ? <AccountTypeBadge type={t.from_account_type} /> : null}
                <ArrowRightLeft className="h-3.5 w-3.5 text-slate-500" />
                <span className="inline-flex max-w-[130px] truncate rounded-full bg-slate-700/60 px-2.5 py-1 text-xs text-slate-200">
                  {t.to_account_name ?? `Account #${t.to_account_id}`}
                </span>
                {t.to_account_type ? <AccountTypeBadge type={t.to_account_type} /> : null}
              </div>

              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="text-xs text-slate-400">
                  <div>Gross</div>
                  <div className="text-sm font-medium text-slate-200">
                    {formatCurrency(Number(t.gross_amount), t.from_currency_code, currencyDisplayPreference)}
                  </div>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <div>Net received</div>
                  <div className="text-sm font-semibold text-slate-100">
                    {formatCurrency(Number(t.net_amount_received), t.to_currency_code, currencyDisplayPreference)}
                  </div>
                </div>
              </div>

              {t.fx_rate_used ? (
                <div className="mt-2">
                  <span className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2 py-0.5 text-[11px] text-indigo-300">
                    FX {t.fx_rate_used}
                  </span>
                </div>
              ) : null}
              {t.notes ? <p className="mt-2 text-sm text-slate-400">{t.notes}</p> : null}
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto rounded-2xl border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm lg:block">
          <table className="w-full text-left text-sm text-slate-300 min-w-[700px]">
            <thead className="border-b border-slate-700/50 bg-slate-800/50 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Flow</th>
                <th className="px-6 py-4 text-right font-medium">Gross</th>
                <th className="px-6 py-4 text-right font-medium">Net</th>
                <th className="px-6 py-4 font-medium">Notes</th>
                <th className="px-6 py-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {transferItems.map((t) => (
                <tr key={t.public_id} className="transition-colors hover:bg-slate-700/30">
                  <td className="whitespace-nowrap px-6 py-4">
                    {formatDate(t.occurred_at, { fallback: 'N/A' })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex max-w-[160px] truncate rounded-full bg-slate-700/60 px-2.5 py-1 text-xs text-slate-200">
                          {t.from_account_name ?? `Account #${t.from_account_id}`}
                        </span>
                        {t.from_account_type ? <AccountTypeBadge type={t.from_account_type} /> : null}
                        <span className="text-slate-500">→</span>
                        <span className="inline-flex max-w-[160px] truncate rounded-full bg-slate-700/60 px-2.5 py-1 text-xs text-slate-200">
                          {t.to_account_name ?? `Account #${t.to_account_id}`}
                        </span>
                        {t.to_account_type ? <AccountTypeBadge type={t.to_account_type} /> : null}
                      </div>
                      {t.fx_rate_used ? (
                        <div className="flex flex-wrap gap-1">
                          <span className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2 py-0.5 text-[11px] text-indigo-300">
                            FX {t.fx_rate_used}
                          </span>
                          {(Number(t.fx_fee_amount) > 0 || Number(t.platform_fee_amount) > 0 || Number(t.tax_amount) > 0) ? (
                            <span
                              title="Total of FX, platform, and tax fees on this transfer"
                              className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300"
                            >
                              Fees {formatCurrency(
                                Number(t.fx_fee_amount ?? 0) + Number(t.platform_fee_amount ?? 0) + Number(t.tax_amount ?? 0),
                                t.from_currency_code,
                                currencyDisplayPreference,
                              )}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {formatCurrency(Number(t.gross_amount), t.from_currency_code, currencyDisplayPreference)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {formatCurrency(Number(t.net_amount_received), t.to_currency_code, currencyDisplayPreference)}
                  </td>
                  <td className="px-6 py-4">
                    <p className="truncate max-w-[280px] text-slate-400">{t.notes || '-'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEdit(t)}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                        title="Edit transfer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onRequestDelete(t)}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-900/40 hover:text-red-400 transition-colors"
                        title="Delete transfer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
      {transfersResponse && (
        <Pagination
          total={transfersResponse.total}
          limit={transfersResponse.limit}
          offset={transfersResponse.offset}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
};
