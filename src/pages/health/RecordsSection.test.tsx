import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

import { RecordsSection } from './RecordsSection';
import { server } from '../../test/setup';

const renderSection = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RecordsSection />
    </QueryClientProvider>,
  );
};

// Shapes mirror lifestack-api `app/health/measurements/schemas.py` (Decimals are strings).
const ldlMetric = {
  public_id: 'metric-ldl',
  code: 'ldl_cholesterol',
  name: 'LDL Cholesterol',
  category: 'lipid',
  value_type: 'numeric',
  canonical_unit: 'mg/dL',
  unit_conversions: { 'mmol/L': { factor: '38.67', offset: '0' } },
  aliases: ['LDL-C'],
  min_value: null,
  max_value: null,
  measurement_count: 3,
  latest: {
    measured_on: '2026-11-10',
    value: '4.000000',
    value_text: null,
    comparator: null,
    unit: 'mmol/L',
  },
};
const weightMetric = {
  ...ldlMetric,
  public_id: 'metric-w',
  code: 'body_weight',
  name: 'Body weight',
  category: 'body',
  canonical_unit: 'kg',
  unit_conversions: null,
  aliases: ['weight'],
  measurement_count: 9,
};
const urineMetric = {
  ...ldlMetric,
  public_id: 'metric-u',
  code: 'urine_protein',
  name: 'Urine protein',
  category: 'other',
  value_type: 'text',
  canonical_unit: null,
  unit_conversions: null,
  aliases: [],
  measurement_count: 1,
  latest: {
    measured_on: '2026-11-10',
    value: null,
    value_text: 'Negative',
    comparator: null,
    unit: null,
  },
};

const point = (over: Record<string, unknown>) => ({
  public_id: 'p',
  measured_on: '2026-11-10',
  measured_at: null,
  value: '100.000000',
  comparator: null,
  value_text: null,
  unit: 'mg/dL',
  canonical_value: '100.000000',
  converted: false,
  ref_low: null,
  ref_high: null,
  ref_text: null,
  in_range: null,
  record_public_id: 'rec-1',
  note: null,
  source_type: 'mcp',
  source_ref: null,
  metric_code: null,
  metric_name: null,
  ...over,
});

const series = {
  metric: ldlMetric,
  points: [
    point({
      public_id: 'p3',
      measured_on: '2026-11-10',
      value: '4.000000',
      unit: 'mmol/L',
      canonical_value: '154.680000',
      converted: true,
      ref_high: '3.400000',
      in_range: 'high',
      note: 'fasting',
    }),
    point({
      public_id: 'p2',
      measured_on: '2026-11-01',
      value: '20.000000',
      comparator: '<',
      canonical_value: '20.000000',
    }),
    point({
      public_id: 'p1',
      measured_on: '2026-08-01',
      value: '100.000000',
      canonical_value: '100.000000',
      ref_low: '50.000000',
      ref_high: '130.000000',
      in_range: 'normal',
    }),
    point({
      public_id: 'p0',
      measured_on: '2026-05-01',
      value: '90.000000',
      canonical_value: '90.000000',
    }),
  ],
  stats: {
    count: 4,
    latest: '154.680000',
    latest_on: '2026-11-10',
    min: '90.000000',
    max: '154.680000',
    delta_7d: null,
    delta_30d: '54.680000',
  },
  total: 4,
  limit: 100,
  offset: 0,
  has_more: false,
};

const record = {
  public_id: 'rec-1',
  kind: 'lab_report',
  title: 'Lipid panel',
  recorded_on: '2026-11-10',
  provider: 'Metropolis',
  note: 'Extracted from the emailed PDF',
  source_type: 'mcp',
  source_ref: 'metropolis-777',
  measurement_count: 2,
  created_at: '2026-11-11T05:00:00Z',
};

const useData = () =>
  server.use(
    http.get('*/v1/health/metrics', () =>
      HttpResponse.json([weightMetric, ldlMetric, urineMetric]),
    ),
    http.get('*/v1/health/records', () =>
      HttpResponse.json({ items: [record], total: 1, limit: 25, offset: 0 }),
    ),
    http.get('*/v1/health/metrics/ldl_cholesterol/series', () => HttpResponse.json(series)),
    http.get('*/v1/health/records/rec-1', () =>
      HttpResponse.json({
        ...record,
        measurements: [
          point({
            public_id: 'm1',
            metric_code: 'ldl_cholesterol',
            metric_name: 'LDL Cholesterol',
            value: '4.000000',
            unit: 'mmol/L',
            ref_high: '3.400000',
            in_range: 'high',
          }),
          point({
            public_id: 'm2',
            metric_code: 'urine_protein',
            metric_name: 'Urine protein',
            value: null,
            value_text: 'Negative',
            unit: null,
            canonical_value: null,
          }),
        ],
      }),
    ),
  );

