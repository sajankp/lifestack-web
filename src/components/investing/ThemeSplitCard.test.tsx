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

  it('shows readable theme names for machine keys', () => {
    render(<ThemeSplitCard themeWeights={{ semis_ai: 30, clean_energy: 20 }} />);

    expect(screen.getAllByText('Semis & AI').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Clean energy').length).toBeGreaterThan(0);
    expect(screen.queryByText('semis_ai')).not.toBeInTheDocument();
  });

  it('explains the gap when the themes do not add up to the whole portfolio', () => {
    render(<ThemeSplitCard themeWeights={{ semis_ai: 50, gold: 34 }} />);

    expect(screen.getByTestId('theme-gap')).toHaveTextContent('84% grouped, 16% not itemised');
  });

  it('shows no gap line when the themes cover the portfolio', () => {
    renderCard(WEIGHTS);

    expect(screen.queryByTestId('theme-gap')).not.toBeInTheDocument();
  });
});
