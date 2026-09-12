import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ArrowRightLeft, CheckCircle2, CircleDashed, Tag, Upload } from 'lucide-react';
import { financeService } from '../../services/finance';
import { useCurrencyFormatter } from '../../hooks/useDisplayProfile';
import { formatDate } from '../../utils/dateFormat';
import { useToast } from '../ui/toast';
import type { MatchCandidate } from '../../types/finance';

interface StatementReconciliationProps {
  accountId: string;
  currencyDisplayPreference: 'symbol' | 'code';
  getCategoryTheme?: (catId: string | null) => {
    name: string;
    color: string;
    icon?: string | null;
  };
}

interface ActivityCategoryBadgeProps {
  kind: 'transaction' | 'transfer';
  categoryId?: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  categoryIcon?: string | null;
  leg?: 'from' | 'to' | null;
  getCategoryTheme?: StatementReconciliationProps['getCategoryTheme'];
}

const ActivityCategoryBadge: React.FC<ActivityCategoryBadgeProps> = ({
  kind,
  categoryId,
  categoryName,
  categoryColor,
  categoryIcon,
  leg,
  getCategoryTheme,
}) => {
  if (kind === 'transfer') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-medium text-cyan-400">
        <ArrowRightLeft className="h-2.5 w-2.5" />
        {leg === 'from' ? 'Transfer out' : leg === 'to' ? 'Transfer in' : 'Transfer'}
      </span>
    );
  }

  const theme =
    categoryId && getCategoryTheme
      ? getCategoryTheme(categoryId)
      : {
          name: categoryName || 'Uncategorized',
          color: categoryColor || '#64748b',
          icon: categoryIcon || null,
        };

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        backgroundColor: `${theme.color}20`,
        color: theme.color,
      }}
    >
      {theme.icon ? <span>{theme.icon}</span> : <Tag className="h-2.5 w-2.5" />}
      {theme.name}
    </span>
  );
};

/**
 * Statement matching (spec-078): compares a wallet/bank account's ledger
 * against an imported bank statement. Matching is metadata, never mutation
 * — confirming a match only links a statement line to an existing
 * transaction/transfer; it never creates or edits ledger rows.
 */
