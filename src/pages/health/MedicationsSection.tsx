import React, { useState } from 'react';
import { Pill, Pause, Play, Pencil, Trash2, RotateCcw, Plus } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { MedicationFormDialog } from './MedicationFormDialog';
import { describeMedicationSchedule } from '../../utils/medicationScheduleLabel';
import type { Medication, MedicationCreate, MedicationUpdate } from '../../services/health';

type MedicationsSectionProps = {
  medications: Medication[];
  isLoading: boolean;
  onCreate: (payload: MedicationCreate) => void;
  onUpdate: (publicId: string, payload: MedicationUpdate) => void;
  onDelete: (publicId: string) => void;
  isSaving?: boolean;
  isDeleting?: boolean;
};

export const MedicationsSection: React.FC<MedicationsSectionProps> = ({
  medications,
  isLoading,
  onCreate,
  onUpdate,
  onDelete,
  isSaving = false,
  isDeleting = false,
}) => {
  const [formOpen, setFormOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [restartCourse, setRestartCourse] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Medication | null>(null);

  const openCreate = () => {
    setEditingMedication(null);
    setRestartCourse(false);
    setFormOpen(true);
  };

  const openEdit = (medication: Medication) => {
    setEditingMedication(medication);
    setRestartCourse(false);
    setFormOpen(true);
  };

  const openRestart = (medication: Medication) => {
    setEditingMedication(medication);
    setRestartCourse(true);
    setFormOpen(true);
  };

  const handleSubmit = (payload: MedicationCreate) => {
    if (editingMedication) {
      onUpdate(editingMedication.public_id, payload);
    } else {
      onCreate(payload);
    }
    setFormOpen(false);
  };

  if (isLoading) {
    return <div className="h-32 animate-pulse rounded-xl bg-slate-800/60" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate} data-testid="add-medication-button">
          <Plus className="mr-1.5 h-4 w-4" />
          Add medication
        </Button>
      </div>

      {medications.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 py-10 text-center">
          <Pill className="h-8 w-8 text-slate-600" />
          <p className="text-sm text-slate-400">No medications yet</p>
        </div>
      ) : (
        <ul className="space-y-2" data-testid="medications-list">
          {medications.map((medication) => (
            <li
              key={medication.public_id}
              data-testid={`medication-row-${medication.public_id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-white">
                  {medication.name}
                  {!medication.is_active ? (
                    <span className="ml-2 rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">Inactive</span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {medication.dose_text ? `${medication.dose_text} · ` : ''}
                  {describeMedicationSchedule(medication)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {!medication.is_active ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isSaving || isDeleting}
                    onClick={() => openRestart(medication)}
                    data-testid={`medication-restart-${medication.public_id}`}
                    aria-label={`Restart course for ${medication.name}`}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isSaving || isDeleting}
                    onClick={() => onUpdate(medication.public_id, { is_active: false })}
                    aria-label={`Pause ${medication.name}`}
                  >
                    <Pause className="h-4 w-4" />
                  </Button>
                )}
                {medication.is_active === false && medication.end_date == null ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isSaving || isDeleting}
                    onClick={() => onUpdate(medication.public_id, { is_active: true })}
                    aria-label={`Resume ${medication.name}`}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isSaving || isDeleting}
                  onClick={() => openEdit(medication)}
                  aria-label={`Edit ${medication.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isSaving || isDeleting}
                  onClick={() => setDeleteTarget(medication)}
                  aria-label={`Delete ${medication.name}`}
                  data-testid={`medication-delete-${medication.public_id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <MedicationFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        medication={editingMedication}
        restartCourse={restartCourse}
        onSubmit={handleSubmit}
        isPending={isSaving}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete medication?"
        description={
          deleteTarget
            ? `This will permanently delete "${deleteTarget.name}" and its ${deleteTarget.event_count} logged dose${
                deleteTarget.event_count === 1 ? '' : 's'
              }. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        isPending={isDeleting}
        onConfirm={() => {
          if (deleteTarget) onDelete(deleteTarget.public_id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
};
