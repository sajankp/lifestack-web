import * as React from 'react';
import { DayPicker } from 'react-day-picker';

import { cn } from '../../lib/utils';
 
export type CalendarProps = React.ComponentProps<typeof DayPicker>;

const dayButtonClassName =
  'h-9 w-9 rounded-lg border border-transparent bg-transparent font-normal text-slate-200 hover:bg-slate-800 hover:text-white focus:bg-slate-800 focus:text-white';

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-4',
        month: 'space-y-3',
        month_caption: 'relative flex h-10 items-center justify-center',
        caption_label: 'inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950/50 px-2.5 py-1.5 text-sm font-medium text-slate-100',
        dropdowns: 'flex items-center justify-center gap-2',
        dropdown_root: 'relative inline-flex items-center hover:[&_span]:bg-slate-800',
        dropdown: 'absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0',
        nav: 'pointer-events-none absolute inset-x-0 top-0 flex h-10 items-center justify-between',
        button_previous: 'pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/50 text-slate-300 hover:bg-slate-800 hover:text-white',
        button_next: 'pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-950/50 text-slate-300 hover:bg-slate-800 hover:text-white',
        month_grid: 'w-full border-collapse space-y-1',
        weekdays: 'flex',
        weekday: 'w-9 rounded-md text-[0.8rem] font-normal text-slate-500',
        week: 'mt-2 flex w-full',
        day: 'relative p-0 text-center text-sm focus-within:relative focus-within:z-20',
        day_button: dayButtonClassName,
        selected: 'bg-cyan-600 text-white hover:bg-cyan-500 hover:text-white focus:bg-cyan-600 focus:text-white',
        today: 'ring-1 ring-inset ring-cyan-400/50',
        outside: 'text-slate-600 opacity-50',
        disabled: 'cursor-not-allowed text-slate-600 opacity-40',
        range_middle: 'aria-selected:bg-slate-800 aria-selected:text-slate-100',
        hidden: 'invisible',
        ...classNames,
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
