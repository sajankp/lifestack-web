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

// Quick-select presets shown alongside the calendar. Computed from "now" on
// each open so "This month"/"Last 30 days" always track the current date.
// Dates are local (matching the calendar's own local-day convention) so the
// yyyy-MM-dd strings never drift by a day across timezones.
const buildPresets = (): { label: string; from: Date; to: Date }[] => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = new Date(y, m, now.getDate());
  const addDays = (d: Date, n: number) => {
    const c = new Date(d);
    c.setDate(c.getDate() + n);
    return c;
  };
  return [
    { label: 'This month', from: new Date(y, m, 1), to: new Date(y, m + 1, 0) },
    { label: 'Last month', from: new Date(y, m - 1, 1), to: new Date(y, m, 0) },
    { label: 'Last 7 days', from: addDays(today, -6), to: today },
    { label: 'Last 30 days', from: addDays(today, -29), to: today },
    { label: 'Last 90 days', from: addDays(today, -89), to: today },
    { label: 'This year', from: new Date(y, 0, 1), to: new Date(y, 11, 31) },
  ];
};

const presetSlug = (label: string) => label.toLowerCase().replace(/\s+/g, '-');

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
        <div className="flex flex-col sm:flex-row">
          <div className="flex flex-wrap gap-1 border-b border-slate-700/60 p-2 sm:w-36 sm:flex-col sm:flex-nowrap sm:border-b-0 sm:border-r">
            {buildPresets().map((preset) => {
              const presetFrom = toValue(preset.from);
              const presetTo = toValue(preset.to);
              const active = presetFrom === from && presetTo === to;
              return (
                <button
                  key={preset.label}
                  type="button"
                  data-testid={`${testId ?? 'date-range'}-preset-${presetSlug(preset.label)}`}
                  onClick={() => {
                    setDraft({ from: preset.from, to: preset.to });
                    onChange({ from: presetFrom, to: presetTo });
                    setOpen(false);
                  }}
                  className={cn(
                    'rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors',
                    active
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
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
        </div>
      </PopoverContent>
    </Popover>
  );
};
