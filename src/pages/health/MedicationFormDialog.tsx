import React, { useEffect, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { DropdownSelect } from '../../components/DropdownSelect';
import { DatePicker } from '../../components/DatePicker';
import { ToggleSwitch } from '../../components/ui/toggle-switch';
import { WeekdayToggleGroup } from './WeekdayToggleGroup';
import { describeMedicationSchedule } from '../../utils/medicationScheduleLabel';
import { formatDateInputValue } from '../../utils/dateFormat';
import type { Medication, MedicationCreate } from '../../services/health';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const medicationFormSchema = z
  .object({
    name: z.string().min(1, 'Enter a medication name').max(120),
    dose_text: z.string().max(60).optional(),
    refill_note: z.string().max(500).optional(),
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    interval: z.number().int().min(1, 'Must be at least 1'),
    days_of_week: z.array(z.number()),
    times: z
      .string()
      .min(1, 'Enter at least one dose time')
      .refine(
        (v) => v.split(',').every((t) => TIME_RE.test(t.trim())),
        'Use 24-hour HH:MM times, comma-separated (e.g. 09:00, 21:00)',
      ),
    anchor_date: z.string().min(1, 'Select a start date'),
    end_date: z.string().optional(),
    timezone: z.string().min(1),
    reminders_enabled: z.boolean(),
  })
  .refine((v) => v.frequency !== 'weekly' || v.days_of_week.length > 0, {
    message: 'Select at least one day of the week',
    path: ['days_of_week'],
  })
  .refine((v) => !v.end_date || v.end_date >= v.anchor_date, {
    message: 'End date must be on or after the start date',
    path: ['end_date'],
  });

type MedicationFormValues = z.infer<typeof medicationFormSchema>;

const frequencyOptions = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const defaultsFor = (medication?: Medication | null): MedicationFormValues => ({
  name: medication?.name ?? '',
  dose_text: medication?.dose_text ?? '',
  refill_note: medication?.refill_note ?? '',
  frequency: (medication?.frequency as 'daily' | 'weekly' | 'monthly') ?? 'daily',
  interval: medication?.interval ?? 1,
  days_of_week: medication?.days_of_week ?? [],
  times: medication?.times && medication.times.length > 0 ? medication.times.join(', ') : '09:00',
  anchor_date: medication?.anchor_date || formatDateInputValue(new Date()),
  end_date: medication?.end_date ?? '',
  timezone: medication?.timezone || browserTimezone,
  reminders_enabled: medication?.reminders_enabled ?? true,
});

type MedicationFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication?: Medication | null;
  restartCourse?: boolean;
  onSubmit: (payload: MedicationCreate) => void;
  isPending?: boolean;
};

export const MedicationFormDialog: React.FC<MedicationFormDialogProps> = ({
  open,
  onOpenChange,
  medication,
  restartCourse = false,
  onSubmit,
  isPending = false,
}) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<MedicationFormValues>({
    resolver: zodResolver(medicationFormSchema),
    defaultValues: defaultsFor(medication),
  });

  useEffect(() => {
    if (open) {
      reset(
        restartCourse
          ? { ...defaultsFor(medication), anchor_date: formatDateInputValue(new Date()), end_date: '' }
          : defaultsFor(medication),
      );
      setAdvancedOpen(false);
    }
  }, [open, medication, restartCourse, reset]);

  const watched = watch();

  const handleFormSubmit = (values: MedicationFormValues) => {
    onSubmit({
      name: values.name,
      dose_text: values.dose_text || null,
      refill_note: values.refill_note || null,
      frequency: values.frequency,
      interval: values.interval,
      days_of_week: values.frequency === 'weekly' ? values.days_of_week : null,
      times: values.times.split(',').map((t) => t.trim()),
      anchor_date: values.anchor_date,
      end_date: values.end_date || null,
      timezone: values.timezone,
      reminders_enabled: values.reminders_enabled,
      ...(restartCourse ? { is_active: true } : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {restartCourse ? 'Restart course' : medication ? 'Edit medication' : 'Add medication'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Name</label>
            <input
              {...register('name')}
              data-testid="medication-name-input"
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-white"
              placeholder="e.g. Metformin"
            />
            {errors.name ? <p className="mt-1 text-sm text-rose-400">{errors.name.message}</p> : null}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Dose</label>
            <input
              {...register('dose_text')}
              data-testid="medication-dose-input"
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-white"
              placeholder="e.g. 500 mg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Frequency</label>
              <Controller
                control={control}
                name="frequency"
                render={({ field }) => (
                  <DropdownSelect
                    testId="medication-frequency"
                    value={field.value}
                    onChange={field.onChange}
                    options={frequencyOptions}
                    placeholder="Frequency"
                  />
                )}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Every N {watched.frequency}(s)</label>
              <input
                type="number"
                min={1}
                {...register('interval', { valueAsNumber: true })}
                data-testid="medication-interval-input"
                className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-white"
              />
              {errors.interval ? <p className="mt-1 text-sm text-rose-400">{errors.interval.message}</p> : null}
            </div>
          </div>

          {watched.frequency === 'weekly' ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Days of week</label>
              <Controller
                control={control}
                name="days_of_week"
                render={({ field }) => (
                  <WeekdayToggleGroup testId="medication-weekday" value={field.value} onChange={field.onChange} />
                )}
              />
              {errors.days_of_week ? (
                <p className="mt-1 text-sm text-rose-400">{errors.days_of_week.message}</p>
              ) : null}
            </div>
          ) : null}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Dose times</label>
            <input
              {...register('times')}
              data-testid="medication-times-input"
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-white"
              placeholder="09:00, 21:00"
            />
            {errors.times ? <p className="mt-1 text-sm text-rose-400">{errors.times.message}</p> : null}
          </div>

          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
          >
            {advancedOpen ? 'Hide advanced schedule' : 'Advanced schedule'}
          </button>

          {advancedOpen ? (
            <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">Start date</label>
                  <Controller
                    control={control}
                    name="anchor_date"
                    render={({ field }) => (
                      <DatePicker testId="medication-anchor-date" value={field.value} onChange={field.onChange} />
                    )}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">End date (optional)</label>
                  <Controller
                    control={control}
                    name="end_date"
                    render={({ field }) => (
                      <DatePicker
                        testId="medication-end-date"
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    )}
                  />
                  {errors.end_date ? <p className="mt-1 text-sm text-rose-400">{errors.end_date.message}</p> : null}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">Timezone</label>
                <input
                  {...register('timezone')}
                  data-testid="medication-timezone-input"
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">Refill note</label>
                <input
                  {...register('refill_note')}
                  data-testid="medication-refill-note-input"
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-white"
                  placeholder="e.g. refill by the 20th"
                />
              </div>
            </div>
          ) : null}

          <Controller
            control={control}
            name="reminders_enabled"
            render={({ field }) => (
              <ToggleSwitch
                testId="medication-reminders-toggle"
                checked={field.value}
                onChange={field.onChange}
                label="Push reminders"
              />
            )}
          />

          <p data-testid="medication-schedule-summary" className="text-xs text-slate-400">
            {describeMedicationSchedule({
              frequency: watched.frequency,
              interval: watched.interval || 1,
              days_of_week: watched.days_of_week,
              times: watched.times ? watched.times.split(',').map((t) => t.trim()).filter(Boolean) : [],
              end_date: watched.end_date || null,
            })}
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending} data-testid="medication-save-button">
              {medication && !restartCourse ? 'Save changes' : 'Add medication'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
