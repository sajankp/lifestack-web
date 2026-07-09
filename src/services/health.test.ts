import { describe, expect, it, vi, beforeEach } from 'vitest';
import api from './api';
import { healthService } from './health';

describe('healthService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls medication endpoints with expected params/bodies', async () => {
    vi.spyOn(api, 'get')
      .mockResolvedValueOnce({ data: { items: [], total: 0 } } as never)
      .mockResolvedValueOnce({ data: [] } as never);
    vi.spyOn(api, 'post').mockResolvedValueOnce({ data: { public_id: 'med-1' } } as never);
    vi.spyOn(api, 'patch').mockResolvedValueOnce({ data: { public_id: 'med-1' } } as never);
    vi.spyOn(api, 'delete').mockResolvedValueOnce({} as never);
    vi.spyOn(api, 'put').mockResolvedValueOnce({
      data: { public_id: 'evt-1', medication_public_id: 'med-1', status: 'taken' },
    } as never);

    await healthService.getMedications(true, 10, 0);
    await healthService.createMedication({
      name: 'Metformin',
      frequency: 'daily',
      anchor_date: '2026-01-01',
      times: ['09:00'],
    });
    await healthService.updateMedication('med-1', { dose_text: '1000 mg' });
    await healthService.deleteMedication('med-1');
    await healthService.getSchedule('2026-01-01');
    await healthService.upsertMedicationEvent('med-1', { scheduled_for: '2026-01-01T09:00:00Z', status: 'taken' });

    expect(api.get).toHaveBeenNthCalledWith(1, '/health/medications', {
      params: { limit: 10, offset: 0, is_active: true },
    });
    expect(api.post).toHaveBeenCalledWith('/health/medications', expect.objectContaining({ name: 'Metformin' }));
    expect(api.patch).toHaveBeenCalledWith('/health/medications/med-1', { dose_text: '1000 mg' });
    expect(api.delete).toHaveBeenCalledWith('/health/medications/med-1');
    expect(api.get).toHaveBeenNthCalledWith(2, '/health/medications/schedule', { params: { date: '2026-01-01' } });
    expect(api.put).toHaveBeenCalledWith('/health/medications/med-1/events', {
      scheduled_for: '2026-01-01T09:00:00Z',
      status: 'taken',
    });
  });

  it('calls weight endpoints with expected params/bodies', async () => {
    vi.spyOn(api, 'get')
      .mockResolvedValueOnce({ data: { items: [], total: 0 } } as never)
      .mockResolvedValueOnce({
        data: { entries: [], latest_kg: null, delta_7d_kg: null, delta_30d_kg: null, min_kg: null, max_kg: null },
      } as never);
    vi.spyOn(api, 'post').mockResolvedValueOnce({ data: { public_id: 'weight-1' } } as never);
    vi.spyOn(api, 'delete').mockResolvedValueOnce({} as never);

    await healthService.getWeightEntries('2026-01-01', '2026-01-31', 10, 0);
    await healthService.createWeightEntry({ measured_at: '2026-01-01T09:00:00Z', weight_kg: '72.4' });
    await healthService.deleteWeightEntry('weight-1');
    await healthService.getWeightTrend(7);

    expect(api.get).toHaveBeenNthCalledWith(1, '/health/weight', {
      params: { limit: 10, offset: 0, start: '2026-01-01', end: '2026-01-31' },
    });
    expect(api.post).toHaveBeenCalledWith('/health/weight', { measured_at: '2026-01-01T09:00:00Z', weight_kg: '72.4' });
    expect(api.delete).toHaveBeenCalledWith('/health/weight/weight-1');
    expect(api.get).toHaveBeenNthCalledWith(2, '/health/weight/trend', { params: { days: 7 } });
  });
});
