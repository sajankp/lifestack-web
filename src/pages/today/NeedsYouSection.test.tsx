import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { NeedsYouSection } from './NeedsYouSection';
import type { BriefingLine } from '../../types/dashboard';

// spec-113 §3.2: the briefing's actionable lines (deep links), or a single "All clear ✓". Never both.

const line = (over: Partial<BriefingLine> & { text: string }): BriefingLine => ({
  severity: 'warning',
  actionable: true,
  source: { route: '/todo', entity_type: 'todo', entity_public_id: over.text },
  ...over,
});

const renderSection = (props: Partial<React.ComponentProps<typeof NeedsYouSection>> = {}) =>
  render(
    <MemoryRouter>
      <NeedsYouSection isLoading={false} isError={false} lines={[]} {...props} />
    </MemoryRouter>,
  );

describe('NeedsYouSection', () => {
  it('lists the actionable lines as deep links', () => {
    renderSection({
      lines: [
        line({ text: '1 overdue task: File ITR', severity: 'critical' }),
        line({
          text: 'Other budget at 90% with 3 days left',
          source: { route: '/spending/budgets', entity_type: null, entity_public_id: null },
        }),
      ],
    });

    const rows = screen.getAllByTestId('today-needs-you-line');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('1 overdue task: File ITR');
    expect(rows[0]).toHaveAttribute('href', '/todo');
    expect(rows[1]).toHaveAttribute('href', '/spending/budgets');
  });

  it('shows All clear, and no list, when there is nothing to act on', () => {
    renderSection({ lines: [] });

    expect(screen.getByTestId('today-all-clear')).toHaveTextContent('All clear ✓');
    expect(screen.queryByTestId('today-needs-you-line')).not.toBeInTheDocument();
  });

  it('never shows All clear and the list together', () => {
    renderSection({ lines: [line({ text: 'Take Metformin' })] });

    expect(screen.getByTestId('today-needs-you-line')).toBeInTheDocument();
    expect(screen.queryByTestId('today-all-clear')).not.toBeInTheDocument();
  });

  it('ignores information-only lines: with only those it is still All clear', () => {
    renderSection({
      lines: [line({ text: 'Net worth up 1.2% this week', severity: 'info', actionable: false })],
    });

    expect(screen.getByTestId('today-all-clear')).toBeInTheDocument();
    expect(screen.queryByText('Net worth up 1.2% this week')).not.toBeInTheDocument();
  });

  it('lists only the actionable lines when there is a mix', () => {
    renderSection({
      lines: [
        line({ text: 'Info only', severity: 'info', actionable: false }),
        line({ text: 'Pay the card bill' }),
      ],
    });

    const rows = screen.getAllByTestId('today-needs-you-line');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Pay the card bill');
    expect(screen.queryByText('Info only')).not.toBeInTheDocument();
  });

  it('does not say All clear while loading', () => {
    renderSection({ isLoading: true, lines: undefined });

    expect(screen.queryByTestId('today-all-clear')).not.toBeInTheDocument();
    expect(screen.getByTestId('today-needs-you')).toHaveAttribute('aria-busy', 'true');
  });

  it('does not say All clear when the briefing failed: it says it could not check', () => {
    renderSection({ isError: true, lines: undefined });

    expect(screen.queryByTestId('today-all-clear')).not.toBeInTheDocument();
    expect(screen.getByTestId('today-needs-you-error')).toHaveTextContent(/couldn.t check/i);
  });

  it('has a heading', () => {
    renderSection();
    expect(
      within(screen.getByTestId('today-needs-you')).getByRole('heading', { name: 'Needs you' }),
    ).toBeInTheDocument();
  });
});
