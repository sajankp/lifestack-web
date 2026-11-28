import React from 'react';
import { Link } from 'react-router';
import { CheckCircle2 } from 'lucide-react';
import { SkeletonList } from '../../components/ui/FeedbackStates';
import type { BriefingLine } from '../../types/dashboard';

// spec-113 §3.2. The briefing's actionable lines as deep links, or a single "All clear ✓", never
// both. Information-only lines belong to "Good to know". Whether it is all clear is decided here,
// from the lines themselves, and only once the briefing has actually loaded: a failed check must
// never read as "all clear".

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

interface NeedsYouSectionProps {
  isLoading: boolean;
  isError: boolean;
  lines: BriefingLine[] | undefined;
}

export const NeedsYouSection: React.FC<NeedsYouSectionProps> = ({ isLoading, isError, lines }) => {
  const actionable = (lines ?? []).filter((line) => line.actionable);

  return (
    <section
      data-testid="today-needs-you"
      aria-busy={isLoading}
      className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 shadow-2xl shadow-black/10 sm:p-6"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Needs you</h2>

      {isLoading ? (
        <div className="mt-4">
          <SkeletonList rows={2} />
        </div>
      ) : isError ? (
        <p data-testid="today-needs-you-error" className="mt-3 text-sm text-slate-400">
          Couldn&apos;t check what needs you right now. Try refreshing.
        </p>
      ) : actionable.length === 0 ? (
        <div
          data-testid="today-all-clear"
          className="mt-3 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-3 text-emerald-200"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
          <p className="text-sm font-medium">All clear ✓</p>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {actionable.map((line, index) => (
            <li key={`${line.source.route}-${line.source.entity_public_id ?? index}`}>
              <Link
                to={line.source.route}
                data-testid="today-needs-you-line"
                className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-3 transition hover:border-slate-600"
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[line.severity]}`}
                />
                <span className={`text-sm ${SEVERITY_TEXT[line.severity]}`}>{line.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
