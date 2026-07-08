import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { OnboardingChecklist } from './OnboardingChecklist';
import type { OnboardingChecklistStep } from './OnboardingChecklist';

const renderChecklist = (workspaceId: string | null, steps: OnboardingChecklistStep[]) =>
  render(
    <MemoryRouter>
      <OnboardingChecklist workspaceId={workspaceId} steps={steps} />
    </MemoryRouter>,
  );

const baseSteps: OnboardingChecklistStep[] = [
  { id: 'currency', label: 'Set your reporting currency', done: false, to: '/settings?tab=currency' },
  { id: 'account', label: 'Add your first account', done: false, to: '/settings?tab=accounts' },
  {
    id: 'activity',
    label: 'Add your first transaction or todo',
    done: false,
    actions: [
      { label: 'Add transaction', to: '/spending?new=1' },
      { label: 'Add todo', to: '/todo?new=1' },
    ],
  },
  { id: 'push', label: 'Enable push reminders', done: false, to: '/notifications', optional: true },
];

afterEach(() => {
  window.localStorage.clear();
});

describe('OnboardingChecklist', () => {
  it('renders steps with correct deep links when incomplete', () => {
    renderChecklist('ws-1', baseSteps);

    expect(screen.getByText('Get started')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-onboarding-step-currency')).toHaveAttribute(
      'href',
      '/settings?tab=currency',
    );
    expect(screen.getByTestId('dashboard-onboarding-step-account')).toHaveAttribute(
      'href',
      '/settings?tab=accounts',
    );
    expect(screen.getByText('Add transaction')).toHaveAttribute('href', '/spending?new=1');
    expect(screen.getByText('Add todo')).toHaveAttribute('href', '/todo?new=1');
    expect(screen.getByText('Optional')).toBeInTheDocument();
  });

  it('hides itself once all required (non-optional) steps are done, even if the optional step is not', () => {
    const steps = baseSteps.map((step) =>
      step.optional ? step : { ...step, done: true },
    );
    renderChecklist('ws-1', steps);

    expect(screen.queryByText('Get started')).not.toBeInTheDocument();
  });

  it('dismisses on click and persists dismissal per workspace in localStorage', () => {
    renderChecklist('ws-1', baseSteps);
    expect(screen.getByText('Get started')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('dashboard-onboarding-dismiss'));
    expect(screen.queryByText('Get started')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('lifestack:onboarding-dismissed:ws-1')).toBe('1');
  });

  it('does not resurface a dismissed checklist on remount for the same workspace', () => {
    window.localStorage.setItem('lifestack:onboarding-dismissed:ws-1', '1');
    renderChecklist('ws-1', baseSteps);

    expect(screen.queryByText('Get started')).not.toBeInTheDocument();
  });

  it('keeps the checklist visible for a different workspace even if another workspace dismissed it', () => {
    window.localStorage.setItem('lifestack:onboarding-dismissed:ws-1', '1');
    renderChecklist('ws-2', baseSteps);

    expect(screen.getByText('Get started')).toBeInTheDocument();
  });

  it('does not carry an in-session dismissal over to a different workspace after switching without unmounting', () => {
    // Regression test: dismissing in workspace A while the component stays
    // mounted (e.g. the user switches workspaces via the header, which
    // re-renders DashboardPage rather than remounting it) must not suppress
    // the checklist for workspace B.
    const { rerender } = renderChecklist('ws-1', baseSteps);

    fireEvent.click(screen.getByTestId('dashboard-onboarding-dismiss'));
    expect(screen.queryByText('Get started')).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <OnboardingChecklist workspaceId="ws-2" steps={baseSteps} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Get started')).toBeInTheDocument();
  });
});
