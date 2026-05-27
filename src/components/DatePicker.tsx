import React, { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarDays } from 'lucide-react';

import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '../lib/utils';

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
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
}) => {
  const [open, setOpen] = useState(false);
  const selectedDate = useMemo(() => parseValue(value), [value]);
  const label = selectedDate ? format(selectedDate, 'MMM d, yyyy') : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          className={cn(
            'h-12 w-full justify-between border border-slate-700/80 bg-slate-950/50 px-4 font-normal text-slate-100 shadow-none hover:bg-slate-900',
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
          selected={selectedDate}
          onSelect={(date) => {
            if (!date) {
              if (!required) onChange('');
              return;
            }
            onChange(format(date, 'yyyy-MM-dd'));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
};
