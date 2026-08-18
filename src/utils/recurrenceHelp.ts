import { formatDate } from './dateFormat';

type RecurrenceHelpInput = {
  frequency: string;
  interval: number;
  anchorDate: string;
  monthlyMode?: string | null;
  byWeekday?: number | null;
  byOrdinal?: number | null;
  today?: Date;
};

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ORDINAL_NAMES: Record<number, string> = {
  1: 'first',
  2: 'second',
  3: 'third',
  4: 'fourth',
  [-1]: 'last',
};

const parseCalendarDate = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) &&
    date.getMonth() === Number(match[2]) - 1 &&
    date.getDate() === Number(match[3])
    ? date
    : null;
};

const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

const nthWeekdayOfMonth = (year: number, month: number, weekday: number, ordinal: number) => {
  const lastDay = new Date(year, month + 1, 0);
  if (ordinal === -1) {
    const offset = (lastDay.getDay() === 0 ? 6 : lastDay.getDay() - 1) - weekday;
    return new Date(year, month, lastDay.getDate() - ((offset + 7) % 7));
  }
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const offset = (weekday - firstWeekday + 7) % 7;
  return new Date(year, month, 1 + offset + (ordinal - 1) * 7);
};

const addMonths = (date: Date, interval: number, mode: string, anchorDay: number, weekday: number | null, ordinal: number | null) => {
  const target = new Date(date.getFullYear(), date.getMonth() + interval, 1);
  if (mode === 'last_day') {
    return new Date(target.getFullYear(), target.getMonth(), daysInMonth(target.getFullYear(), target.getMonth()));
  }
  if (mode === 'nth_weekday' && weekday != null && ordinal != null) {
    return nthWeekdayOfMonth(target.getFullYear(), target.getMonth(), weekday, ordinal);
  }
  return new Date(
    target.getFullYear(),
    target.getMonth(),
    Math.min(anchorDay, daysInMonth(target.getFullYear(), target.getMonth())),
  );
};

const nextDueDate = (input: RecurrenceHelpInput): Date | null => {
  const anchor = parseCalendarDate(input.anchorDate);
  if (!anchor || input.interval < 1) return null;

  const mode = input.frequency === 'monthly' ? input.monthlyMode ?? 'day_of_month' : 'day_of_month';
  const anchorDay = anchor.getDate();
  let due = new Date(anchor);

  if (input.frequency === 'monthly' && mode === 'last_day') {
    due = new Date(anchor.getFullYear(), anchor.getMonth(), daysInMonth(anchor.getFullYear(), anchor.getMonth()));
  } else if (
    input.frequency === 'monthly' &&
    mode === 'nth_weekday' &&
    input.byWeekday != null &&
    input.byOrdinal != null
  ) {
    due = nthWeekdayOfMonth(anchor.getFullYear(), anchor.getMonth(), input.byWeekday, input.byOrdinal);
  }

  if (due < anchor) {
    due = advanceDueDate(due, input, anchorDay);
  }

  const today = input.today ? new Date(input.today) : new Date();
  today.setHours(0, 0, 0, 0);
  let guard = 0;
  while (due < today && guard < 10000) {
    due = advanceDueDate(due, input, anchorDay);
    guard += 1;
  }
  return due;
};

const advanceDueDate = (current: Date, input: RecurrenceHelpInput, anchorDay: number) => {
  if (input.frequency === 'daily') {
    return new Date(current.getFullYear(), current.getMonth(), current.getDate() + input.interval);
  }
  if (input.frequency === 'weekly') {
    return new Date(current.getFullYear(), current.getMonth(), current.getDate() + input.interval * 7);
  }
  if (input.frequency === 'yearly') {
    const year = current.getFullYear() + input.interval;
    return new Date(year, current.getMonth(), current.getDate() === 29 && current.getMonth() === 1 && !isLeapYear(year) ? 28 : current.getDate());
  }
  return addMonths(
    current,
    input.interval,
    input.monthlyMode ?? 'day_of_month',
    anchorDay,
    input.byWeekday ?? null,
    input.byOrdinal ?? null,
  );
};

const isLeapYear = (year: number) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const intervalLabel = (frequency: string, interval: number) => {
  const unit = frequency === 'weekly' ? 'week' : frequency === 'monthly' ? 'month' : frequency === 'yearly' ? 'year' : 'day';
  return `${interval} ${unit}${interval === 1 ? '' : 's'}`;
};

export const describeRecurrenceHelp = (input: RecurrenceHelpInput): string => {
  const interval = Number.isInteger(input.interval) && input.interval > 0 ? input.interval : 1;
  const nextDue = nextDueDate({ ...input, interval });
  const nextDueText = nextDue ? ` Expected next due: ${formatDate(nextDue, { utc: false })}.` : '';

  if (input.frequency === 'monthly') {
    if (input.monthlyMode === 'last_day') {
      return `Runs every ${intervalLabel('monthly', interval)} on the last calendar day. The Start Date only sets when the rule can begin.${nextDueText}`;
    }
    if (input.monthlyMode === 'nth_weekday') {
      const ordinal = ORDINAL_NAMES[input.byOrdinal ?? 1] ?? 'selected';
      const weekday = WEEKDAY_NAMES[input.byWeekday ?? 0] ?? 'weekday';
      return `Runs every ${intervalLabel('monthly', interval)} on the ${ordinal} ${weekday}. Start Date sets the earliest allowed date; Occurrence + Weekday choose the monthly pattern.${nextDueText}`;
    }
    const day = parseCalendarDate(input.anchorDate)?.getDate();
    const dayText = day ? ` (currently the ${day}${day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'})` : '';
    return `Runs every ${intervalLabel('monthly', interval)} on the day from Start Date${dayText}. For the 15th of every month, choose Monthly, Every N months = 1, and a Start Date on the 15th.${nextDueText}`;
  }

  const unit = input.frequency === 'weekly' ? 'weekday' : input.frequency === 'yearly' ? 'month and day' : input.frequency === 'daily' ? 'calendar day' : 'selected period';
  return `Runs every ${intervalLabel(input.frequency, interval)}. Start Date is the first allowed date and fixes the ${unit}.${nextDueText}`;
};

