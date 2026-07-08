import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Check, Edit2, Layers, Plus, X } from 'lucide-react';
import { investingService } from '../../services/investing';
import { useInvalidatingMutation } from '../../hooks/useInvalidatingMutation';
import { formatCurrency, toNumber } from '../../utils/numberFormat';
import { DatePicker } from '../../components/DatePicker';
import { queryKeys } from '../../lib/queryKeys';
import { DropdownSelect } from '../../components/DropdownSelect';
import { Combobox } from '../../components/Combobox';
import type {
  Instrument,
  InstrumentConstituentUpsert,
  InstrumentCreate,
  InstrumentType,
} from '../../types/investing';
import { formatDateInput, instrumentTypeLabel, instrumentTypeOptions } from './format';

const refreshKeys = [queryKeys.investing.all, queryKeys.finance.all, queryKeys.dashboard.all];

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
  const [selectedInstrumentId, setSelectedInstrumentId] = useState('');
  const [constituentRowsText, setConstituentRowsText] = useState('AAPL,0.60\nMSFT,0.40');
  const [constituentError, setConstituentError] = useState('');
  const [editingInstrumentId, setEditingInstrumentId] = useState<string | null>(null);
  const [instrumentEditForm, setInstrumentEditForm] = useState({
    name: '',
    instrument_type: 'stock' as InstrumentType,
  });

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

  const pooledInstrumentOptions = useMemo(
    () =>
      (instruments ?? [])
        .filter((item) => item.instrument_type !== 'stock')
        .map((item) => ({
          value: item.public_id,
          label: `${item.symbol} (${item.instrument_type})`,
        })),
    [instruments]
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
        setSelectedInstrumentId(created.public_id);
        setIsCreateInstrumentModalOpen(false);
      },
    },
  );

  const updateInstrumentMutation = useInvalidatingMutation(
    (payload: { publicId: string; name: string; instrument_type: InstrumentType }) =>
      investingService.updateInstrument(payload.publicId, {
        name: payload.name,
        instrument_type: payload.instrument_type,
      }),
    refreshKeys,
    { successMessage: 'Instrument updated', onSuccess: () => setEditingInstrumentId(null) },
  );

  const upsertConstituentsMutation = useInvalidatingMutation(
    async (payload: InstrumentConstituentUpsert) => {
      if (!selectedInstrumentId) {
        throw new Error('No instrument selected');
      }
      return investingService.upsertInstrumentConstituents(selectedInstrumentId, payload);
    },
    refreshKeys,
    { successMessage: 'Breakdown saved', errorMessage: false, onSuccess: () => setIsSeedConstituentsModalOpen(false) },
  );

  const handleStartEditInstrument = (instrument: Instrument) => {
    setEditingInstrumentId(instrument.public_id);
    setInstrumentEditForm({
      name: instrument.name,
      instrument_type: instrument.instrument_type,
    });
  };

  const handleSaveInstrument = (instrument: Instrument) => {
    if (!instrumentEditForm.name.trim()) return;
    updateInstrumentMutation.mutate({
      publicId: instrument.public_id,
      name: instrumentEditForm.name.trim(),
      instrument_type: instrumentEditForm.instrument_type,
    });
  };

  const onCreateInstrument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!instrumentForm.symbol.trim() || !instrumentForm.name.trim()) return;
    createInstrumentMutation.mutate({
      symbol: instrumentForm.symbol.trim().toUpperCase(),
      name: instrumentForm.name.trim(),
      instrument_type: instrumentForm.instrument_type,
    });
  };

  const onUpsertConstituents = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstrumentId) return;
    setConstituentError('');
    const parsed: Array<{ company_name: string; company_ticker: string; weight: string }> = [];
    const lines = constituentRowsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) {
      setConstituentError('Add at least one constituent row in format: TICKER,0.25');
      return;
    }
    for (const line of lines) {
      const [tickerRaw, weightRaw] = line.split(',').map((v) => v.trim());
      const ticker = (tickerRaw || '').toUpperCase();
      const weightNumber = Number(weightRaw);
      const tickerOk = /^[A-Z0-9.-]{1,20}$/.test(ticker);
      const weightOk = Number.isFinite(weightNumber) && weightNumber > 0 && weightNumber <= 1;
      if (!tickerOk || !weightOk) {
        setConstituentError(
          `Invalid row "${line}". Use TICKER,WEIGHT with weight between 0 and 1.`,
        );
        return;
      }
      parsed.push({
        company_name: ticker,
        company_ticker: ticker,
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
        <div data-testid="investing-analytics-heading" className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-semibold text-white text-base">Analytics</h3>
          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto">
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
        </div>

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
                    {exposure.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
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
                          <td className="px-2 py-2 text-slate-500" colSpan={3}>No instruments yet.</td>
                        </tr>
                      ) : (
                        instruments.map((instrument) => (
                          <tr key={instrument.public_id} className="border-t border-slate-700/40">
                            <td className="px-2 py-1.5 font-medium text-slate-100">
                              {editingInstrumentId === instrument.public_id ? (
                                <input
                                  className="w-28 rounded border border-slate-600 bg-slate-950 px-1.5 py-1 text-xs text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                  value={instrumentEditForm.name}
                                  onChange={(e) =>
                                    setInstrumentEditForm((s) => ({ ...s, name: e.target.value }))
                                  }
                                />
                              ) : (
                                instrument.symbol
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              {editingInstrumentId === instrument.public_id ? (
                                <DropdownSelect
                                  value={instrumentEditForm.instrument_type}
                                  options={[...instrumentTypeOptions]}
                                  onChange={(value) =>
                                    setInstrumentEditForm((s) => ({
                                      ...s,
                                      instrument_type: value as InstrumentType,
                                    }))
                                  }
                                  placeholder="Type"
                                />
                              ) : (
                                instrumentTypeLabel(instrument.instrument_type)
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              {editingInstrumentId === instrument.public_id ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveInstrument(instrument)}
                                    disabled={updateInstrumentMutation.isPending}
                                    className="rounded p-1 text-green-300 hover:bg-green-500/10 disabled:opacity-60"
                                    title="Save instrument"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingInstrumentId(null)}
                                    className="rounded p-1 text-rose-300 hover:bg-rose-500/10"
                                    title="Cancel"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleStartEditInstrument(instrument)}
                                  className="rounded p-1 text-slate-400 hover:bg-slate-700/60 hover:text-white"
                                  title="Edit instrument"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                              )}
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
                    ? formatCurrency(exposure.total_direct_exposure, analyticsCurrency, currencyDisplayPreference)
                    : 'N/A'}
                </p>
                <p data-testid="investing-total-lookthrough">
                  Total look-through:{' '}
                  {exposure?.total_lookthrough_exposure != null && analyticsCurrency
                    ? formatCurrency(exposure.total_lookthrough_exposure, analyticsCurrency, currencyDisplayPreference)
                    : 'N/A'}
                </p>
                {(exposure?.warnings ?? []).map((warning, index) => (
                  <p key={`${warning}-${index}`} className="text-xs text-amber-300">{warning}</p>
                ))}
                {exposure && (
                  <p className="text-xs text-slate-500">
                    Showing constituents at or above {exposure.display_threshold_pct}% of the
                    portfolio
                    {exposure.hidden_exposure_count > 0
                      ? ` (${exposure.hidden_exposure_count} smaller constituents hidden)`
                      : ''}.
                  </p>
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
                      {(exposure?.exposure ?? []).map((row) => (
                        <tr key={row.company_id} className="border-t border-slate-700/40">
                          <td className="px-3 py-2">{row.company_ticker ?? row.company_name}</td>
                          <td className="px-3 py-2">{analyticsCurrency ? formatCurrency(row.direct_exposure, analyticsCurrency, currencyDisplayPreference) : 'N/A'}</td>
                          <td className="px-3 py-2">{analyticsCurrency ? formatCurrency(row.lookthrough_exposure, analyticsCurrency, currencyDisplayPreference) : 'N/A'}</td>
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
                <p>Top 5 concentration: {(toNumber(overlap?.top_5_concentration_pct ?? 0) * 100).toFixed(2)}%</p>
                <p>Duplicate exposure index: {(toNumber(overlap?.duplicate_exposure_index ?? 0) * 100).toFixed(2)}%</p>
                <ol className="space-y-1 text-xs">
                  {(overlap?.overlaps ?? []).slice(0, 8).map((row) => (
                    <li key={row.company_id} className="flex items-center justify-between rounded border border-slate-700/50 px-2 py-1">
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
      {isCreateInstrumentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setIsCreateInstrumentModalOpen(false)}
          />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h2 className="text-lg font-semibold text-white">Create Instrument</h2>
              <button
                type="button"
                onClick={() => setIsCreateInstrumentModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                title="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

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
                  options={[...instrumentTypeOptions]}
                  onChange={(value) =>
                    setInstrumentForm((s) => ({
                      ...s,
                      instrument_type: value as InstrumentCreate['instrument_type'],
                    }))
                  }
                  placeholder="Instrument type"
                />
              </div>

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
                  {(createInstrumentMutation.error as Error)?.message ?? 'Failed to create instrument'}
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Seed Constituents Modal */}
      {isSeedConstituentsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setIsSeedConstituentsModalOpen(false)}
          />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h2 className="text-lg font-semibold text-white">Seed Constituents</h2>
              <button
                type="button"
                onClick={() => setIsSeedConstituentsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                title="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={onUpsertConstituents} className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-300">Select Pooled Instrument</label>
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

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-300">Constituents (TICKER,WEIGHT)</label>
                <textarea
                  className="h-28 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                  value={constituentRowsText}
                  onChange={(e) => setConstituentRowsText(e.target.value)}
                  placeholder="AAPL,0.60&#10;MSFT,0.40"
                />
                {constituentError ? <p className="text-xs text-rose-300">{constituentError}</p> : null}
              </div>

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
                  {(upsertConstituentsMutation.error as Error)?.message ?? 'Failed to save breakdown'}
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
};
