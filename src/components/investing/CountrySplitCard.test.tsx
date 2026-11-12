import { render, screen } from '@testing-library/react';
import { CountrySplitCard, extractCountryWeights } from './CountrySplitCard';

const COUNTRIES: Array<{ country: string; weight: number }> = [
  { country: 'US', weight: 55 },
  { country: 'IN', weight: 30 },
  { country: 'GB', weight: 10 },
  { country: 'AE', weight: 5 },
];

const renderCard = (countryWeights: Array<{ country: string; weight: number }>) =>
  render(<CountrySplitCard countryWeights={countryWeights} />);

describe('CountrySplitCard', () => {
  it('renders horizontal bars with per-country share of total', () => {
    renderCard(COUNTRIES);

    expect(screen.getByTestId('country-split-card')).toBeInTheDocument();
    expect(screen.getByText('Country Split')).toBeInTheDocument();
    expect(screen.getByText('Markets')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();

    COUNTRIES.forEach(({ country, weight }) => {
      expect(screen.getByText(country)).toBeInTheDocument();
      expect(screen.getByText(`${weight.toFixed(1)}%`)).toBeInTheDocument();
    });
  });

  it('renders empty state when no country data exists', () => {
    renderCard([]);

    expect(screen.getByText('No country split data')).toBeInTheDocument();
  });
});

describe('extractCountryWeights', () => {
  it('extracts countries array from foundation_json', () => {
    const foundationJson = {
      countries: JSON.stringify([
        { country: 'US', weight: 55 },
        { country: 'IN', weight: 30 },
      ]),
    } as Record<string, string>;

    expect(extractCountryWeights(foundationJson)).toEqual([
      { country: 'US', weight: 55 },
      { country: 'IN', weight: 30 },
    ]);
  });

  it('extracts from country_weights record', () => {
    const foundationJson = { country_weights: { US: '55', IN: '30' } } as unknown as Record<string, string>;

    expect(extractCountryWeights(foundationJson)).toEqual([
      { country: 'US', weight: 55 },
      { country: 'IN', weight: 30 },
    ]);
  });

  it('returns empty for null/undefined or missing data', () => {
    expect(extractCountryWeights(null)).toEqual([]);
    expect(extractCountryWeights(undefined)).toEqual([]);
    expect(extractCountryWeights({ foo: 'bar' })).toEqual([]);
  });

  it('sorts descending and drops non-positive weights', () => {
    const foundationJson = {
      countries: JSON.stringify([
        { country: 'IN', weight: 30 },
        { country: 'US', weight: 0 },
        { country: 'GB', weight: -5 },
        { country: 'AE', weight: 55 },
      ]),
    } as Record<string, string>;

    expect(extractCountryWeights(foundationJson)).toEqual([
      { country: 'AE', weight: 55 },
      { country: 'IN', weight: 30 },
    ]);
  });
});
