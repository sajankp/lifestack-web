import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { MedicationFormDialog } from './MedicationFormDialog';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('MedicationFormDialog', () => {
  it('shows the live natural-language schedule summary and updates it on frequency change', async () => {
    render(<MedicationFormDialog open onOpenChange={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByTestId('medication-schedule-summary')).toHaveTextContent('Every day, 09:00');
  });

  it('reveals weekday toggles for weekly frequency and requires at least one selection', async () => {
    const onSubmit = vi.fn();
    render(<MedicationFormDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId('medication-name-input'), { target: { value: 'Vitamin D' } });
    fireEvent.click(screen.getByTestId('medication-frequency'));
    fireEvent.click(await screen.findByRole('option', { name: 'Weekly' }));

    expect(screen.getByTestId('medication-weekday')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('medication-save-button'));

    await waitFor(() => {
      expect(screen.getByText('Select at least one day of the week')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a valid weekly schedule with selected weekdays', async () => {
    const onSubmit = vi.fn();
    render(<MedicationFormDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId('medication-name-input'), { target: { value: 'Vitamin D' } });
    fireEvent.click(screen.getByTestId('medication-frequency'));
    fireEvent.click(await screen.findByRole('option', { name: 'Weekly' }));
    fireEvent.click(screen.getByTestId('medication-weekday-0'));
    fireEvent.click(screen.getByTestId('medication-weekday-2'));

    fireEvent.click(screen.getByTestId('medication-save-button'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.frequency).toBe('weekly');
    expect(payload.days_of_week).toEqual([0, 2]);
    expect(payload.name).toBe('Vitamin D');
  });

  it('rejects malformed dose times', async () => {
    const onSubmit = vi.fn();
    render(<MedicationFormDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId('medication-name-input'), { target: { value: 'Aspirin' } });
    fireEvent.change(screen.getByTestId('medication-times-input'), { target: { value: 'not-a-time' } });
    fireEvent.click(screen.getByTestId('medication-save-button'));

    await waitFor(() => {
      expect(
        screen.getByText('Use 24-hour HH:MM times, comma-separated (e.g. 09:00, 21:00)'),
      ).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
