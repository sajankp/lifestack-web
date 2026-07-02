import React, { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '../lib/utils';
import { formatDate } from '../utils/dateFormat';

type DateRangePickerProps = {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  testId?: string;
};

const parseValue = (value: string | null | undefined) => {
  if (!value || typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = parseISO(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const toValue = (date: Date | undefined) => (date ? format(date, 'yyyy-MM-dd') : '');

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  from,
  to,
  onChange,
  placeholder = 'Select range',
  disabled = false,
  className,
  testId,
}) => {
  const [open, setOpen] = useState(false);
  const fromDate = useMemo(() => parseValue(from), [from]);
  const toDate = useMemo(() => parseValue(to), [to]);

  // Track the in-progress selection locally so the parent only ever receives a
  // complete range — a half-selected range would leave a query bound empty.
  const [draft, setDraft] = useState<DateRange | undefined>(
    fromDate ? { from: fromDate, to: toDate } : undefined,
  );

  // Computed each render so the default month always reflects the current date.
  const today = new Date();
  const startMonth = new Date(today.getFullYear() - 100, 0, 1);
  const endMonth = new Date(today.getFullYear() + 5, 11, 31);

  const label = fromDate
    ? `${formatDate(fromDate, { utc: false })} — ${toDate ? formatDate(toDate, { utc: false }) : '…'}`
    : placeholder;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // Re-seed the draft from the committed range each time we open.
        if (next) setDraft(fromDate ? { from: fromDate, to: toDate } : undefined);
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          data-testid={testId}
          type="button"
          variant="secondary"
          disabled={disabled}
          className={cn(
            'h-10 w-full justify-between rounded-lg border border-slate-700/80 bg-slate-950/50 px-3 text-sm font-normal text-slate-100 shadow-none hover:bg-slate-900',
            !fromDate && 'text-slate-500',
            className,
          )}
        >
          <span className="truncate">{label}</span>
          <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          captionLayout="dropdown"
          startMonth={startMonth}
          endMonth={endMonth}
          defaultMonth={fromDate ?? today}
          selected={draft}
          onSelect={(range) => {
            setDraft(range);
            // Commit and close only once both ends are chosen; keep the popover
            // open (and the parent range untouched) while only the start is set.
            if (range?.from && range?.to) {
              onChange({ from: toValue(range.from), to: toValue(range.to) });
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
};
