import { z } from 'zod';
import api from './api';
import {
  HealthMetricSchema,
  HealthRecordDetailSchema,
  HealthRecordsPageSchema,
  HealthSeriesSchema,
} from '../types/healthRecords';
import type {
  HealthMetric,
  HealthRecordDetail,
  HealthRecordsPage,
  HealthSeries,
} from '../types/healthRecords';

export type {
  HealthMetric,
  HealthRecord,
  HealthRecordDetail,
  HealthRecordsPage,
  HealthSeries,
  MeasurementPoint,
  SeriesStats,
} from '../types/healthRecords';

/** Read-only: generic results are written through MCP (spec-110), never from the web. */
export const healthRecordsService = {
  getMetrics: async (): Promise<HealthMetric[]> => {
    const response = await api.get('/health/metrics');
    return z.array(HealthMetricSchema).parse(response.data);
  },

  getSeries: async (
    code: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<HealthSeries> => {
    const response = await api.get(`/health/metrics/${encodeURIComponent(code)}/series`, {
      params: { limit, offset },
    });
    return HealthSeriesSchema.parse(response.data);
  },

  getRecords: async (limit: number = 25, offset: number = 0): Promise<HealthRecordsPage> => {
    const response = await api.get('/health/records', { params: { limit, offset } });
    return HealthRecordsPageSchema.parse(response.data);
  },

  getRecord: async (publicId: string): Promise<HealthRecordDetail> => {
    const response = await api.get(`/health/records/${publicId}`);
    return HealthRecordDetailSchema.parse(response.data);
  },
};