describe('RecordsSection', () => {
  it('shows an empty state that says how results get here', async () => {
    server.use(
      http.get('*/v1/health/metrics', () => HttpResponse.json([weightMetric])),
      http.get('*/v1/health/records', () =>
        HttpResponse.json({ items: [], total: 0, limit: 25, offset: 0 }),
      ),
    );
    renderSection();
    expect(await screen.findByTestId('records-empty')).toHaveTextContent(/assistant \(MCP\)/);
  });

  it('lists metrics (not weight, which has its own section) and records', async () => {
    useData();
    renderSection();

    const list = await screen.findByTestId('metrics-list');
    expect(within(list).getByText('LDL Cholesterol')).toBeInTheDocument();
    expect(within(list).getByText('Urine protein')).toBeInTheDocument();
    expect(within(list).queryByText('Body weight')).not.toBeInTheDocument();
    expect(within(list).getByText(/4 mmol\/L/)).toBeInTheDocument();
    expect(within(list).getByText('Negative')).toBeInTheDocument();
    expect(
      within(await screen.findByTestId('records-list')).getByText('Lipid panel'),
    ).toBeInTheDocument();
  });

  it('opens a metric: stats, converted units, range chips, reference band and source labels', async () => {
    useData();
    renderSection();

    fireEvent.click(await screen.findByTestId('metric-ldl_cholesterol'));
    const panel = await screen.findByTestId('metric-series-panel');

    expect(within(panel).getByTestId('tile-Latest')).toHaveTextContent('154.68 mg/dL');
    expect(within(panel).getByTestId('tile-Δ 30 days')).toHaveTextContent('+54.68 mg/dL');
    expect(within(panel).getByTestId('tile-Δ 7 days')).toHaveTextContent('—');
    expect(within(panel).getByTestId('tile-Results')).toHaveTextContent('4');
    const table = within(panel).getByTestId('metric-points-table');
    expect(within(table).getByText(/converted from mmol\/L/)).toBeInTheDocument();
    expect(within(table).getByTestId('in-range-high')).toBeInTheDocument();
    expect(within(table).getByTestId('in-range-normal')).toBeInTheDocument();
    expect(within(table).getByText('<20 mg/dL')).toBeInTheDocument(); // threshold row, unflagged
    expect(within(table).getByText('fasting')).toBeInTheDocument();
    expect(within(table).getAllByText('Added via assistant (MCP)')).toHaveLength(4);
    // Latest report's range (≤ 3.4 mmol/L = 131.48 mg/dL) is drawn as a band.
    expect(within(panel).getByTestId('reference-band')).toBeInTheDocument();
    expect(within(panel).getByTestId('metric-series-chart')).toBeInTheDocument();

    fireEvent.click(within(panel).getByText('Close'));
    expect(screen.queryByTestId('metric-series-panel')).not.toBeInTheDocument();
  });

  it('opens a record with its free source note, provider and every result', async () => {
    useData();
    renderSection();

    fireEvent.click(await screen.findByTestId('record-rec-1'));
    const panel = await screen.findByTestId('record-detail-panel');

    expect(within(panel).getByTestId('record-note')).toHaveTextContent(
      'Extracted from the emailed PDF',
    );
    expect(panel).toHaveTextContent('Metropolis');
    expect(panel).toHaveTextContent('Source reference: metropolis-777');
    expect(within(panel).getByText('LDL Cholesterol')).toBeInTheDocument();
    expect(within(panel).getByText('Urine protein')).toBeInTheDocument();
    expect(within(panel).getByTestId('in-range-high')).toBeInTheDocument();
    expect(within(panel).getByText(/Negative/)).toBeInTheDocument();
  });

  it('jumps from a result to the record it came from', async () => {
    useData();
    renderSection();

    fireEvent.click(await screen.findByTestId('metric-ldl_cholesterol'));
    const table = await screen.findByTestId('metric-points-table');
    fireEvent.click(within(table).getAllByText('Added via assistant (MCP)')[0]);

    expect(await screen.findByTestId('record-detail-panel')).toHaveTextContent('Lipid panel');
  });

  it('shows an error, not an empty state, when the request fails', async () => {
    server.use(
      http.get('*/v1/health/metrics', () => HttpResponse.json({ detail: 'boom' }, { status: 500 })),
      http.get('*/v1/health/records', () =>
        HttpResponse.json({ items: [], total: 0, limit: 25, offset: 0 }),
      ),
    );
    renderSection();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load results');
    expect(screen.queryByTestId('records-empty')).not.toBeInTheDocument();
  });

  it('fails loudly when the API shape drifts instead of rendering an empty list', async () => {
    server.use(
      http.get(
        '*/v1/health/metrics',
        () => HttpResponse.json([{ code: 'x', name: 'X' }]), // required fields missing
      ),
      http.get('*/v1/health/records', () =>
        HttpResponse.json({ items: [], total: 0, limit: 25, offset: 0 }),
      ),
    );
    renderSection();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByTestId('records-empty')).not.toBeInTheDocument();
  });
});
