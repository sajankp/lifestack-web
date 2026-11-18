import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeightTrendChart } from './WeightTrendChart';
import type { WeightEntry } from '../../services/health';

const entry = (weightKg: string): WeightEntry => ({
  public_id: `e-${weightKg}`,
  measured_at: '2026-11-01T08:00:00Z',
  weight_kg: weightKg,
  note: null,
  source_type: 'manual',
  created_at: '2026-11-01T08:00:00Z',
});

describe('WeightTrendChart', () => {
  it('uses a zero baseline so a small drop does not look like a cliff', () => {
    render(<WeightTrendChart entries={[entry('32'), entry('30.5'), entry('30.2')]} />);

    const svg = screen.getByTestId('weight-trend-chart');
    const circles = svg.querySelectorAll('circle');
    expect(circles).toHaveLength(3);

    const cy = Array.from(circles).map((c) => parseFloat(c.getAttribute('cy')!));
    const spread = Math.max(...cy) - Math.min(...cy);
    expect(spread).toBeGreaterThan(0);
    // 1.8 kg on a ~33 kg scale must stay a gentle slope, not fill the chart height.
    expect(spread / 200).toBeLessThan(0.25);
    // Bottom of the plot is the zero baseline, not the minimum value.
    expect(Math.max(...cy)).toBeLessThan(200 - 16 - 40);

    expect(screen.getByText('32.0 kg')).toBeInTheDocument();
    expect(screen.getByText('30.2 kg')).toBeInTheDocument();
  });

  it('prompts to log more entries when there is no trend yet', () => {
    render(<WeightTrendChart entries={[]} />);
    expect(screen.getByText(/Log a couple more entries/)).toBeInTheDocument();
  });
});
