import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { MoneyNavTabs } from './MoneyNavTabs';

describe('MoneyNavTabs', () => {
  it('links to the four Money sections', () => {
    render(
      <MemoryRouter initialEntries={['/money/accounts']}>
        <MoneyNavTabs />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('money-tab-activity')).toHaveAttribute('href', '/money');
    expect(screen.getByTestId('money-tab-accounts')).toHaveAttribute('href', '/money/accounts');
    expect(screen.getByTestId('money-tab-budget')).toHaveAttribute('href', '/money/budget');
    expect(screen.getByTestId('money-tab-spending')).toHaveAttribute('href', '/money/spending');
    expect(screen.getByTestId('money-tab-accounts')).toHaveAttribute('aria-current', 'page');
  });
});
