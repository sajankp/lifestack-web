import type { HealthMetric, MeasurementPoint } from '../../services/healthRecords';

/** "154.680000" -> "154.68". Values arrive as fixed-scale decimal strings. */
export const trimDecimal = (value: string): string => {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString('en-US', { maximumFractionDigits: 6, useGrouping: false });
};

/** "<0.5 mg/dL", "5.6 %", or the text result. */
export const formatReading = (p: MeasurementPoint): string => {
  if (p.value == null) return p.value_text ?? '—';
  const unit = p.unit ? ` ${p.unit}` : '';
  return `${p.comparator ?? ''}${trimDecimal(p.value)}${unit}`;
};

/** The report's own range, in the reading's own unit; empty when none was printed. */
export const formatRange = (p: MeasurementPoint): string => {
  if (p.ref_text) return p.ref_text;
  const { ref_low: low, ref_high: high } = p;
  if (low == null && high == null) return '';
  const unit = p.unit ? ` ${p.unit}` : '';
  if (low != null && high != null) return `${trimDecimal(low)}–${trimDecimal(high)}${unit}`;
  if (high != null) return `≤ ${trimDecimal(high)}${unit}`;
  return `≥ ${trimDecimal(low as string)}${unit}`;
};

/** Convert a reported value to the metric's canonical unit using its registered conversions. */
export const toCanonical = (
  value: string,
  unit: string | null,
  metric: HealthMetric,
): number | null => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const given = (unit ?? '').trim().toLowerCase();
  if (given === (metric.canonical_unit ?? '').trim().toLowerCase()) return n;
  for (const [name, rule] of Object.entries(metric.unit_conversions ?? {})) {
    if (name.trim().toLowerCase() === given) return n * Number(rule.factor) + Number(rule.offset);
  }
  return null;
};

/** What the label on a row says about who put it there (spec-069/110 data rule). */
export const sourceLabel = (sourceType: string): string => {
  if (sourceType === 'mcp') return 'Added via assistant (MCP)';
  if (sourceType === 'manual') return 'Entered manually';
  return sourceType;
};
