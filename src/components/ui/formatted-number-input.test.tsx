import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FormattedNumberInput } from './formatted-number-input';

vi.mock('../../hooks/useDisplayProfile', () => ({
  useDisplayProfile: () => ({
    locale: 'en-IN',
    decimalPlaces: 2,
    currencyDisplay: 'symbol',
  }),
}));

const ControlledField = () => {
  const [value, setValue] = useState('1234567.5');
  return (
    <FormattedNumberInput
      aria-label="Amount"
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
};

describe('FormattedNumberInput', () => {
  it('shows configured grouping at rest and keeps a canonical value while editing', () => {
    render(<ControlledField />);
    const input = screen.getByRole('spinbutton', { name: 'Amount' });

    expect(input).toHaveValue('12,34,567.5');
    fireEvent.focus(input);
    expect(input).toHaveValue('1234567.5');

    fireEvent.change(input, { target: { value: '2,345,678.9' } });
    expect(input).toHaveValue('2345678.9');

    fireEvent.blur(input);
    expect(input).toHaveValue('23,45,678.9');
  });

  it('preserves numeric and min/max constraint validation', async () => {
    const InvalidField = () => {
      const [value, setValue] = useState('');
      return (
        <FormattedNumberInput
          aria-label="Constrained amount"
          value={value}
          min="0.01"
          max="100"
          step="0.01"
          onChange={(event) => setValue(event.target.value)}
        />
      );
    };
    render(<InvalidField />);
    const input = screen.getByRole('spinbutton', { name: 'Constrained amount' });

    fireEvent.change(input, { target: { value: 'not-a-number' } });
    await waitFor(() => expect(input).toBeInvalid());

    fireEvent.change(input, { target: { value: '-1' } });
    await waitFor(() => expect(input).toBeInvalid());

    fireEvent.change(input, { target: { value: '10.001' } });
    await waitFor(() => expect(input).toBeInvalid());

    fireEvent.change(input, { target: { value: '10.25' } });
    await waitFor(() => expect(input).toBeValid());
  });

  it('does not visually round high-precision values when configured to preserve them', () => {
    render(
      <FormattedNumberInput
        aria-label="Unit price"
        value="0.000001"
        maximumFractionDigits={6}
      />,
    );

    expect(screen.getByRole('spinbutton', { name: 'Unit price' })).toHaveValue('0.000001');
  });
});
