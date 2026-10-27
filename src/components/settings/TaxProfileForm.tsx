import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { investingService } from '../../services/investing';
import { useToast } from '../../components/ui/toast';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';

type FxOverrideRow = {
  id: number;
  month: string;
  rate: string;
  error?: string;
};

export const TaxProfileForm: React.FC = () => {
  const { data: profile, isLoading, error: loadError } = useQuery({
    queryKey: ['tax-profile'],
    queryFn: investingService.getTaxProfile,
  });

  const { showToast } = useToast();

  const [residentStatus, setResidentStatus] = useState('resident');
  const [taxRegime, setTaxRegime] = useState('new');
  const [otherIncome, setOtherIncome] = useState('0');
  const [explicitRegime, setExplicitRegime] = useState('');
  const [slabOverride, setSlabOverride] = useState('');
  const [surchargeOverride, setSurchargeOverride] = useState('');
  const [cessPct, setCessPct] = useState('4');
  const [applyCarryForward, setApplyCarryForward] = useState(true);
  const [notes, setNotes] = useState('');
  const [fxOverrides, setFxOverrides] = useState<FxOverrideRow[]>([]);
  const [nextFxId, setNextFxId] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [fxOpen, setFxOpen] = useState(false);

  const initialValues = {
    resident_status: 'resident',
    tax_regime: 'new',
    other_income: '0',
    explicit_regime: '',
    slab_override_pct: null,
    surcharge_override_pct: null,
    cess_pct: '4',
    apply_carry_forward: true,
    fx_overrides: {} as Record<string, string>,
    notes: null,
  };

  // Track initial fx_overrides for comparison
  const [initialFxOverrides, setInitialFxOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profile) {
      setResidentStatus(profile.resident_status);
      setTaxRegime(profile.tax_regime);
      setOtherIncome(profile.other_income);
      setExplicitRegime(profile.explicit_regime ?? '');
      setSlabOverride(profile.slab_override_pct ?? '');
      setSurchargeOverride(profile.surcharge_override_pct ?? '');
      setCessPct(profile.cess_pct);
      setApplyCarryForward(profile.apply_carry_forward);
      setNotes(profile.notes ?? '');

      const fxRows: FxOverrideRow[] = Object.entries(profile.fx_overrides).map(([month, rate], idx) => ({
        id: idx,
        month,
        rate,
      }));
      setFxOverrides(fxRows);
      setNextFxId(fxRows.length);
      setInitialFxOverrides(profile.fx_overrides);
    } else {
      setResidentStatus(initialValues.resident_status);
      setTaxRegime(initialValues.tax_regime);
      setOtherIncome(initialValues.other_income);
      setExplicitRegime(initialValues.explicit_regime);
      setSlabOverride(initialValues.slab_override_pct ?? '');
      setSurchargeOverride(initialValues.surcharge_override_pct ?? '');
      setCessPct(initialValues.cess_pct);
      setApplyCarryForward(initialValues.apply_carry_forward);
      setNotes(initialValues.notes ?? '');
      setFxOverrides([]);
      setNextFxId(0);
      setInitialFxOverrides({});
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: investingService.updateTaxProfile,
    onSuccess: () => {
      showToast('Tax profile saved', 'success');
    },
    onError: (err: Error) => {
      showToast(err.message, 'error');
    },
  });

  const validateFxRows = (): boolean => {
    let valid = true;
    setFxOverrides((prev) =>
      prev.map((row) => {
        const errors: string[] = [];
        if (row.month && !/^\d{4}-\d{2}$/.test(row.month)) {
          errors.push('invalid month format');
        }
        if (row.rate) {
          const rateNum = parseFloat(row.rate);
          if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
            errors.push('must be between 0 and 100');
          }
        }
        const error = errors.join('; ');
        if (error) valid = false;
        return { ...row, error: error || undefined };
      }),
    );
    return valid;
  };

  const validateOtherIncome = (): boolean => {
    const val = parseFloat(otherIncome);
    if (isNaN(val) || val < 0) return false;
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateOtherIncome()) {
      showToast('Other income must not be negative', 'error');
      return;
    }

    if (!validateFxRows()) {
      return;
    }

    const changes: Record<string, unknown> = {};

    if (residentStatus !== initialValues.resident_status) changes.resident_status = residentStatus;
    if (taxRegime !== initialValues.tax_regime) changes.tax_regime = taxRegime;
    if (otherIncome !== initialValues.other_income) changes.other_income = otherIncome;
    if (explicitRegime !== initialValues.explicit_regime) changes.explicit_regime = explicitRegime || null;
    if (slabOverride !== (initialValues.slab_override_pct ?? '')) changes.slab_override_pct = slabOverride || null;
    if (surchargeOverride !== (initialValues.surcharge_override_pct ?? '')) changes.surcharge_override_pct = surchargeOverride || null;
    if (cessPct !== initialValues.cess_pct) changes.cess_pct = cessPct;
    if (applyCarryForward !== initialValues.apply_carry_forward) changes.apply_carry_forward = applyCarryForward;
    if (notes !== (initialValues.notes ?? '')) changes.notes = notes || null;

    const fxMap: Record<string, string> = {};
    fxOverrides.forEach((row) => {
      if (row.month && row.rate) {
        fxMap[row.month] = row.rate;
      }
    });
    // Compare against initial fx_overrides, not initialValues (which is always empty)
    const fxChanged = JSON.stringify(fxMap) !== JSON.stringify(initialFxOverrides);
    if (fxChanged) {
      changes.fx_overrides = fxMap;
    }

    if (Object.keys(changes).length === 0) {
      showToast('No changes', 'success');
      return;
    }

    updateMutation.mutate(changes);
  };

  const addFxRow = () => {
    const newId = nextFxId;
    setFxOverrides((prev) => [...prev, { id: newId, month: '', rate: '' }]);
    setNextFxId(newId + 1);
  };

  const removeFxRow = (id: number) => {
    setFxOverrides((prev) => prev.filter((row) => row.id !== id));
  };

  const updateFxMonth = (id: number, month: string) => {
    setFxOverrides((prev) => prev.map((row) => (row.id === id ? { ...row, month } : row)));
  };

  const updateFxRate = (id: number, rate: string) => {
    setFxOverrides((prev) => prev.map((row) => (row.id === id ? { ...row, rate } : row)));
  };

  // Handle Select onChange via the hidden select element
  const handleResidentStatusChange = (value: string) => setResidentStatus(value);
  const handleTaxRegimeChange = (value: string) => setTaxRegime(value);
  const handleExplicitRegimeChange = (value: string) => setExplicitRegime(value);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="text-center py-12 text-red-400">
        Failed to load tax profile
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">Core Profile</h3>
          <p className="mt-1 text-sm text-slate-400">
            Your tax residency, regime choice, and other taxable income. These drive the slab rate
            applied to foreign short-term gains and the rebate ceiling.
          </p>
        </div>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="resident-status" data-testid="tax-form-resident-status-label">
                Resident Status
              </Label>
              <Select value={residentStatus} onValueChange={handleResidentStatusChange}>
                <SelectTrigger data-testid="tax-form-resident-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resident">Resident</SelectItem>
                  <SelectItem value="resident_not_ordinarily_resident">Resident Not Ordinarily Resident</SelectItem>
                  <SelectItem value="non_resident">Non-Resident</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tax-regime" data-testid="tax-form-tax-regime-label">
                Tax Regime
              </Label>
              <Select value={taxRegime} onValueChange={handleTaxRegimeChange}>
                <SelectTrigger data-testid="tax-form-tax-regime">
                  <SelectValue placeholder="Select regime" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New (Sec 115BAC)</SelectItem>
                  <SelectItem value="old">Old</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="other-income" data-testid="tax-form-other-income-label">
              Other Taxable Income (₹)
            </Label>
            <Input
              id="other-income"
              type="number"
              step="1000"
              min="0"
              placeholder="0"
              value={otherIncome}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOtherIncome(e.target.value)}
              data-testid="tax-form-other-income"
            />
            <p className="text-xs text-slate-400">
              Salary, business, rental, etc. — after your own deductions. The engine does not apply
              a standard deduction.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="explicit-regime" data-testid="tax-form-explicit-regime-label">
              Explicit Regime Override
            </Label>
            <Select value={explicitRegime} onValueChange={handleExplicitRegimeChange}>
              <SelectTrigger data-testid="tax-form-explicit-regime">
                <SelectValue placeholder="— (auto-classify from security master)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— Auto-classify</SelectItem>
                <SelectItem value="indian">Indian listed (STT paid)</SelectItem>
                <SelectItem value="foreign">Foreign / US listed (no STT)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-400">
              Beats the security master and account market scope. Use when you hold IFSC UDRs or the
              classification is wrong.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-6">
        <button
          type="button"
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="w-full flex items-center justify-between"
          data-testid="tax-form-advanced-toggle"
        >
          <div>
            <h3 className="text-lg font-semibold text-white">Advanced Overrides</h3>
            <p className="mt-1 text-sm text-slate-400">
              Override the derived slab, surcharge, or cess. Leave blank to derive from total income.
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${advancedOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {advancedOpen && (
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="slab-override" data-testid="tax-form-slab-override-label">
                  Slab Override (%)
                </Label>
                <Input
                  id="slab-override"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="derived"
                  value={slabOverride}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSlabOverride(e.target.value)}
                  data-testid="tax-form-slab-override"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="surcharge-override" data-testid="tax-form-surcharge-override-label">
                  Surcharge Override (%)
                </Label>
                <Input
                  id="surcharge-override"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="derived"
                  value={surchargeOverride}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSurchargeOverride(e.target.value)}
                  data-testid="tax-form-surcharge-override"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cess-pct" data-testid="tax-form-cess-label">
                  Cess (%)
                </Label>
                <Input
                  id="cess-pct"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={cessPct}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCessPct(e.target.value)}
                  data-testid="tax-form-cess"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="apply-carry-forward"
                checked={applyCarryForward}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApplyCarryForward(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-primary focus:ring-primary"
                data-testid="tax-form-carry-forward"
              />
              <Label htmlFor="apply-carry-forward" className="text-sm font-normal cursor-pointer">
                Apply prior-year loss carry-forward (not yet implemented in engine)
              </Label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" data-testid="tax-form-notes-label">
                Notes
              </Label>
              <Input
                id="notes"
                placeholder="Internal notes..."
                value={notes}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
                data-testid="tax-form-notes"
              />
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-6">
        <button
          type="button"
          onClick={() => setFxOpen(!fxOpen)}
          className="w-full flex items-center justify-between"
          data-testid="tax-fx-toggle"
        >
          <div>
            <h3 className="text-lg font-semibold text-white">Rule 115 FX Overrides</h3>
            <p className="mt-1 text-sm text-slate-400">
              SBI TT buying rate on the last day of the month <strong>before</strong> the sale month.
              Prefill from the Tax tab's missing-rate panel. One rate per sale month; currency is
              implied by the sale.
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${fxOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {fxOpen && (
          <div className="space-y-4 pt-4 border-t border-slate-800">
            {fxOverrides.length === 0 ? (
              <p className="text-slate-500 text-sm">No FX overrides yet. Add one below.</p>
            ) : (
              <div className="space-y-3">
                {fxOverrides.map((row, idx) => (
                  <div
                    key={row.id}
                    data-testid={`fx-override-row-${idx}`}
                    className="flex flex-col sm:flex-row gap-3 items-start"
                  >
                    <div className="space-y-1.5 flex-1">
                      <Label className="text-xs text-slate-400">Sale Month (YYYY-MM)</Label>
                      <Input
                        type="text"
                        placeholder="2026-04"
                        pattern="\\d{4}-\\d{2}"
                        value={row.month}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFxMonth(row.id, e.target.value)}
                        data-testid={`fx-override-month-${idx}`}
                        className={row.error ? 'border-red-500' : ''}
                      />
                      {row.error && (
                        <p className="text-xs text-red-400" data-testid={`fx-override-error-${idx}`}>
                          {row.error}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <Label className="text-xs text-slate-400">Rate (₹ per 1 unit)</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        min="0"
                        max="100"
                        placeholder="83.5000"
                        value={row.rate}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFxRate(row.id, e.target.value)}
                        data-testid={`fx-override-rate-${idx}`}
                        className={row.error ? 'border-red-500' : ''}
                      />
                      {row.error && (
                        <p className="text-xs text-red-400" data-testid={`fx-override-error-${idx}`}>
                          {row.error}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFxRow(row.id)}
                      data-testid={`fx-override-remove-${idx}`}
                      className="self-end mt-6"
                      aria-label="Remove FX override"
                    >
                      <Trash2 className="h-4 w-4 text-red-400 hover:text-red-300" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={addFxRow}
              data-testid="tax-fx-add-row"
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add FX Override
            </Button>
          </div>
        )}
      </section>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
        <Button type="submit" disabled={updateMutation.isPending} data-testid="tax-form-submit">
          {updateMutation.isPending ? 'Saving...' : 'Save Profile'}
        </Button>
      </div>
    </form>
  );
};