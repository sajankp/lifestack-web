import React, { useMemo, useState } from 'react';
import { format, isAfter, isBefore, parseISO, startOfDay } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import type { Matcher } from 'react-day-picker';

import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '../lib/utils';
import { formatDate } from '../utils/dateFormat';

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  testId?: string;
  /** Earliest selectable date (yyyy-MM-dd). Also bounds the year dropdown. */
  minDate?: string;
  /** Latest selectable date (yyyy-MM-dd). Also bounds the year dropdown. */
  maxDate?: string;
};

const parseValue = (value: string | null | undefined) => {
  if (!value || typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = parseISO(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select date',
  required = false,
  disabled = false,
  className,
  testId,
  minDate,
  maxDate,
}) => {
  const [open, setOpen] = useState(false);
  const selectedDate = useMemo(() => parseValue(value), [value]);
  const min = useMemo(() => parseValue(minDate), [minDate]);
  const max = useMemo(() => parseValue(maxDate), [maxDate]);
  const label = selectedDate ? formatDate(selectedDate, { utc: false }) : placeholder;

  // Bound the year dropdown to a sensible window (or the caller's min/max).
  // Computed each render so "Today" never goes stale across midnight.
  const today = new Date();
  const startMonth = min ?? new Date(today.getFullYear() - 100, 0, 1);
  const endMonth = max ?? new Date(today.getFullYear() + 5, 11, 31);
  const disabledMatcher = useMemo<Matcher[]>(() => {
    const matchers: Matcher[] = [];
    if (min) matchers.push({ before: min });
    if (max) matchers.push({ after: max });
    return matchers;
  }, [min, max]);
  const todayInRange =
    (!min || !isBefore(startOfDay(today), startOfDay(min))) &&
    (!max || !isAfter(startOfDay(today), startOfDay(max)));

  const commit = (date: Date) => {
    onChange(format(date, 'yyyy-MM-dd'));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          data-testid={testId}
          type="button"
          variant="secondary"
          disabled={disabled}
          className={cn(
            'h-10 w-full justify-between rounded-lg border border-slate-700/80 bg-slate-950/50 px-3 text-sm font-normal text-slate-100 shadow-none hover:bg-slate-900',
            !selectedDate && 'text-slate-500',
            className,
          )}
        >
          <span className="truncate">{label}</span>
          <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
          {required ? <span className="sr-only">Required</span> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          startMonth={startMonth}
          endMonth={endMonth}
          defaultMonth={selectedDate ?? (todayInRange ? today : startMonth)}
          selected={selectedDate}
          disabled={disabledMatcher}
          onSelect={(date) => {
            if (!date) {
              if (!required) {
                onChange('');
                setOpen(false);
              }
              return;
            }
            commit(date);
          }}
        />
        {todayInRange ? (
          <div className="border-t border-slate-800 p-2">
            <Button
              type="button"
              variant="ghost"
              className="h-8 w-full text-sm font-normal text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={() => commit(today)}
            >
              Today
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
};
