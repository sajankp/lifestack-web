const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ORDINAL_NAMES: Record<number, string> = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', [-1]: 'last' };
const UNIT_NAMES: Record<string, string> = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' };

const ordinalSuffix = (n: number): string => {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
};

const capitalize = (s: string): string => (s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export interface RecurrenceLike {
  frequency: string;
  interval: number;
  monthly_mode?: string | null;
  by_weekday?: number | null;
  by_ordinal?: number | null;
}

/** Human-readable recurrence summary, e.g. "Every month on the last day",
 * "Every 2nd month on the first Friday" (spec-053). */
export const describeRecurrence = (rule: RecurrenceLike): string => {
  const unit = UNIT_NAMES[rule.frequency] ?? rule.frequency;
  const cadence = rule.interval === 1 ? `every ${unit}` : `every ${ordinalSuffix(rule.interval)} ${unit}`;

  if (rule.frequency !== 'monthly') {
    return capitalize(cadence);
  }

  if (rule.monthly_mode === 'last_day') {
    return capitalize(`${cadence} on the last day`);
  }

  if (rule.monthly_mode === 'nth_weekday' && rule.by_weekday != null && rule.by_ordinal != null) {
    const ordinalName = ORDINAL_NAMES[rule.by_ordinal] ?? `${rule.by_ordinal}th`;
    const dayName = WEEKDAY_NAMES[rule.by_weekday] ?? '';
    return capitalize(`${cadence} on the ${ordinalName} ${dayName}`);
  }

  return capitalize(cadence);
};
