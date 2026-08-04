const isSupportedTimezone = (timezone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
};

export const browserTimezone = (): string => {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return detected && isSupportedTimezone(detected) ? detected : '';
};

export const resolveEffectiveTimezone = (
  savedTimezone: string | null | undefined,
  detectedTimezone = browserTimezone(),
): string => {
  if (savedTimezone && isSupportedTimezone(savedTimezone)) return savedTimezone;
  if (detectedTimezone && isSupportedTimezone(detectedTimezone)) return detectedTimezone;
  return 'UTC';
};

const datePartsInTimezone = (value: Date | string | number, timezone: string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
};

const zonedMidnightUtc = (dateKey: string, timezone: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const targetWallTime = Date.UTC(year, month - 1, day);
  let candidate = targetWallTime;

  // Intl exposes zone-local parts rather than an offset. Converge from the
  // corresponding UTC midnight; the second pass handles DST-offset changes.
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(candidate));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const representedWallTime = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    );
    candidate += targetWallTime - representedWallTime;
  }

  return new Date(candidate);
};

export const calendarDayUtcRange = (
  dateKey: string,
  timezone: string,
): { from: string; to: string } | null => {
  const start = zonedMidnightUtc(dateKey, timezone);
  if (!start) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  const followingDate = new Date(Date.UTC(year, month - 1, day + 1));
  const followingKey = `${followingDate.getUTCFullYear()}-${String(
    followingDate.getUTCMonth() + 1,
  ).padStart(2, '0')}-${String(followingDate.getUTCDate()).padStart(2, '0')}`;
  const followingStart = zonedMidnightUtc(followingKey, timezone);
  if (!followingStart) return null;
  return { from: start.toISOString(), to: new Date(followingStart.getTime() - 1).toISOString() };
};

export const calendarDateKey = (
  value: Date | string | number,
  timezone: string,
): string | null => {
  const parts = datePartsInTimezone(value, timezone);
  if (!parts?.year || !parts.month || !parts.day) return null;
  const month = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    month: '2-digit',
  }).format(value instanceof Date ? value : new Date(value));
  return `${parts.year}-${month}-${parts.day.padStart(2, '0')}`;
};

export const formatDateInTimezone = (
  value: Date | string | number | null | undefined,
  timezone: string,
  fallback = '—',
): string => {
  if (value == null || value === '') return fallback;
  const parts = datePartsInTimezone(value, timezone);
  if (!parts?.year || !parts.month || !parts.day) return fallback;
  return `${Number(parts.day)}-${parts.month}-${parts.year}`;
};
