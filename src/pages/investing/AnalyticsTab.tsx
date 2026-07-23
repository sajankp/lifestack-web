import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  ChevronDown,
  Edit2,
  Layers,
  PieChart,
  Plus,
  Settings2,
  Trash2,
} from 'lucide-react';
import { investingService } from '../../services/investing';
import { useInvalidatingMutation } from '../../hooks/useInvalidatingMutation';
import { formatCurrency, toNumber } from '../../utils/numberFormat';
import { DatePicker } from '../../components/DatePicker';
import { queryKeys } from '../../lib/queryKeys';
import { DropdownSelect } from '../../components/DropdownSelect';
import { Combobox } from '../../components/Combobox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { IdentifierFields, type IdentifierFieldsValue } from './IdentifierFields';
import { useIdentifierHint } from './useIdentifierHint';
import type {
  Instrument,
  InstrumentConstituentUpsert,
  InstrumentCreate,
  InstrumentType,
} from '../../types/investing';
import { formatDateInput, instrumentTypeLabel, instrumentTypeOptions } from './format';

const EMPTY_IDENTITY: IdentifierFieldsValue = { ticker: '', isin: '', exchange: '' };

interface ConstituentRow {
  company_name: string;
  company_ticker: string;
  company_isin: string;
  weight: string;
}

const EMPTY_CONSTITUENT_ROWS: ConstituentRow[] = [
  { company_name: 'Apple Inc', company_ticker: 'AAPL', company_isin: '', weight: '0.60' },
  { company_name: 'Microsoft Corp', company_ticker: 'MSFT', company_isin: '', weight: '0.40' },
];

