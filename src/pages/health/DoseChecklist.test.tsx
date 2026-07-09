import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DoseChecklist } from './DoseChecklist';
import type { DoseSlot } from '../../services/health';

const makeSlot = (overrides: Partial<DoseSlot>): DoseSlot => ({
  medication_public_id: 'med-1',
  medication_name: 'Metformin',
  dose_text: '500 mg',
  scheduled_for: '2026-01-01T09:00:00Z',
  status: 'pending',
  event_public_id: null,
  note: null,
  ...overrides,
});

describe('DoseChecklist', () => {
  it('shows the empty state when there are no slots', () => {
    render(<DoseChecklist slots={[]} isLoading={false} onMarkTaken={vi.fn()} onMarkSkipped={vi.fn()} />);
    expect(screen.getByText('No medications scheduled today')).toBeInTheDocument();
  });

  it('renders a pending slot with taken/skipped actions', () => {
    const onMarkTaken = vi.fn();
    const onMarkSkipped = vi.fn();
    const slot = makeSlot({});
    render(<DoseChecklist slots={[slot]} isLoading={false} onMarkTaken={onMarkTaken} onMarkSkipped={onMarkSkipped} />);

    expect(screen.getByText('Metformin')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mark metformin taken/i }));
    expect(onMarkTaken).toHaveBeenCalledWith(slot);

    fireEvent.click(screen.getByRole('button', { name: /mark metformin skipped/i }));
    expect(onMarkSkipped).toHaveBeenCalledWith(slot);
  });

  it('renders a missed slot distinctly without action buttons', () => {
    const slot = makeSlot({ status: 'missed' });
    render(<DoseChecklist slots={[slot]} isLoading={false} onMarkTaken={vi.fn()} onMarkSkipped={vi.fn()} />);

    const row = screen.getByTestId(`dose-slot-${slot.medication_public_id}-${slot.scheduled_for}`);
    expect(row).toHaveAttribute('data-status', 'missed');
    expect(screen.getByText(/missed/)).toBeInTheDocument();
  });

  it('renders a taken slot with a status label instead of buttons', () => {
    const slot = makeSlot({ status: 'taken' });
    render(<DoseChecklist slots={[slot]} isLoading={false} onMarkTaken={vi.fn()} onMarkSkipped={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /mark metformin taken/i })).not.toBeInTheDocument();
    expect(screen.getByText('taken')).toBeInTheDocument();
  });
});
