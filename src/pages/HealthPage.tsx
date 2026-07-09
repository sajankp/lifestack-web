import React from 'react';
import { useQuery } from '@tanstack/react-query';
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

export const HealthPage: React.FC = () => {
  const today = todayDate();

  const scheduleQuery = useQuery({
    queryKey: queryKeys.health.schedule(today),
    queryFn: () => healthService.getSchedule(today),
  });

  const weightTrendQuery = useQuery({
    queryKey: queryKeys.health.weightTrend(30),
    queryFn: () => healthService.getWeightTrend(30),
  });

  const medicationsQuery = useQuery({
    queryKey: queryKeys.health.medications(),
    queryFn: () => healthService.getMedications(),
  });

  const eventMutation = useInvalidatingMutation(
    (args: { medicationPublicId: string; scheduledFor: string; status: 'taken' | 'skipped' }) =>
      healthService.upsertMedicationEvent(args.medicationPublicId, {
        scheduled_for: args.scheduledFor,
        status: args.status,
      }),
    [queryKeys.health.schedule(today), queryKeys.health.medications()],
    { successMessage: false },
  );

  const logWeightMutation = useInvalidatingMutation(
    (weightKg: string) => healthService.createWeightEntry({ measured_at: new Date().toISOString(), weight_kg: weightKg }),
    [queryKeys.health.weightTrend(30), queryKeys.health.weight()],
    { successMessage: 'Weight logged' },
  );

  const createMedicationMutation = useInvalidatingMutation(
    (payload: MedicationCreate) => healthService.createMedication(payload),
    [queryKeys.health.medications(), queryKeys.health.schedule(today)],
    { successMessage: 'Medication added' },
  );

  const updateMedicationMutation = useInvalidatingMutation(
    (args: { publicId: string; payload: MedicationUpdate }) => healthService.updateMedication(args.publicId, args.payload),
    [queryKeys.health.medications(), queryKeys.health.schedule(today)],
    { successMessage: 'Medication updated' },
  );

  const deleteMedicationMutation = useInvalidatingMutation(
    (publicId: string) => healthService.deleteMedication(publicId),
    [queryKeys.health.medications(), queryKeys.health.schedule(today)],
    { successMessage: 'Medication deleted' },
  );

  const handleMarkTaken = (slot: DoseSlot) => {
    eventMutation.mutate({ medicationPublicId: slot.medication_public_id, scheduledFor: slot.scheduled_for, status: 'taken' });
  };

  const handleMarkSkipped = (slot: DoseSlot) => {
    eventMutation.mutate({ medicationPublicId: slot.medication_public_id, scheduledFor: slot.scheduled_for, status: 'skipped' });
  };

  return (
    <PageShell animated>
      <PageHero title="Health" subtitle="Medications and weight — logged in seconds, entered manually." />

      <div className="space-y-8">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-300">Today's doses</h2>
          <DoseChecklist
            slots={scheduleQuery.data ?? []}
            isLoading={scheduleQuery.isLoading}
            onMarkTaken={handleMarkTaken}
            onMarkSkipped={handleMarkSkipped}
            isMutating={eventMutation.isPending}
          />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-300">Weight</h2>
          <WeightSection
            trend={weightTrendQuery.data}
            isLoading={weightTrendQuery.isLoading}
            onLog={(weightKg) => logWeightMutation.mutate(weightKg)}
            isLogging={logWeightMutation.isPending}
          />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-300">Medications</h2>
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