const extractApiErrorDetail = (error: unknown, fallback: string): string =>
  (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
  (error as Error)?.message ??
  fallback;

const refreshKeys = [queryKeys.investing.all, queryKeys.finance.all, queryKeys.dashboard.all];

// Fixed-order categorical palette (validated for the app's dark surface —
// see .agent/skills dataviz reference). "Other" gets the neutral slate tone
// already used for rollup buckets elsewhere in the app (spending breakdown).
const CONCENTRATION_COLORS = ['#3987e5', '#199e70', '#c98500', '#008300', '#9085e9', '#e66767'];
const CONCENTRATION_OTHER_COLOR = '#94a3b8';
const CONCENTRATION_TOP_N = 6;
const CONCENTRATION_GAP = 3; // svg units between donut segments

interface AnalyticsTabProps {
  currencyDisplayPreference: 'symbol' | 'code';
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ currencyDisplayPreference }) => {
  const [analyticsAsOf, setAnalyticsAsOf] = useState(formatDateInput(new Date()));
  const [isCreateInstrumentModalOpen, setIsCreateInstrumentModalOpen] = useState(false);
  const [isSeedConstituentsModalOpen, setIsSeedConstituentsModalOpen] = useState(false);
  const [instrumentForm, setInstrumentForm] = useState<InstrumentCreate>({
    symbol: '',
    name: '',
    instrument_type: 'etf',
  });
  const [createInstrumentIdentity, setCreateInstrumentIdentity] =
    useState<IdentifierFieldsValue>(EMPTY_IDENTITY);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState('');
  const [constituentRows, setConstituentRows] = useState<ConstituentRow[]>(EMPTY_CONSTITUENT_ROWS);
  const [constituentPasteText, setConstituentPasteText] = useState('');
  const [constituentError, setConstituentError] = useState('');
  // Analytics Advanced instrument edit (spec-010 §3.2): a modal, not inline
  // cells, so it carries the same ticker/isin/exchange fields + hint as
  // Holdings — the two surfaces edit the same Instrument entity.
  const [editingInstrument, setEditingInstrument] = useState<Instrument | null>(null);
  const [instrumentEditForm, setInstrumentEditForm] = useState({
    name: '',
    instrument_type: 'stock' as InstrumentType,
  });
  const [instrumentEditIdentity, setInstrumentEditIdentity] =
    useState<IdentifierFieldsValue>(EMPTY_IDENTITY);

  const instrumentsRes = useQuery({
    queryKey: queryKeys.investing.instruments(),
    queryFn: () => investingService.getInstruments(),
  });
  const instruments = useMemo(() => instrumentsRes.data ?? [], [instrumentsRes.data]);
  const instrumentsLoading = instrumentsRes.isLoading;

  const exposureRes = useQuery({
    queryKey: queryKeys.investing.exposure(analyticsAsOf),
    queryFn: () => investingService.getExposureAnalytics(analyticsAsOf),
  });
  const exposure = exposureRes.data;
  const exposureLoading = exposureRes.isLoading;

  const overlapRes = useQuery({
    queryKey: queryKeys.investing.overlap(analyticsAsOf),
    queryFn: () => investingService.getOverlapAnalytics(analyticsAsOf),
  });
  const overlap = overlapRes.data;
  const overlapLoading = overlapRes.isLoading;

  const analyticsCurrency = exposureRes.data?.currency;

  const sortedExposureRows = useMemo(
    () =>
      [...(exposure?.exposure ?? [])].sort(
        (a, b) => toNumber(b.lookthrough_exposure) - toNumber(a.lookthrough_exposure),
      ),
    [exposure],
  );

  const concentration = useMemo(() => {
    const total = toNumber(exposure?.total_lookthrough_exposure ?? 0);
    if (!sortedExposureRows.length || total <= 0) return { slices: [], total: 0 };

    const top = sortedExposureRows.slice(0, CONCENTRATION_TOP_N);
    const rest = sortedExposureRows.slice(CONCENTRATION_TOP_N);
    const slices = top.map((row, index) => {
      const value = toNumber(row.lookthrough_exposure);
      return {
        key: row.company_id,
        label: row.company_ticker || row.company_name,
        value,
        pct: value / total,
        color: CONCENTRATION_COLORS[index % CONCENTRATION_COLORS.length],
      };
    });
    const restTotal = rest.reduce((sum, row) => sum + toNumber(row.lookthrough_exposure), 0);
    if (restTotal > 0) {
      slices.push({
        key: 'other',
        label: `Other (${rest.length})`,
        value: restTotal,
        pct: restTotal / total,
        color: CONCENTRATION_OTHER_COLOR,
      });
    }
    return { slices, total };
  }, [sortedExposureRows, exposure?.total_lookthrough_exposure]);

  // Seed Constituents has no per-row instrument_type selector — constituent
  // companies are typically underlying stocks, so the shared hint (spec-010
  // §4) is computed for 'stock' and shown once above the rows table.
  const constituentIdentifierHint = useIdentifierHint('stock');

  const pooledInstrumentOptions = useMemo(
    () =>
      (instruments ?? [])
        .filter((item) => item.instrument_type !== 'stock')
        .map((item) => ({
          value: item.public_id,
          label: `${item.symbol} (${item.instrument_type})`,
        })),
    [instruments],
  );

  const createInstrumentMutation = useInvalidatingMutation(
    (payload: InstrumentCreate) => investingService.createInstrument(payload),
    refreshKeys,
    {
      successMessage: 'Instrument created',
      errorMessage: false,
      onSuccess: (created) => {
        setInstrumentForm({
          symbol: '',
          name: '',
          instrument_type: created.instrument_type,
        });
        setCreateInstrumentIdentity(EMPTY_IDENTITY);
        setSelectedInstrumentId(created.public_id);
        setIsCreateInstrumentModalOpen(false);
      },
    },
  );

  const updateInstrumentMutation = useInvalidatingMutation(
    (payload: {
      publicId: string;
      name: string;
      instrument_type: InstrumentType;
      ticker?: string;
      isin?: string;
      exchange?: string;
    }) =>
      investingService.updateInstrument(payload.publicId, {
        name: payload.name,
        instrument_type: payload.instrument_type,
        ticker: payload.ticker,
        isin: payload.isin,
        exchange: payload.exchange,
      }),
    refreshKeys,
    {
      successMessage: 'Instrument updated',
      errorMessage: false,
      onSuccess: () => setEditingInstrument(null),
    },
  );

  const upsertConstituentsMutation = useInvalidatingMutation(
    async (payload: InstrumentConstituentUpsert) => {
      if (!selectedInstrumentId) {
        throw new Error('No instrument selected');
      }
      return investingService.upsertInstrumentConstituents(selectedInstrumentId, payload);
    },
    refreshKeys,
    {
      successMessage: 'Breakdown saved',
      errorMessage: false,
      onSuccess: () => setIsSeedConstituentsModalOpen(false),
    },
  );

  const handleStartEditInstrument = (instrument: Instrument) => {
    setEditingInstrument(instrument);
    setInstrumentEditForm({
      name: instrument.name,
      instrument_type: instrument.instrument_type,
    });
    setInstrumentEditIdentity({
      ticker: instrument.ticker ?? '',
      isin: instrument.isin ?? '',
      exchange: instrument.exchange ?? '',
    });
  };

  const handleSaveInstrument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInstrument || !instrumentEditForm.name.trim()) return;
    updateInstrumentMutation.mutate({
      publicId: editingInstrument.public_id,
      name: instrumentEditForm.name.trim(),
      instrument_type: instrumentEditForm.instrument_type,
      ticker: instrumentEditIdentity.ticker.trim() || undefined,
      isin: instrumentEditIdentity.isin.trim() || undefined,
      exchange: instrumentEditIdentity.exchange.trim() || undefined,
    });
  };

  const onCreateInstrument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!instrumentForm.symbol.trim() || !instrumentForm.name.trim()) return;
    createInstrumentMutation.mutate({
      symbol: instrumentForm.symbol.trim().toUpperCase(),
      name: instrumentForm.name.trim(),
      instrument_type: instrumentForm.instrument_type,
      ticker: createInstrumentIdentity.ticker.trim() || undefined,
      isin: createInstrumentIdentity.isin.trim() || undefined,
      exchange: createInstrumentIdentity.exchange.trim() || undefined,
    });
  };

  const addConstituentRow = () => {
    setConstituentRows((rows) => [
      ...rows,
      { company_name: '', company_ticker: '', company_isin: '', weight: '' },
    ]);
  };

  const removeConstituentRow = (index: number) => {
    setConstituentRows((rows) => rows.filter((_, i) => i !== index));
  };

  const updateConstituentRow = (index: number, patch: Partial<ConstituentRow>) => {
    setConstituentRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  // Convenience paste path (spec-010 §3.3): "Name,Ticker,ISIN,Weight" per
  // line — still parses into the same four structured fields, never
  // collapsing ticker into name or conflating ticker with ISIN.
  const importConstituentPaste = () => {
    const lines = constituentPasteText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return;
    const parsedRows: ConstituentRow[] = lines.map((line) => {
      const [name, ticker, isin, weight] = line.split(',').map((v) => (v ?? '').trim());
      return {
        company_name: name || '',
        company_ticker: (ticker || '').toUpperCase(),
        company_isin: (isin || '').toUpperCase(),
        weight: weight || '',
      };
    });
    setConstituentRows(parsedRows);
    setConstituentPasteText('');
  };

  const onUpsertConstituents = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstrumentId) return;
    setConstituentError('');
    const parsed: Array<{
      company_name: string;
      company_ticker?: string;
      company_isin?: string;
      weight: string;
    }> = [];
    if (!constituentRows.length) {
      setConstituentError('Add at least one constituent row.');
      return;
    }
    for (const row of constituentRows) {
      const name = row.company_name.trim();
      const ticker = row.company_ticker.trim().toUpperCase();
      const isin = row.company_isin.trim().toUpperCase();
      const weightNumber = Number(row.weight);
      const weightOk = Number.isFinite(weightNumber) && weightNumber > 0 && weightNumber <= 1;
      if (!name || (!ticker && !isin) || !weightOk) {
        setConstituentError(
          `Invalid row for "${
            name || 'unnamed'
          }". Company name, a ticker or ISIN, and a weight between 0 and 1 are required.`,
        );
        return;
      }
      parsed.push({
        company_name: name,
        company_ticker: ticker || undefined,
        company_isin: isin || undefined,
        weight: weightNumber.toFixed(8),
      });
    }

    upsertConstituentsMutation.mutate({
      as_of_date: analyticsAsOf,
      fetched_at: new Date().toISOString(),
      source: 'manual-ui',
      constituents: parsed,
    });
  };

  return (
    <>
      <div className="space-y-6">
        <div data-testid="investing-analytics-heading" className="mb-2">
          <h3 className="font-semibold text-white text-base">Analytics</h3>
        </div>

        {/* Instrument/constituent authoring is workspace setup, not a daily
            analytics action — tucked behind an Advanced disclosure so it
            doesn't compete with the read-only analytics below (UX-REVIEW D5). */}
        <details className="group rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <Settings2 className="h-4 w-4" />
              Advanced
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-4 grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto">
            <button
              type="button"
              onClick={() => setIsCreateInstrumentModalOpen(true)}
              className="flex w-full items-center justify-center gap-1 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-cyan-500 sm:w-auto"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Instrument
            </button>
            <button
              type="button"
              onClick={() => setIsSeedConstituentsModalOpen(true)}
              className="flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 sm:w-auto"
            >
              <Plus className="h-3.5 w-3.5" />
              Seed Constituents
            </button>
          </div>
        </details>

        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-1 space-y-4">
            <div className="space-y-4 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4">
              <h3 className="font-semibold text-white">Analytics Controls</h3>
              <label className="block text-xs text-slate-300">
                As of date
                <DatePicker
                  value={analyticsAsOf}
                  onChange={setAnalyticsAsOf}
                  placeholder="Select date"
                  className="mt-1"
                />
              </label>
              <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3 text-xs text-slate-300">
                <p>Coverage: {exposure?.snapshot_coverage ?? 'N/A'}</p>
                <p>Status: {exposure?.analysis_status ?? 'N/A'}</p>
                {!!exposure?.warnings?.length && (
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-amber-300">
                    {/* Dedupe: the API can repeat a warning (e.g. the same fund
                        missing a constituent snapshot), which also produced
                        duplicate React keys (UX review Real-Data #2). */}
                    {[...new Set(exposure.warnings)].map((warning) => (
                      <li key={warning} data-testid="analytics-warning-item">
                        {warning}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="space-y-2 rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold uppercase text-slate-400">Instruments</h4>
                  <span className="text-xs text-slate-500">{instruments.length}</span>
                </div>
                <div className="max-h-64 overflow-auto rounded border border-slate-700/40">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-800/60 text-slate-400">
                      <tr>
                        <th className="px-2 py-1.5">Symbol</th>
                        <th className="px-2 py-1.5">Type</th>
                        <th className="px-2 py-1.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {instruments.length === 0 ? (
                        <tr>
                          <td className="px-2 py-2 text-slate-500" colSpan={3}>
                            No instruments yet.
                          </td>
                        </tr>
                      ) : (
                        instruments.map((instrument) => (
                          <tr key={instrument.public_id} className="border-t border-slate-700/40">
                            <td className="px-2 py-1.5 font-medium text-slate-100">
                              {instrument.symbol}
                            </td>
                            <td className="px-2 py-1.5">
                              {instrumentTypeLabel(instrument.instrument_type)}
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <button
                                type="button"
                                data-testid={`investing-edit-instrument-${instrument.public_id}`}
                                onClick={() => handleStartEditInstrument(instrument)}
                                className="rounded p-1 text-slate-400 hover:bg-slate-700/60 hover:text-white"
                                title="Edit instrument"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4">
            <div className="mb-3 flex items-center gap-2 text-slate-100">
              <Layers className="h-4 w-4" />
              <h3 className="font-semibold">Exposure (Look-through)</h3>
            </div>
            {exposureLoading ? (
              <p className="text-sm text-slate-400">Loading exposure…</p>
            ) : (
              <div className="space-y-2 text-sm text-slate-300">
                <p data-testid="investing-total-direct">
                  Total direct:{' '}
                  {exposure?.total_direct_exposure != null && analyticsCurrency
                    ? formatCurrency(
                        exposure.total_direct_exposure,
                        analyticsCurrency,
                        currencyDisplayPreference,
                      )
                    : 'N/A'}
                </p>
                <p data-testid="investing-total-lookthrough">
                  Total look-through:{' '}
                  {exposure?.total_lookthrough_exposure != null && analyticsCurrency
                    ? formatCurrency(
                        exposure.total_lookthrough_exposure,
                        analyticsCurrency,
                        currencyDisplayPreference,
                      )
                    : 'N/A'}
                </p>
                {/* The full warning list already renders in Analytics Controls;
                    repeating it here doubled half the page with real data
                    (UX review Real-Data scale finding) — show one summary line. */}
                {!!exposure?.warnings?.length && (
                  <p data-testid="analytics-warnings-summary" className="text-xs text-amber-300">
                    {new Set(exposure.warnings).size} data warning
                    {new Set(exposure.warnings).size === 1 ? '' : 's'} — see Analytics Controls
                    for details.
                  </p>
                )}
                {exposure && (
                  <p className="text-xs text-slate-500">
                    Showing constituents at or above {exposure.display_threshold_pct}% of the
                    portfolio
                    {exposure.hidden_exposure_count > 0
                      ? ` (${exposure.hidden_exposure_count} smaller constituents hidden)`
                      : ''}
                    .
                  </p>
                )}
                {concentration.slices.length > 0 && (
                  <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-4">
                    <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
                      <PieChart className="h-3.5 w-3.5" />
                      Concentration
                    </h4>
                    <div className="flex flex-col items-center gap-6 sm:flex-row">
                      <div
                        className="relative h-32 w-32 flex-shrink-0"
                        data-testid="investing-concentration-donut"
                      >
                        <svg className="h-full w-full" viewBox="0 0 200 200">
                          {(() => {
                            const circumference = 2 * Math.PI * 60;
                            // A single slice (100% in one holding) must render as a
                            // continuous ring — subtracting the inter-segment gap
                            // would leave a small broken notch.
                            const gap = concentration.slices.length > 1 ? CONCENTRATION_GAP : 0;
                            let cumulative = 0;
                            return concentration.slices.map((slice) => {
                              const sliceLength = slice.pct * circumference;
                              const dash = Math.max(sliceLength - gap, 0);
                              const offset = -cumulative;
                              cumulative += sliceLength;
                              return (
                                <circle
                                  key={slice.key}
                                  cx={100}
                                  cy={100}
                                  r={60}
                                  fill="transparent"
                                  stroke={slice.color}
                                  strokeWidth="14"
                                  strokeDasharray={`${dash} ${circumference}`}
                                  strokeDashoffset={offset}
                                  transform="rotate(-90 100 100)"
                                >
                                  <title>{`${slice.label}: ${(slice.pct * 100).toFixed(
                                    1,
                                  )}%`}</title>
                                </circle>
                              );
                            });
                          })()}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                            Total
                          </span>
                          <span className="text-xs font-extrabold text-white">
                            {analyticsCurrency
                              ? formatCurrency(
                                  concentration.total,
                                  analyticsCurrency,
                                  currencyDisplayPreference,
                                )
                              : 'N/A'}
                          </span>
                        </div>
                      </div>
                      <div className="w-full flex-1 space-y-1.5">
                        {concentration.slices.map((slice) => (
                          <div
                            key={slice.key}
                            className="flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span
                                className="h-2.5 w-2.5 flex-shrink-0 rounded"
                                style={{ backgroundColor: slice.color }}
                              />
                              <span className="truncate font-medium text-slate-300">
                                {slice.label}
                              </span>
                            </div>
                            <span className="flex-shrink-0 font-semibold text-slate-400">
                              {(slice.pct * 100).toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div className="max-h-96 overflow-auto rounded-lg border border-slate-700/40">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800/60 text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Company</th>
                        <th className="px-3 py-2">Direct</th>
                        <th className="px-3 py-2">Look-through</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedExposureRows.map((row) => (
                        <tr key={row.company_id} className="border-t border-slate-700/40">
                          <td className="px-3 py-2">{row.company_ticker ?? row.company_name}</td>
                          <td className="px-3 py-2">
                            {analyticsCurrency
                              ? formatCurrency(
                                  row.direct_exposure,
                                  analyticsCurrency,
                                  currencyDisplayPreference,
                                )
                              : 'N/A'}
                          </td>
                          <td className="px-3 py-2">
                            {analyticsCurrency
                              ? formatCurrency(
                                  row.lookthrough_exposure,
                                  analyticsCurrency,
                                  currencyDisplayPreference,
                                )
                              : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-1 rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4">
            <div className="mb-3 flex items-center gap-2 text-slate-100">
              <BarChart3 className="h-4 w-4" />
              <h3 className="font-semibold">Overlap</h3>
            </div>
            {overlapLoading ? (
              <p className="text-sm text-slate-400">Loading overlap…</p>
            ) : (
              <div className="space-y-2 text-sm text-slate-300">
                <p>
                  Top 5 concentration:{' '}
                  {(toNumber(overlap?.top_5_concentration_pct ?? 0) * 100).toFixed(2)}%
                </p>
                <p>
                  Duplicate exposure index:{' '}
                  {(toNumber(overlap?.duplicate_exposure_index ?? 0) * 100).toFixed(2)}%
                </p>
                <ol className="space-y-1 text-xs">
                  {(overlap?.overlaps ?? []).slice(0, 8).map((row) => (
                    <li
                      key={row.company_id}
                      className="flex items-center justify-between rounded border border-slate-700/50 px-2 py-1"
                    >
                      <span>{row.company_ticker ?? row.company_name}</span>
                      <span>{(toNumber(row.portfolio_share) * 100).toFixed(2)}%</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Instrument Modal */}
      <Dialog
        open={isCreateInstrumentModalOpen}
        onOpenChange={(open) => !open && setIsCreateInstrumentModalOpen(false)}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4 mb-4 border-b border-slate-800">
            <DialogTitle>Create Instrument</DialogTitle>
          </DialogHeader>
          {isCreateInstrumentModalOpen && (
            <form onSubmit={onCreateInstrument} className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-300">Symbol (e.g. VTI)</label>
                <input
                  className="w-full h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="Symbol (e.g. VTI)"
                  value={instrumentForm.symbol}
                  onChange={(e) => setInstrumentForm((s) => ({ ...s, symbol: e.target.value }))}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-300">Name</label>
                <input
                  className="w-full h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="Name"
                  value={instrumentForm.name}
                  onChange={(e) => setInstrumentForm((s) => ({ ...s, name: e.target.value }))}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-300">Instrument Type</label>
                <DropdownSelect
                  value={instrumentForm.instrument_type}
                  options={instrumentTypeOptions}
                  onChange={(value) =>
                    setInstrumentForm((s) => ({
                      ...s,
                      instrument_type: value as InstrumentCreate['instrument_type'],
                    }))
                  }
                  placeholder="Instrument type"
                />
              </div>

              <IdentifierFields
                idPrefix="investing-create-instrument"
                value={createInstrumentIdentity}
                onChange={setCreateInstrumentIdentity}
                instrumentType={instrumentForm.instrument_type}
              />

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateInstrumentModalOpen(false)}
                  className="flex-1 h-10 rounded-lg border border-slate-700 bg-slate-900 px-4 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  disabled={createInstrumentMutation.isPending}
                  type="submit"
                  className="flex-1 h-10 rounded-lg bg-cyan-600 px-4 text-xs font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                >
                  {createInstrumentMutation.isPending ? 'Creating...' : 'Create instrument'}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2 text-center">
                Instruments: {instrumentsLoading ? 'Loading...' : instruments.length}
              </p>
              {createInstrumentMutation.isError && (
                <p className="text-xs text-rose-300 text-center">
                  {extractApiErrorDetail(
                    createInstrumentMutation.error,
                    'Failed to create instrument',
                  )}
                </p>
              )}
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Instrument Modal (spec-010 §3.2) — demoted correction path for
          pooled instruments with no Holding row; primary path is Holdings. */}
      <Dialog
        open={!!editingInstrument}
        onOpenChange={(open) => !open && setEditingInstrument(null)}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4 mb-4 border-b border-slate-800">
            <DialogTitle>Edit Instrument</DialogTitle>
          </DialogHeader>
          {editingInstrument && (
            <form onSubmit={handleSaveInstrument} className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-300">Name</label>
                <input
                  data-testid="investing-edit-instrument-name"
                  className="w-full h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  value={instrumentEditForm.name}
                  onChange={(e) => setInstrumentEditForm((s) => ({ ...s, name: e.target.value }))}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-300">Instrument Type</label>
                <DropdownSelect
                  testId="investing-edit-instrument-type"
                  value={instrumentEditForm.instrument_type}
                  options={instrumentTypeOptions}
                  onChange={(value) =>
                    setInstrumentEditForm((s) => ({
                      ...s,
                      instrument_type: value as InstrumentType,
                    }))
                  }
                  placeholder="Type"
                />
              </div>

              <IdentifierFields
                idPrefix="investing-edit-instrument"
                value={instrumentEditIdentity}
                onChange={setInstrumentEditIdentity}
                instrumentType={instrumentEditForm.instrument_type}
              />

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingInstrument(null)}
                  className="flex-1 h-10 rounded-lg border border-slate-700 bg-slate-900 px-4 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  data-testid="investing-edit-instrument-submit"
                  disabled={updateInstrumentMutation.isPending}
                  type="submit"
                  className="flex-1 h-10 rounded-lg bg-cyan-600 px-4 text-xs font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                >
                  {updateInstrumentMutation.isPending ? 'Saving...' : 'Save instrument'}
                </button>
              </div>
              {updateInstrumentMutation.isError && (
                <p
                  className="text-xs text-rose-300 text-center"
                  data-testid="investing-edit-instrument-error"
                >
                  {extractApiErrorDetail(
                    updateInstrumentMutation.error,
                    'Failed to update instrument',
                  )}
                </p>
              )}
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Seed Constituents Modal */}
      <Dialog
        open={isSeedConstituentsModalOpen}
        onOpenChange={(open) => !open && setIsSeedConstituentsModalOpen(false)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4 mb-4 border-b border-slate-800">
            <DialogTitle>Seed Constituents</DialogTitle>
          </DialogHeader>
          {isSeedConstituentsModalOpen && (
            <form onSubmit={onUpsertConstituents} className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-300">
                  Select Pooled Instrument
                </label>
                <Combobox
                  value={selectedInstrumentId}
                  options={pooledInstrumentOptions}
                  onChange={setSelectedInstrumentId}
                  placeholder="Select pooled instrument"
                  searchPlaceholder="Search instruments..."
                  clearLabel="Clear selection"
                  emptyText="No pooled instruments found."
                />
              </div>

              {/* Company name and ticker/ISIN are captured as separate fields
                  — never overloading name with the ticker (this was the
                  api spec-083 §1.2 bug: company_name = ticker). */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">Constituents</label>
                  <button
                    type="button"
                    onClick={addConstituentRow}
                    className="inline-flex items-center gap-1 rounded p-1 text-xs text-cyan-300 hover:bg-cyan-500/10"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add row
                  </button>
                </div>
                <p
                  className="text-xs text-slate-400"
                  data-testid="investing-seed-constituents-hint"
                >
                  {constituentIdentifierHint.helperText} ISIN is always accepted and preferred when
                  known.
                </p>
                <div className="space-y-2">
                  {constituentRows.map((row, index) => (
                    <div key={index} className="grid grid-cols-[2fr_1fr_1.2fr_0.8fr_auto] gap-2">
                      <input
                        data-testid={`investing-constituent-name-${index}`}
                        className="h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                        placeholder="Company name"
                        value={row.company_name}
                        onChange={(e) =>
                          updateConstituentRow(index, { company_name: e.target.value })
                        }
                      />
                      <input
                        data-testid={`investing-constituent-ticker-${index}`}
                        className="h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                        placeholder="Ticker"
                        value={row.company_ticker}
                        onChange={(e) =>
                          updateConstituentRow(index, {
                            company_ticker: e.target.value.toUpperCase(),
                          })
                        }
                      />
                      <input
                        data-testid={`investing-constituent-isin-${index}`}
                        className="h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                        placeholder="ISIN"
                        value={row.company_isin}
                        onChange={(e) =>
                          updateConstituentRow(index, {
                            company_isin: e.target.value.toUpperCase(),
                          })
                        }
                      />
                      <input
                        data-testid={`investing-constituent-weight-${index}`}
                        className="h-9 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                        placeholder="Weight"
                        value={row.weight}
                        onChange={(e) => updateConstituentRow(index, { weight: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => removeConstituentRow(index)}
                        className="rounded p-1.5 text-rose-300 hover:bg-rose-500/10"
                        title="Remove row"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                {constituentError ? (
                  <p className="text-xs text-rose-300">{constituentError}</p>
                ) : null}
              </div>

              <details className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-slate-300">
                  Paste as CSV (name,ticker,isin,weight)
                </summary>
                <div className="mt-2 space-y-2">
                  <textarea
                    className="h-20 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none font-mono"
                    value={constituentPasteText}
                    onChange={(e) => setConstituentPasteText(e.target.value)}
                    placeholder="Apple Inc,AAPL,,0.60&#10;Microsoft Corp,MSFT,,0.40"
                  />
                  <button
                    type="button"
                    onClick={importConstituentPaste}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700"
                  >
                    Import into rows
                  </button>
                </div>
              </details>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsSeedConstituentsModalOpen(false)}
                  className="flex-1 h-10 rounded-lg border border-slate-700 bg-slate-900 px-4 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  disabled={upsertConstituentsMutation.isPending}
                  type="submit"
                  className="flex-1 h-10 rounded-lg bg-cyan-600 px-4 text-xs font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                >
                  {upsertConstituentsMutation.isPending ? 'Saving...' : 'Save breakdown'}
                </button>
              </div>
              {upsertConstituentsMutation.isError && (
                <p className="text-xs text-rose-300 text-center">
                  {extractApiErrorDetail(
                    upsertConstituentsMutation.error,
                    'Failed to save breakdown',
                  )}
                </p>
              )}
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
