import React from 'react';

const STYLES: Record<'low' | 'normal' | 'high', string> = {
  low: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  normal: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  high: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
};

/** Shown only when the report printed a range; says nothing beyond that range. */
export const InRangeChip: React.FC<{ value: 'low' | 'normal' | 'high' | null }> = ({ value }) =>
  value ? (
    <span
      data-testid={`in-range-${value}`}
      title="Compared with the range printed on the report"
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STYLES[value]}`}
    >
      {value}
    </span>
  ) : null;
