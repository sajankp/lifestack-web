import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { GoodToKnowSection } from './GoodToKnowSection';
import type { BriefingLine } from '../../types/dashboard';

// spec-113 §3.5: "Good to know", collapsed by default: the briefing's non-actionable lines (and the
// unread insights, which are information too).

const info = (text: string, route = '/summaries'): BriefingLine => ({
  severity: 'info',
  text,
  actionable: false,
  source: { route, entity_type: null, entity_public_id: null },
});

const insight = (id: string, title: string, severity = 'info', body: string | null = null) => ({
  public_id: id,
  title,
  body,
  severity,
});

const renderSection = (props: Partial<React.ComponentProps<typeof GoodToKnowSection>> = {}) =>
  render(
    <MemoryRouter>
      <GoodToKnowSection lines={[]} insights={[]} {...props} />
    </MemoryRouter>,
  );

describe('GoodToKnowSection', () => {
  it('is collapsed by default, with a count on the toggle', () => {
    renderSection({ lines: [info('Net worth up 1.2% this week')] });

    const toggle = screen.getByTestId('today-good-to-know-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveTextContent('Good to know');
    expect(toggle).toHaveTextContent('1');
    expect(screen.queryByText('Net worth up 1.2% this week')).not.toBeInTheDocument();
  });

  it('opens and closes on the toggle', async () => {
    renderSection({ lines: [info('Net worth up 1.2% this week')] });
    const toggle = screen.getByTestId('today-good-to-know-toggle');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Net worth up 1.2% this week')).toBeInTheDocument();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Net worth up 1.2% this week')).not.toBeInTheDocument();
  });

  it('lists the information lines as links', async () => {
    renderSection({
      lines: [
        info('Weekly summary is ready', '/summaries'),
        info('2 recurring bills due', '/spending'),
      ],
    });

    await userEvent.click(screen.getByTestId('today-good-to-know-toggle'));

    const rows = screen.getAllByTestId('today-good-to-know-line');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute('href', '/summaries');
    expect(rows[1]).toHaveAttribute('href', '/spending');
  });

  it('includes unread insights, with their body, linking to Notifications', async () => {
    renderSection({
      insights: [insight('i-1', 'Spending is steady', 'info', 'About the same as last month.')],
    });

    await userEvent.click(screen.getByTestId('today-good-to-know-toggle'));

    const card = screen.getByTestId('dashboard-insight-card');
    expect(card).toHaveTextContent('Spending is steady');
    expect(card).toHaveTextContent('About the same as last month.');
    expect(card).toHaveAttribute('href', '/notifications');
    expect(screen.getByTestId('dashboard-insights-view-all')).toHaveAttribute(
      'href',
      '/notifications',
    );
  });

  it('counts lines and insights together', () => {
    renderSection({
      lines: [info('one'), info('two')],
      insights: [insight('i-1', 'three')],
    });

    expect(screen.getByTestId('today-good-to-know-toggle')).toHaveTextContent('3');
  });

  it('renders nothing at all when there is nothing to know', () => {
    renderSection();

    expect(screen.queryByTestId('today-good-to-know')).not.toBeInTheDocument();
  });
});
