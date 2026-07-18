export interface DueDateParts {
  year: number;
  month: number;
  day: number;
}

const parseDueDateParts = (value: string): DueDateParts | null => {
  if (value.length < 10) return null;

  const yyyyMmDd = value.slice(0, 10);
  if (yyyyMmDd[4] !== '-' || yyyyMmDd[7] !== '-') return null;

  const year = Number(yyyyMmDd.slice(0, 4));
  const month = Number(yyyyMmDd.slice(5, 7));
  const day = Number(yyyyMmDd.slice(8, 10));

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() + 1 !== month ||
    utcDate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
};

export const isDateOnlyDueDate = (value: string): boolean =>
  value.endsWith('T00:00:00Z') || (value.length === 10 && parseDueDateParts(value) !== null);

export const startOfLocalDayFromDueDate = (value: string): Date | null => {
  if (isDateOnlyDueDate(value)) {
    const parts = parseDueDateParts(value);
    if (!parts) return null;
    return new Date(parts.year, parts.month - 1, parts.day);
  }

  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return null;

  return new Date(due.getFullYear(), due.getMonth(), due.getDate());
};

export const endOfLocalDayFromDateOnlyDueDate = (value: string): number | null => {
  const parts = parseDueDateParts(value);
  if (!parts) return null;

  return new Date(parts.year, parts.month - 1, parts.day, 23, 59, 59, 999).getTime();
};
