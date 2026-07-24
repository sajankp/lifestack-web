import { formatShortDate } from './dateFormat';

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const UNIT_NAMES: Record<string, string> = { daily: 'day', weekly: 'week', monthly: 'month' };

const ordinalSuffix = (n: number): string => {
  const lastTwoDigits = n % 100;
  const lastDigit = n % 10;
  if (lastDigit === 1 && lastTwoDigits !== 11) return `${n}st`;
  if (lastDigit === 2 && lastTwoDigits !== 12) return `${n}nd`;
  if (lastDigit === 3 && lastTwoDigits !== 13) return `${n}rd`;
  return `${n}th`;
};

export interface MedicationScheduleLike {
  frequency: string;
  interval: number;
  schedule_mode?: string | null;
  days_of_week?: number[] | null;
  times: string[];
  end_date?: string | null;
}

/** Human-readable medication schedule summary, e.g.
 * "Every week on Mon, Wed, 09:00 — until 15 Aug" (spec-069 §D), or for
 * interval_from_last_dose mode "Every 2 days from your last dose" (spec-092). */
export const describeMedicationSchedule = (schedule: MedicationScheduleLike): string => {
  const unit = UNIT_NAMES[schedule.frequency] ?? schedule.frequency;

  if (schedule.schedule_mode === 'interval_from_last_dose') {
    const step = schedule.interval === 1 ? `Every ${unit}` : `Every ${schedule.interval} ${unit}s`;
    let intervalSummary = `${step} from your last dose`;
    const times =
      schedule.times && schedule.times.length > 0 ? schedule.times.join(', ') : null;
    if (times) intervalSummary += `, ${times}`;
    if (schedule.end_date) intervalSummary += ` — until ${formatShortDate(schedule.end_date)}`;
    return intervalSummary;
  }

  let cadence =
    schedule.interval === 1 ? `Every ${unit}` : `Every ${ordinalSuffix(schedule.interval)} ${unit}`;

  if (
    schedule.frequency === 'weekly' &&
    schedule.days_of_week &&
    schedule.days_of_week.length > 0
  ) {
    const days = [...schedule.days_of_week]
      .sort((a, b) => a - b)
      .map((d) => WEEKDAY_SHORT[d] ?? '')
      .filter(Boolean)
      .join(', ');
    cadence += ` on ${days}`;
  }

  const timesLabel = schedule.times && schedule.times.length > 0 ? schedule.times.join(', ') : null;
  let summary = timesLabel ? `${cadence}, ${timesLabel}` : cadence;

  if (schedule.end_date) {
    summary += ` — until ${formatShortDate(schedule.end_date)}`;
  }

  return summary;
};
