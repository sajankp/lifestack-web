import { z } from 'zod';

import fixture from '../test/fixtures/healthRecords.api.json';
import {
  HealthMetricSchema,
  HealthRecordDetailSchema,
  HealthRecordsPageSchema,
  HealthSeriesSchema,
} from './healthRecords';

// `healthRecords.api.json` is verbatim output of lifestack-api's /v1/health/{metrics,
// metrics/{code}/series,records,records/{id}} (spec-111), captured from the real routes, not
// hand-written. If the API changes shape, regenerate it from the API test run and fix the schema.
describe('health records API contract', () => {
  it('parses the real metrics response', () => {
    const metrics = z.array(HealthMetricSchema).parse(fixture.metrics);
    expect(metrics.map((m) => m.code).sort()).toEqual(['body_weight', 'ldl_cholesterol']);
    const ldl = metrics.find((m) => m.code === 'ldl_cholesterol');
    expect(ldl?.unit_conversions?.['mmol/L'].factor).toBeDefined();
    expect(ldl?.latest?.measured_on).toBe('2026-11-10');
  });

  it('parses the real series response, including converted, flagged and threshold points', () => {
    const series = HealthSeriesSchema.parse(fixture.series);
    const [newest, older] = series.points;
    expect(newest).toMatchObject({ unit: 'mmol/L', converted: true, in_range: 'high' });
    expect(older).toMatchObject({ comparator: '<', in_range: null });
    expect(series.stats.latest_on).toBe('2026-11-10');
  });

  it('parses the real records page and record detail', () => {
    const page = HealthRecordsPageSchema.parse(fixture.records);
    expect(page.items[0]).toMatchObject({ kind: 'lab_report', provider: 'Metropolis' });
    const detail = HealthRecordDetailSchema.parse(fixture.record);
    expect(detail.note).toBe('Extracted from the emailed PDF');
    expect(detail.measurements.every((m) => m.metric_code === 'ldl_cholesterol')).toBe(true);
  });

  it('rejects a response that drops a required field instead of defaulting it', () => {
    const broken = {
      ...fixture.series,
      points: [{ ...fixture.series.points[0], converted: undefined }],
    };
    expect(() => HealthSeriesSchema.parse(broken)).toThrow();
  });
});
