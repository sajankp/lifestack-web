import { render, screen } from '@testing-library/react';
import type { ThemeWeight } from '../../types/investing';
import { ThemeSplitCard } from './ThemeSplitCard';

const WEIGHTS: ThemeWeight[] = [
  { theme: 'US Equities', weight: 55 },
  { theme: 'India Equities', weight: 30 },
  { theme: 'Gold', weight: 10 },
  { theme: 'Cash', weight: 5 },
];

const renderCard = (themeWeights: ThemeWeight[]) =>
  render(<ThemeSplitCard themeWeights={themeWeights} />);

describe('ThemeSplitCard', () => {
  it('renders a donut chart with theme rows sorted by weight', () => {
    renderCard(WEIGHTS);

    expect(screen.getByTestId('theme-split-card')).toBeInTheDocument();
    expect(screen.getByText('Theme Split')).toBeInTheDocument();
    expect(screen.getByText('Total weight')).toBeInTheDocument();
    expect(screen.getByTestId('theme-total-pct')).toHaveTextContent('100.0%');

    // SVG donut slices
    expect(document.querySelectorAll('svg circle').length).toBe(4);

    expect(screen.getByText('US Equities')).toBeInTheDocument();
    expect(screen.getByText('55.0%')).toBeInTheDocument();
    expect(screen.getByText('30.0%')).toBeInTheDocument();
    expect(screen.getByText('10.0%')).toBeInTheDocument();
    expect(screen.getByText('5.0%')).toBeInTheDocument();
  });

  it('renders empty state when no theme weights exist', () => {
    renderCard([]);

    expect(screen.getByText('No theme weights')).toBeInTheDocument();
    expect(document.querySelectorAll('svg circle')).toHaveLength(0);
  });

  it('ignores zero-weight themes', () => {
    renderCard([...WEIGHTS, { theme: 'Empty', weight: 0 }]);

    expect(screen.queryByText('Empty')).not.toBeInTheDocument();
    expect(screen.getByTestId('theme-total-pct')).toHaveTextContent('100.0%');
  });
});
