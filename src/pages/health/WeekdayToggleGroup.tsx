import React from 'react';
import { cn } from '../../lib/utils';

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type WeekdayToggleGroupProps = {
  value: number[];
  onChange: (value: number[]) => void;
  testId?: string;
};

/** Multi-select weekday toggle row (Mon..Sun, 0-6) for weekly medication
 * schedules — no reusable widget existed for this before spec-069. */
export const WeekdayToggleGroup: React.FC<WeekdayToggleGroupProps> = ({ value, onChange, testId }) => {
  const toggle = (day: number) => {
    if (value.includes(day)) {
      onChange(value.filter((d) => d !== day).sort((a, b) => a - b));
    } else {
      onChange([...value, day].sort((a, b) => a - b));
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5" data-testid={testId}>
      {WEEKDAY_SHORT.map((label, day) => {
        const active = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            data-testid={testId ? `${testId}-${day}` : undefined}
            aria-pressed={active}
            onClick={() => toggle(day)}
            className={cn(
              'h-9 rounded-lg border px-3 text-sm font-medium transition-colors',
              active
                ? 'border-cyan-500 bg-cyan-600/20 text-cyan-300'
                : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600',
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};
