import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ThisMonthSection } from './ThisMonthSection';
import type { MonthBudgetStatus } from '../../types/spending';

// spec-113 §3.3: this month: spent · left in budget · not covered by a budget, from month_budget.

const status = (over: Partial<MonthBudgetStatus> = {}): MonthBudgetStatus => ({
  month: '2026-11',
  as_of: '2026-11-28',
  lines: [
    {
      kind: 'category',
      category_id: 'c1',
      category_name: 'Entertainment',
      category_group_id: null,
      category_group_name: null,
      limit: '120.00',
      spent: '108.00',
      remaining: '12.00',
      used_pct: 90,
      status: 'warning',
    },
  ],
  covered_spend: '108.00',
  covered_limit: '120.00',
  uncovered_spend: '692.05',
  used_pct: 90,
  breached_count: 0,
  total_spend: '800.05',
  ...over,
});

const renderSection = (monthBudget: MonthBudgetStatus | null) =>
  render(
    <MemoryRouter>
      <ThisMonthSection
        monthBudget={monthBudget}
        currency="USD"
        currencyDisplay="symbol"
        locale="en-US"
        decimalPlaces={2}
      />
    </MemoryRouter>,
  );

describe('ThisMonthSection', () => {
  it('shows spent, left in budget and not covered by a budget', () => {
    renderSection(status());

    expect(screen.getByTestId('today-month-spent')).toHaveTextContent('$800.05');
    expect(screen.getByTestId('today-month-left')).toHaveTextContent('$12.00');
    expect(screen.getByTestId('today-month-left')).toHaveTextContent('left in budget');
    expect(screen.getByTestId('dashboard-uncovered-spend')).toHaveTextContent(
      '$692.05 not covered by a budget',
    );
  });

  it('shows how much of the budgets is used, as one bar', () => {
    renderSection(status());

    const bar = screen.getByRole('progressbar', { name: 'Budget used' });
    expect(bar).toHaveAttribute('aria-valuenow', '90');
    expect(screen.getByTestId('today-month-used')).toHaveTextContent('90% of your budgets used');
  });

  it('says over by, and not a negative amount left, when the budgets are exceeded', () => {
    renderSection(
      status({
        covered_spend: '130.00',
        used_pct: 108.3,
        breached_count: 1,
        total_spend: '822.05',
      }),
    );

    expect(screen.getByTestId('today-month-left')).toHaveTextContent('$10.00');
    expect(screen.getByTestId('today-month-left')).toHaveTextContent('over budget');
    expect(screen.getByTestId('today-month-left')).not.toHaveTextContent('-');
    expect(screen.getByRole('progressbar', { name: 'Budget used' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
  });

  it('leaves out the not-covered line when nothing is uncovered', () => {
    renderSection(status({ uncovered_spend: '0.00', total_spend: '108.00' }));

    expect(screen.queryByTestId('dashboard-uncovered-spend')).not.toBeInTheDocument();
  });

  it('with no budgets: just what was spent, an invitation, and no left / not-covered figures', () => {
    renderSection(
      status({
        lines: [],
        covered_spend: '0',
        covered_limit: '0',
        uncovered_spend: '800.05',
        used_pct: null,
      }),
    );

    expect(screen.getByTestId('today-month-spent')).toHaveTextContent('$800.05');
    expect(screen.getByTestId('today-month-no-budgets')).toHaveTextContent('No budgets set');
    expect(screen.queryByTestId('today-month-left')).not.toBeInTheDocument();
    // Without budgets everything is "uncovered", which is just the spent figure again.
    expect(screen.queryByTestId('dashboard-uncovered-spend')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('says spending is unavailable when there is no answer', () => {
    renderSection(null);

    expect(screen.getByTestId('today-month-unavailable')).toHaveTextContent(
      /isn.t available right now/i,
    );
    expect(screen.queryByTestId('today-month-spent')).not.toBeInTheDocument();
  });

  it('links to the budgets', () => {
    renderSection(status());

    expect(screen.getByRole('link', { name: /budgets/i })).toHaveAttribute(
      'href',
      '/spending/budgets',
    );
  });
});
