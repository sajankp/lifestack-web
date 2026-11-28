import React, { useState } from 'react';
import { Link } from 'react-router';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import type { BriefingLine } from '../../types/dashboard';

// spec-113 §3.5. Collapsed by default: the briefing's non-actionable lines, and the unread insights
// (which are information too). Nothing here needs the owner, so it never competes with "Needs you".

export interface GoodToKnowInsight {
  public_id: string;
  title: string;
  body?: string | null;
  severity?: string;
}

interface GoodToKnowSectionProps {
  lines: BriefingLine[];
  insights: GoodToKnowInsight[];
}

export const GoodToKnowSection: React.FC<GoodToKnowSectionProps> = ({ lines, insights }) => {
  const [open, setOpen] = useState(false);
  const count = lines.length + insights.length;
  if (count === 0) return null;

  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <section
      data-testid="today-good-to-know"
      className="rounded-3xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5"
    >
      <button
        type="button"
        data-testid="today-good-to-know-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
          <Info className="h-4 w-4" aria-hidden="true" />
          Good to know
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
            {count}
          </span>
        </span>
        <Chevron className="h-4 w-4 text-slate-500" aria-hidden="true" />
      </button>

      {open ? (
        <div className="mt-3 space-y-2">
          {lines.map((line, index) => (
            <Link
              key={`${line.source.route}-${line.source.entity_public_id ?? index}`}
              to={line.source.route}
              data-testid="today-good-to-know-line"
              className="block rounded-2xl border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-200 transition hover:border-slate-600"
            >
              {line.text}
            </Link>
          ))}
          {insights.map((insight) => (
            <Link
              key={insight.public_id}
              to="/notifications"
              data-testid="dashboard-insight-card"
              className="block rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-3 transition hover:border-cyan-500/40"
            >
              <span className="block text-sm font-semibold text-cyan-100">{insight.title}</span>
              {insight.body ? (
                <span className="mt-0.5 block text-sm text-cyan-300/90">{insight.body}</span>
              ) : null}
            </Link>
          ))}
          {insights.length > 0 ? (
            <Link
              to="/notifications"
              data-testid="dashboard-insights-view-all"
              className="inline-block text-xs font-medium text-cyan-300 hover:text-cyan-200"
            >
              View all
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
