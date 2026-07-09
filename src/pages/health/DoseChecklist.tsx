import React from 'react';
import { Check, X, Pill } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';
import type { DoseSlot } from '../../services/health';

const STATUS_STYLES: Record<DoseSlot['status'], string> = {
  pending: 'border-slate-700 bg-slate-900/60',
  taken: 'border-emerald-600/50 bg-emerald-900/20',
  skipped: 'border-slate-600 bg-slate-800/40 opacity-70',
  missed: 'border-rose-600/50 bg-rose-900/20',
};

type DoseChecklistProps = {
  slots: DoseSlot[];
  isLoading: boolean;
  onMarkTaken: (slot: DoseSlot) => void;
  onMarkSkipped: (slot: DoseSlot) => void;
  isMutating?: boolean;
};

export const DoseChecklist: React.FC<DoseChecklistProps> = ({
  slots,
  isLoading,
  onMarkTaken,
  onMarkSkipped,
  isMutating = false,
}) => {
  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-xl bg-slate-800/60" />;
  }

  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 py-10 text-center">
        <Pill className="h-8 w-8 text-slate-600" />
        <p className="text-sm text-slate-400">No medications scheduled today</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2" data-testid="dose-checklist">
      {slots.map((slot) => {
        const parsedDate = new Date(slot.scheduled_for);
        const isValid = !isNaN(parsedDate.getTime());
        const time = isValid
          ? parsedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
          : '';
        return (
          <li
            key={`${slot.medication_public_id}-${slot.scheduled_for}`}
            data-testid={`dose-slot-${slot.medication_public_id}-${slot.scheduled_for}`}
            data-status={slot.status}
            className={cn('flex items-center justify-between gap-3 rounded-xl border px-4 py-3', STATUS_STYLES[slot.status])}
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-white">{slot.medication_name}</p>
              <p className="truncate text-xs text-slate-400">
                {slot.dose_text ? `${slot.dose_text} · ` : ''}
                {time}
                {slot.status === 'missed' ? ' · missed' : ''}
              </p>
            </div>
            {slot.status === 'taken' || slot.status === 'skipped' ? (
              <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-slate-300">
                {slot.status}
              </span>
            ) : (
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isMutating}
                  onClick={() => onMarkSkipped(slot)}
                  aria-label={`Mark ${slot.medication_name} skipped`}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  disabled={isMutating}
                  onClick={() => onMarkTaken(slot)}
                  aria-label={`Mark ${slot.medication_name} taken`}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};
