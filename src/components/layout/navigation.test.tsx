import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { NAV_LINKS } from './constants';
import { Sidebar } from './Sidebar';
import { MobileNavDrawer } from './MobileNavDrawer';
import { MobileBottomNav } from './MobileBottomNav';

// spec-113 §4.3: five primary destinations, with Health and Settings under More on phones.

describe('navigation links', () => {
  it('no longer has a Capture entry', () => {
    expect(NAV_LINKS.some((link) => link.to === '/capture')).toBe(false);
    expect(NAV_LINKS.some((link) => link.testId === 'nav-capture')).toBe(false);
    expect(NAV_LINKS.some((link) => link.label === 'Capture')).toBe(false);
  });

  it('has exactly the five primary destinations and removes tool links', () => {
    expect(NAV_LINKS.map(({ to, label, testId }) => ({ to, label, testId }))).toEqual([
      { to: '/', label: 'Today', testId: 'nav-dashboard' },
      { to: '/money', label: 'Money', testId: 'nav-money' },
      { to: '/portfolio', label: 'Investments', testId: 'nav-portfolio' },
      { to: '/todo', label: 'Tasks', testId: 'nav-todo' },
      { to: '/health', label: 'Health', testId: 'nav-health' },
    ]);
  });
});

describe('Sidebar', () => {
  it('renders the five primary destinations and Settings', () => {
    render(
      <MemoryRouter>
        <Sidebar collapsed={false} onToggle={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('nav-spending')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-summaries')).not.toBeInTheDocument();
    expect(screen.getByTestId('nav-money')).toHaveTextContent('Money');
    expect(screen.getByTestId('nav-portfolio')).toHaveTextContent('Investments');
    expect(screen.getByTestId('nav-todo')).toHaveTextContent('Tasks');
    expect(screen.getByTestId('nav-settings')).toBeInTheDocument();
  });
});

describe('MobileBottomNav', () => {
  it('shows Today, Money, Investments, Tasks and More', () => {
    render(
      <MemoryRouter initialEntries={['/money']}>
        <MobileBottomNav onMore={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('nav-dashboard-mobile-bottom')).toHaveAttribute('href', '/');
    expect(screen.getByTestId('nav-money-mobile-bottom')).toHaveAttribute('href', '/money');
    expect(screen.getByTestId('nav-portfolio-mobile-bottom')).toHaveAttribute('href', '/portfolio');
    expect(screen.getByTestId('nav-todo-mobile-bottom')).toHaveAttribute('href', '/todo');
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });
});

describe('MobileNavDrawer', () => {
  it('keeps the More destinations secondary to the bottom navigation', () => {
    render(
      <MemoryRouter>
        <MobileNavDrawer
          open
          onClose={() => {}}
          username="sajan"
          workspaces={[]}
          onSelectWorkspace={() => {}}
          isSelectingWorkspace={false}
          onLogout={() => {}}
          isLoggingOut={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('nav-health-mobile')).toHaveTextContent('Health');
    expect(screen.getByTestId('nav-settings-mobile')).toHaveTextContent('Settings');
  });
});
