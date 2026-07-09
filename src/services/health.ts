import { z } from 'zod';
import api from './api';
import {
  DoseSlotSchema,
  MedicationEventResponseSchema,
  MedicationSchema,
  WeightEntrySchema,
  WeightTrendSchema,
} from '../types/health';
import type {
  Medication,
  MedicationCreate,
  MedicationEventResponse,
  MedicationEventUpsert,
  MedicationUpdate,
  WeightEntry,
  WeightEntryCreate,
  WeightTrend,
} from '../types/health';

export {
  DoseSlotSchema,
  MedicationEventResponseSchema,
  MedicationSchema,
  WeightEntrySchema,
  WeightTrendSchema,
} from '../types/health';
export type {
  DoseSlot,
  Medication,
  MedicationCreate,
  MedicationEventResponse,
  MedicationEventUpsert,
  MedicationFrequency,
  MedicationUpdate,
  WeightEntry,
  WeightEntryCreate,
  WeightTrend,
} from '../types/health';

const PaginatedMedicationsSchema = z.object({
  items: z.array(MedicationSchema).default([]),
  total: z.number().default(0),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

const PaginatedWeightSchema = z.object({
  items: z.array(WeightEntrySchema).default([]),
  total: z.number().default(0),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

export const healthService = {
  getMedications: async (
    isActive?: boolean,
    limit: number = 50,
    offset: number = 0,
  ): Promise<z.infer<typeof PaginatedMedicationsSchema>> => {
    const params: Record<string, string | number | boolean> = { limit, offset };
    if (isActive !== undefined) {
      params.is_active = isActive;
    }
    const response = await api.get('/health/medications', { params });
    return PaginatedMedicationsSchema.parse(response.data);
  },

  createMedication: async (medication: MedicationCreate): Promise<Medication> => {
    const response = await api.post('/health/medications', medication);
    return MedicationSchema.parse(response.data);
  },

  updateMedication: async (publicId: string, medication: MedicationUpdate): Promise<Medication> => {
    const response = await api.patch(`/health/medications/${publicId}`, medication);
    return MedicationSchema.parse(response.data);
  },

  deleteMedication: async (publicId: string): Promise<void> => {
    await api.delete(`/health/medications/${publicId}`);
  },

  getSchedule: async (date: string) => {
    const response = await api.get('/health/medications/schedule', { params: { date } });
    return z.array(DoseSlotSchema).parse(response.data);
  },

  upsertMedicationEvent: async (
    medicationPublicId: string,
    payload: MedicationEventUpsert,
  ): Promise<MedicationEventResponse> => {
    const response = await api.put(`/health/medications/${medicationPublicId}/events`, payload);
    return MedicationEventResponseSchema.parse(response.data);
  },

  getWeightEntries: async (
    start?: string,
    end?: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<z.infer<typeof PaginatedWeightSchema>> => {
    const params: Record<string, string | number> = { limit, offset };
    if (start) params.start = start;
    if (end) params.end = end;
    const response = await api.get('/health/weight', { params });
    return PaginatedWeightSchema.parse(response.data);
  },

  createWeightEntry: async (entry: WeightEntryCreate): Promise<WeightEntry> => {
    const response = await api.post('/health/weight', entry);
    return WeightEntrySchema.parse(response.data);
  },

  deleteWeightEntry: async (publicId: string): Promise<void> => {
    await api.delete(`/health/weight/${publicId}`);
  },

  getWeightTrend: async (days: number = 30): Promise<WeightTrend> => {
    const response = await api.get('/health/weight/trend', { params: { days } });
    return WeightTrendSchema.parse(response.data);
  },
};
