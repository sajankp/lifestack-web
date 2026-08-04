import { calendarDateKey } from '../../utils/timezone';

type DatedLedgerEntry = {
  public_id: string;
  occurred_at: string;
};

export const dailyClosingEntryIds = (
  entries: DatedLedgerEntry[],
  precedingNewerEntry: DatedLedgerEntry | undefined,
  timezone: string,
): Set<string> => {
  const closingIds = new Set<string>();
  let newerEntry = precedingNewerEntry;

  for (const entry of entries) {
    const entryDay = calendarDateKey(entry.occurred_at, timezone);
    const newerDay = newerEntry ? calendarDateKey(newerEntry.occurred_at, timezone) : null;
    if (entryDay && entryDay !== newerDay) closingIds.add(entry.public_id);
    newerEntry = entry;
  }

  return closingIds;
};
