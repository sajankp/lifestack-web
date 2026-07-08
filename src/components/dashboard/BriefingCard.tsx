import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, CheckCircle2 } from 'lucide-react';
import { SkeletonList } from '../ui/FeedbackStates';
import type { BriefingLine } from '../../types/dashboard';

interface BriefingCardProps {
  isLoading: boolean;
  isError: boolean;
  allClear?: boolean;
  lines?: BriefingLine[];
}

const SEVERITY_DOT: Record<BriefingLine['severity'], string> = {
  critical: 'bg-rose-500',
  warning: 'bg-amber-500',
  info: 'bg-cyan-500',
};

const SEVERITY_TEXT: Record<BriefingLine['severity'], string> = {
  critical: 'text-rose-100',
  warning: 'text-amber-100',
  info: 'text-slate-200',
};

export const BriefingCard: React.FC<BriefingCardProps> = ({ isLoading, isError, allClear, lines }) => {
  // Degrades to nothing on error — the briefing is additive, not load-bearing
  // (spec-067 §Rollout): a failed fetch should never block the rest of the
  // dashboard from rendering.
  if (isError) return null;

  return (
    <section
      data-testid="dashboard-briefing"
      className="mb-6 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl shadow-black/10"
    >
      <div className="flex items-center gap-3">
        <CalendarCheck className="h-5 w-5 text-cyan-400" />
        <h2 className="text-xl font-semibold text-white">Today</h2>
      </div>

      {isLoading ? (
        <div className="mt-4">
          <SkeletonList rows={3} />
        </div>
      ) : allClear || !lines || lines.length === 0 ? (
        <div
          data-testid="dashboard-briefing-all-clear"
          className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-4 text-emerald-200"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <p className="text-sm font-medium">All clear — nothing needs your attention today.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {(lines ?? []).map((line, index) => (
            <li key={`${line.source.route}-${line.source.entity_public_id ?? index}`}>
              <Link
                to={line.source.route}
                data-testid="dashboard-briefing-line"
                className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-3 transition hover:border-slate-600 hover:bg-slate-800/60"
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[line.severity]}`} />
                <span className={`text-sm ${SEVERITY_TEXT[line.severity]}`}>{line.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
