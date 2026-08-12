import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHero } from '../components/layout/PageHero';
import { PageShell } from '../components/layout/PageShell';
import { useInvalidatingMutation } from '../hooks/useInvalidatingMutation';
import { queryKeys } from '../lib/queryKeys';
import { healthService } from '../services/health';
import type { DoseSlot, MedicationCreate, MedicationUpdate } from '../services/health';
import { DoseChecklist } from './health/DoseChecklist';
import { WeightSection } from './health/WeightSection';
import { MedicationsSection } from './health/MedicationsSection';
import { formatDateInputValue } from '../utils/dateFormat';

const todayDate = (): string => formatDateInputValue(new Date());

/** Shift a YYYY-MM-DD string by whole days, staying in local time. */
const shiftDate = (dateStr: string, days: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return formatDateInputValue(new Date(y, m - 1, d + days));
};

const describeDay = (dateStr: string, today: string): string => {
  if (dateStr === today) return 'Today';
  if (dateStr === shiftDate(today, -1)) return 'Yesterday';
  if (dateStr === shiftDate(today, 1)) return 'Tomorrow';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

export const HealthPage: React.FC = () => {
  const today = todayDate();
  const [selectedDate, setSelectedDate] = React.useState(today);

  const scheduleQuery = useQuery({
    queryKey: queryKeys.health.schedule(selectedDate),
    queryFn: () => healthService.getSchedule(selectedDate),
    staleTime: 60 * 1000,
  });

  const overdueQuery = useQuery({
    queryKey: queryKeys.health.overdue(),
    queryFn: () => healthService.getOverdue(),
    staleTime: 60 * 1000,
  });

  const scheduledSlotKeys = new Set(
    (scheduleQuery.data ?? []).map(
      (slot) => `${slot.medication_public_id}-${slot.scheduled_for}`,
    ),
  );
  const catchUpSlots = (overdueQuery.data ?? []).filter(
    (slot) => !scheduledSlotKeys.has(`${slot.medication_public_id}-${slot.scheduled_for}`),
  );

  const weightTrendQuery = useQuery({
    queryKey: queryKeys.health.weightTrend(30),
    queryFn: () => healthService.getWeightTrend(30),
    staleTime: 5 * 60 * 1000,
  });

  const medicationsQuery = useQuery({
    queryKey: queryKeys.health.medications(),
    queryFn: () => healthService.getMedications(),
    staleTime: 5 * 60 * 1000,
  });

  const eventMutation = useInvalidatingMutation(
    (args: { medicationPublicId: string; scheduledFor: string; status: 'taken' | 'skipped' }) =>
      healthService.upsertMedicationEvent(args.medicationPublicId, {
        scheduled_for: args.scheduledFor,
        status: args.status,
      }),
    [
      queryKeys.health.schedule(selectedDate),
      queryKeys.health.overdue(),
      queryKeys.health.medications(),
    ],
    { successMessage: false },
  );

  const logWeightMutation = useInvalidatingMutation(
    (weightKg: string) =>
      healthService.createWeightEntry({
        measured_at: new Date().toISOString(),
        weight_kg: weightKg,
      }),
    [queryKeys.health.weightTrend(30), queryKeys.health.weight()],
    { successMessage: 'Weight logged' },
  );

  const createMedicationMutation = useInvalidatingMutation(
    (payload: MedicationCreate) => healthService.createMedication(payload),
    [queryKeys.health.medications(), queryKeys.health.schedule(selectedDate)],
    { successMessage: 'Medication added' },
  );

  const updateMedicationMutation = useInvalidatingMutation(
    (args: { publicId: string; payload: MedicationUpdate }) =>
      healthService.updateMedication(args.publicId, args.payload),
    [queryKeys.health.medications(), queryKeys.health.schedule(selectedDate)],
    { successMessage: 'Medication updated' },
  );

  const deleteMedicationMutation = useInvalidatingMutation(
    (publicId: string) => healthService.deleteMedication(publicId),
    [queryKeys.health.medications(), queryKeys.health.schedule(selectedDate)],
    { successMessage: 'Medication deleted' },
  );

  const handleMarkTaken = (slot: DoseSlot) => {
    eventMutation.mutate({
      medicationPublicId: slot.medication_public_id,
      scheduledFor: slot.scheduled_for,
      status: 'taken',
    });
  };

  const handleMarkSkipped = (slot: DoseSlot) => {
    eventMutation.mutate({
      medicationPublicId: slot.medication_public_id,
      scheduledFor: slot.scheduled_for,
      status: 'skipped',
    });
  };

  return (
    <PageShell animated>
      <PageHero
        title="Health"
        subtitle="Medications and weight — logged in seconds, entered manually."
      />

      <div className="space-y-8">
        {catchUpSlots.length > 0 ? (
          <section data-testid="catch-up-section">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-amber-300">
              Catch up ({catchUpSlots.length})
            </h2>
            <DoseChecklist
              slots={catchUpSlots}
              isLoading={overdueQuery.isLoading}
              onMarkTaken={handleMarkTaken}
              onMarkSkipped={handleMarkSkipped}
              isMutating={eventMutation.isPending}
              showDate
            />
          </section>
        ) : null}

        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-300">
              Doses
            </h2>
            <div className="flex items-center gap-2">
              {selectedDate !== today ? (
                <button
                  type="button"
                  onClick={() => setSelectedDate(today)}
                  data-testid="dose-date-today"
                  className="text-xs font-medium text-cyan-400 hover:text-cyan-300"
                >
                  Today
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
                data-testid="dose-date-prev"
                aria-label="Previous day"
                className="rounded-md p-1 text-slate-400 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span
                data-testid="dose-date-label"
                className="min-w-24 text-center text-sm font-medium text-slate-200"
              >
                {describeDay(selectedDate, today)}
              </span>
              <button
                type="button"
                onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
                data-testid="dose-date-next"
                aria-label="Next day"
                className="rounded-md p-1 text-slate-400 hover:text-white"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <DoseChecklist
            slots={scheduleQuery.data ?? []}
            isLoading={scheduleQuery.isLoading}
            onMarkTaken={handleMarkTaken}
            onMarkSkipped={handleMarkSkipped}
            isMutating={eventMutation.isPending}
            emptyLabel={
              selectedDate === today
                ? 'No medications scheduled today'
                : 'No medications scheduled this day'
            }
          />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-300">
            Weight
          </h2>
          <WeightSection
            trend={weightTrendQuery.data}
            isLoading={weightTrendQuery.isLoading}
            onLog={(weightKg) => logWeightMutation.mutate(weightKg)}
            isLogging={logWeightMutation.isPending}
          />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-300">
            Medications
          </h2>
          <MedicationsSection
            medications={medicationsQuery.data?.items ?? []}
            isLoading={medicationsQuery.isLoading}
            onCreate={(payload) => createMedicationMutation.mutate(payload)}
            onUpdate={(publicId, payload) => updateMedicationMutation.mutate({ publicId, payload })}
            onDelete={(publicId) => deleteMedicationMutation.mutate(publicId)}
            isSaving={createMedicationMutation.isPending || updateMedicationMutation.isPending}
            isDeleting={deleteMedicationMutation.isPending}
          />
        </section>
      </div>
    </PageShell>
  );
};
