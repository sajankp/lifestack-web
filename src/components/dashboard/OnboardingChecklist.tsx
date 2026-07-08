import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, ListChecks, X } from 'lucide-react';

export interface OnboardingChecklistAction {
  label: string;
  to: string;
}

export interface OnboardingChecklistStep {
  id: string;
  label: string;
  done: boolean;
  to?: string;
  actions?: OnboardingChecklistAction[];
  optional?: boolean;
}

interface OnboardingChecklistProps {
  workspaceId: string | null;
  steps: OnboardingChecklistStep[];
}

const dismissalKey = (workspaceId: string) => `lifestack:onboarding-dismissed:${workspaceId}`;

const workspaceStorageKey = (workspaceId: string | null) => workspaceId ?? '__none__';

export const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({ workspaceId, steps }) => {
  // Dismissal is read directly from localStorage during render (it's a plain
  // synchronous read, not a subscription), then mirrored into state — keyed
  // by workspace — only so the "Dismiss" click can trigger a re-render
  // without a page reload. Keying by workspace stops a dismissal in one
  // workspace from suppressing the checklist after switching to another.
  const [sessionDismissedByWorkspace, setSessionDismissedByWorkspace] = useState<Record<string, boolean>>({});
  const persistedDismissed = workspaceId ? window.localStorage.getItem(dismissalKey(workspaceId)) === '1' : false;
  const dismissed = sessionDismissedByWorkspace[workspaceStorageKey(workspaceId)] || persistedDismissed;

  const requiredSteps = steps.filter((step) => !step.optional);
  const allRequiredDone = requiredSteps.length > 0 && requiredSteps.every((step) => step.done);

  if (dismissed || allRequiredDone) return null;

  const doneCount = steps.filter((step) => step.done).length;

  const handleDismiss = () => {
    setSessionDismissedByWorkspace((prev) => ({ ...prev, [workspaceStorageKey(workspaceId)]: true }));
    if (workspaceId) {
      window.localStorage.setItem(dismissalKey(workspaceId), '1');
    }
  };

  return (
    <section
      data-testid="dashboard-onboarding-checklist"
      className="mb-6 rounded-3xl border border-cyan-500/20 bg-cyan-950/10 p-6 shadow-2xl shadow-black/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <ListChecks className="h-5 w-5 text-cyan-400" />
          <div>
            <h2 className="text-xl font-semibold text-white">Get started</h2>
            <p className="mt-1 text-sm text-slate-400">
              {doneCount} of {steps.length} steps done
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          data-testid="dashboard-onboarding-dismiss"
          aria-label="Dismiss get-started checklist"
          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="mt-4 space-y-2">
        {steps.map((step) => {
          const rowClassName = `flex items-center gap-3 rounded-2xl border p-3 transition ${
            step.done
              ? 'border-slate-800 bg-slate-900/40 text-slate-500'
              : 'border-slate-700 bg-slate-900/60 text-slate-200'
          }`;
          const icon = step.done ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          ) : (
            <Circle className="h-5 w-5 shrink-0 text-slate-500" />
          );
          const label = <span className={step.done ? 'line-through' : ''}>{step.label}</span>;
          const optionalTag = step.optional && !step.done ? (
            <span className="ml-auto text-xs uppercase tracking-wide text-slate-500">Optional</span>
          ) : null;

          if (step.actions && step.actions.length > 0) {
            return (
              <li key={step.id} data-testid={`dashboard-onboarding-step-${step.id}`} className={rowClassName}>
                {icon}
                {label}
                {optionalTag}
                <div className="ml-auto flex gap-2">
                  {step.actions.map((action) => (
                    <Link
                      key={action.to}
                      to={action.to}
                      className="rounded-lg border border-slate-600/70 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:border-cyan-500/40 hover:bg-slate-800/60"
                    >
                      {action.label}
                    </Link>
                  ))}
                </div>
              </li>
            );
          }

          return (
            <li key={step.id}>
              <Link
                to={step.to ?? '#'}
                data-testid={`dashboard-onboarding-step-${step.id}`}
                className={`${rowClassName} hover:border-cyan-500/40 hover:bg-slate-800/60`}
              >
                {icon}
                {label}
                {optionalTag}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
