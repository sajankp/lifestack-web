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

    fireEvent.change(screen.getByTestId('medication-name-input'), {
      target: { value: 'Vitamin D' },
    });
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

    fireEvent.change(screen.getByTestId('medication-name-input'), {
      target: { value: 'Vitamin D' },
    });
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

  it('switches to interval-from-last-dose mode, hides frequency, and submits daily', async () => {
    const onSubmit = vi.fn();
    render(<MedicationFormDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId('medication-name-input'), {
      target: { value: 'Interval Med' },
    });
    fireEvent.click(screen.getByTestId('medication-schedule-mode'));
    fireEvent.click(await screen.findByRole('option', { name: 'Every N days from last dose' }));

    // Frequency selector is hidden in interval mode; summary reflects the mode.
    expect(screen.queryByTestId('medication-frequency')).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId('medication-interval-input'), { target: { value: '2' } });
    expect(screen.getByTestId('medication-schedule-summary')).toHaveTextContent(
      'Every 2 days from your last dose, 09:00',
    );

    fireEvent.click(screen.getByTestId('medication-save-button'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.schedule_mode).toBe('interval_from_last_dose');
    expect(payload.frequency).toBe('daily');
    expect(payload.interval).toBe(2);
    expect(payload.days_of_week).toBeNull();
  });

  it('uses a native time picker for dose times, defaulting to one entry that cannot be removed', async () => {
    render(<MedicationFormDialog open onOpenChange={vi.fn()} onSubmit={vi.fn()} />);

    const timeInput = screen.getByTestId('medication-time-input-0');
    expect(timeInput).toHaveAttribute('type', 'time');
    expect(timeInput).toHaveValue('09:00');
    expect(screen.queryByTestId('medication-time-remove-0')).not.toBeInTheDocument();
  });

  it('supports adding and removing multiple dose times', async () => {
    const onSubmit = vi.fn();
    render(<MedicationFormDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId('medication-name-input'), { target: { value: 'Aspirin' } });
    fireEvent.click(screen.getByTestId('medication-time-add'));

    const secondTime = screen.getByTestId('medication-time-input-1');
    fireEvent.change(secondTime, { target: { value: '21:00' } });

    fireEvent.click(screen.getByTestId('medication-time-remove-0'));
    fireEvent.click(screen.getByTestId('medication-save-button'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.times).toEqual(['21:00']);
  });
});
