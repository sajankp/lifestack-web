import React from 'react';
import { Info } from 'lucide-react';

/**
 * The `i` affordance used throughout the Tax tab to explain a rule, a
 * rate, or a caveat.
 *
 * Follows the tooltip pattern already used in `HoldingsTab.tsx` (a
 * `group relative inline-flex` wrapper around a lucide `Info` icon with
 * an absolutely-positioned panel that appears on hover), with one
 * addition: `focus-within` so keyboard users can reach it. A hover-only
 * tooltip is invisible to a keyboard user, and these tooltips carry the
 * statutory reasoning behind a number.
 */
export const TaxInfoTip: React.FC<{
  content: React.ReactNode;
  label?: string;
  className?: string;
}> = ({ content, label = 'More information', className = '' }) => (
  <span className={`group relative inline-flex ${className}`}>
    <Info
      className="h-3.5 w-3.5 cursor-default text-slate-500 hover:text-slate-300 focus:text-slate-300"
      aria-label={label}
      tabIndex={0}
    />
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden w-max max-w-[280px] -translate-x-1/2 rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-left text-xs font-normal text-slate-300 shadow-xl group-hover:block group-focus-within:block"
    >
      {content}
    </span>
  </span>
);