export const StatementReconciliation: React.FC<StatementReconciliationProps> = ({
  accountId,
  currencyDisplayPreference,
  getCategoryTheme,
}) => {
  const formatCurrency = useCurrencyFormatter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  // Keyed by accountId so a selection made on one account never leaks into
  // another while this component stays mounted across an account switch.
  const [statementIdOverrides, setStatementIdOverrides] = useState<Record<string, string>>({});
  const statementIdOverride = statementIdOverrides[accountId] ?? '';

  const { data: statements } = useQuery({
    queryKey: ['finance', 'statements', accountId],
    queryFn: () => financeService.getAccountStatements(accountId),
    enabled: !!accountId,
  });

  // Defaults to the most recent statement (list is period_start desc) until
  // the user picks a different one — no effect needed, just a derived value.
  const selectedStatementId =
    statementIdOverride && statements?.some((s) => s.public_id === statementIdOverride)
      ? statementIdOverride
      : statements?.[0]?.public_id ?? '';
  const setSelectedStatementId = (id: string) =>
    setStatementIdOverrides((prev) => ({ ...prev, [accountId]: id }));

  const activeStatement = statements?.find((s) => s.public_id === selectedStatementId) ?? null;

  const { data: reconciliation, isLoading } = useQuery({
    queryKey: ['finance', 'statement-reconciliation', accountId, selectedStatementId],
    queryFn: () => financeService.getStatementReconciliation(accountId, selectedStatementId),
    enabled: !!accountId && !!selectedStatementId,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['finance', 'statements', accountId] });
    void queryClient.invalidateQueries({
      queryKey: ['finance', 'statement-reconciliation', accountId, selectedStatementId],
    });
  };

  const matchMutation = useMutation({
    mutationFn: ({ lineId, candidate }: { lineId: string; candidate: MatchCandidate }) =>
      financeService.confirmStatementLineMatch(accountId, selectedStatementId, lineId, {
        transaction_id: candidate.kind === 'transaction' ? candidate.id : undefined,
        transfer_id: candidate.kind === 'transfer' ? candidate.id : undefined,
        leg: candidate.kind === 'transfer' ? candidate.leg ?? undefined : undefined,
      }),
    onSuccess: () => {
      showToast('Statement line matched', 'success');
      invalidate();
    },
    onError: () => showToast('Match failed. Refresh and retry.', 'error'),
  });

  const unmatchMutation = useMutation({
    mutationFn: (lineId: string) =>
      financeService.unmatchStatementLine(accountId, selectedStatementId, lineId),
    onSuccess: () => {
      showToast('Match cleared', 'success');
      invalidate();
    },
    onError: () => showToast('Unmatch failed. Refresh and retry.', 'error'),
  });

  const currency = activeStatement?.currency_code ?? 'USD';
  const fmt = (v: string | number) =>
    formatCurrency(Number(v), currency, currencyDisplayPreference);

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Statement reconciliation
        </span>
        <Link
          to={`/imports/finance-account-statement?target_account_id=${accountId}&upload=true`}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700/50 bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 transition-colors"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload statement
        </Link>
      </div>

      {!statements || statements.length === 0 ? (
        <p className="text-sm text-slate-500">
          No statements imported yet. Upload a bank statement CSV to reconcile this account against
          an external source of truth.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <select
              data-testid="statement-select"
              value={selectedStatementId}
              onChange={(e) => setSelectedStatementId(e.target.value)}
              className="h-9 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {statements.map((s) => (
                <option key={s.public_id} value={s.public_id}>
                  {formatDate(s.period_start)} – {formatDate(s.period_end)}
                </option>
              ))}
            </select>
            {activeStatement?.closing_balance !== null &&
              activeStatement?.closing_balance !== undefined && (
                <span className="text-xs text-slate-400">
                  Statement closing balance:{' '}
                  <span className="font-mono text-slate-200">
                    {fmt(activeStatement.closing_balance)}
                  </span>
                </span>
              )}
            {activeStatement?.reconciled_through ? (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Reconciled through {formatDate(activeStatement.reconciled_through)}
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                <CircleDashed className="h-3 w-3" />
                Unreconciled
              </span>
            )}
          </div>

          {isLoading ? (
            <p className="text-sm text-slate-500">Loading reconciliation…</p>
          ) : reconciliation ? (
            <div className="space-y-4">
              {reconciliation.unmatched_lines.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">
                    Unmatched statement lines ({reconciliation.unmatched_lines.length})
                  </p>
                  <div className="space-y-2">
                    {reconciliation.unmatched_lines.map(({ line, candidates }) => (
                      <div
                        key={line.public_id}
                        data-testid="statement-unmatched-line"
                        className="flex flex-col gap-2.5 rounded-xl border border-slate-800 bg-slate-800/30 p-3"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-200">
                              {line.description}
                            </p>
                            <p className="text-xs text-slate-500">{formatDate(line.occurred_at)}</p>
                          </div>
                          <span
                            className={`font-mono text-sm font-semibold shrink-0 ${
                              Number(line.amount) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {fmt(line.amount)}
                          </span>
                        </div>

                        {/* Suggested candidate matches */}
                        <div className="border-t border-slate-800/70 pt-2">
                          {candidates.length > 0 ? (
                            <div className="space-y-1.5">
                              <p className="text-[11px] font-medium text-slate-400">
                                Suggested account activity matches:
                              </p>
                              {candidates.map((c) => (
                                <div
                                  key={c.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900/60 px-2.5 py-1.5 border border-slate-800/60"
                                >
                                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                                    <ActivityCategoryBadge
                                      kind={c.kind}
                                      categoryId={c.category_id}
                                      categoryName={c.category_name}
                                      categoryColor={c.category_color}
                                      categoryIcon={c.category_icon}
                                      leg={c.leg}
                                      getCategoryTheme={getCategoryTheme}
                                    />
                                    <span className="text-xs text-slate-300 truncate max-w-[200px] sm:max-w-xs">
                                      {c.description ||
                                        (c.kind === 'transfer' ? 'Transfer' : 'Transaction')}
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                      ({formatDate(c.occurred_at)})
                                    </span>
                                  </div>
                                  <button
                                    data-testid="statement-match-candidate"
                                    onClick={() =>
                                      matchMutation.mutate({ lineId: line.public_id, candidate: c })
                                    }
                                    disabled={matchMutation.isPending || unmatchMutation.isPending}
                                    className="rounded-lg bg-cyan-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-60 transition-colors"
                                    title={`${c.kind} on ${formatDate(c.occurred_at)}: ${fmt(
                                      c.amount,
                                    )}`}
                                  >
                                    Match
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">No candidate found</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reconciliation.matched_lines.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Matched ({reconciliation.matched_lines.length})
                  </p>
                  <div className="space-y-1.5">
                    {reconciliation.matched_lines.map((line) => {
                      const isTransfer = !!line.matched_transfer_id;
                      const hasMatchedMeta =
                        isTransfer ||
                        line.matched_category_id ||
                        line.matched_category_name ||
                        line.matched_description;

                      return (
                        <div
                          key={line.public_id}
                          data-testid="statement-matched-line"
                          className="flex flex-col gap-1 rounded-lg border border-slate-800/60 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span className="text-slate-400 whitespace-nowrap">
                              {formatDate(line.occurred_at)}
                            </span>
                            <span className="truncate text-slate-300 font-medium">
                              {line.description}
                            </span>
                            {hasMatchedMeta ? (
                              <span className="flex items-center gap-1.5 text-slate-400">
                                <span>↔</span>
                                <ActivityCategoryBadge
                                  kind={isTransfer ? 'transfer' : 'transaction'}
                                  categoryId={line.matched_category_id}
                                  categoryName={line.matched_category_name}
                                  categoryColor={line.matched_category_color}
                                  categoryIcon={line.matched_category_icon}
                                  leg={line.matched_transfer_leg}
                                  getCategoryTheme={getCategoryTheme}
                                />
                                {line.matched_description &&
                                  line.matched_description !== line.description && (
                                    <span className="text-slate-400 italic truncate max-w-[150px]">
                                      ({line.matched_description})
                                    </span>
                                  )}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center justify-between gap-3 sm:justify-end">
                            <span className="font-mono text-slate-300">{fmt(line.amount)}</span>
                            <button
                              onClick={() => unmatchMutation.mutate(line.public_id)}
                              disabled={unmatchMutation.isPending || matchMutation.isPending}
                              className="text-slate-500 hover:text-rose-400 transition-colors font-medium"
                            >
                              Unmatch
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {reconciliation.unmatched_ledger_rows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Ledger entries not on the statement (
                    {reconciliation.unmatched_ledger_rows.length})
                  </p>
                  <p className="text-xs text-slate-500">
                    Possible duplicates or entries outside this bank's clearing window.
                  </p>
                  <div className="space-y-1.5">
                    {reconciliation.unmatched_ledger_rows.map((row) => (
                      <div
                        key={row.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-800/60 px-3 py-1.5 text-xs"
                      >
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="text-slate-500 whitespace-nowrap">
                            {formatDate(row.occurred_at)}
                          </span>
                          <ActivityCategoryBadge
                            kind={row.kind}
                            categoryId={row.category_id}
                            categoryName={row.category_name}
                            categoryColor={row.category_color}
                            categoryIcon={row.category_icon}
                            leg={row.leg}
                            getCategoryTheme={getCategoryTheme}
                          />
                          <span className="truncate text-slate-300">
                            {row.description ||
                              (row.kind === 'transfer' ? 'Transfer' : 'Transaction')}
                          </span>
                        </div>
                        <span className="font-mono text-slate-400 shrink-0">{fmt(row.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reconciliation.unmatched_lines.length === 0 &&
                reconciliation.matched_lines.length === 0 && (
                  <p className="text-sm text-slate-500">This statement has no lines.</p>
                )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};
