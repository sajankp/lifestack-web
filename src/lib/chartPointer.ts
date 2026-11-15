import type { PointerEvent } from 'react';

/**
 * Maps a pointer position over an SVG chart to the index of the data point
 * (or bar) under it.
 *
 * Touch pointers are implicitly captured by the element the finger landed on,
 * so per-point `pointerenter` never fires while scrubbing; one handler on the
 * <svg> that resolves the index from the x position works for mouse and touch.
 *
 * `left`/`right` are the plot's bounds in viewBox units. With `bins`, items
 * occupy equal-width slots (bar charts); otherwise points sit on the bounds
 * and are spaced evenly between them (line charts).
 */
export function indexFromPointer(
  event: PointerEvent<SVGSVGElement>,
  count: number,
  viewWidth: number,
  left: number,
  right: number,
  mode: 'points' | 'bins' = 'points',
): number | null {
  if (count <= 0) return null;
  const rect = event.currentTarget.getBoundingClientRect();
  if (rect.width <= 0) return null;
  const x = ((event.clientX - rect.left) / rect.width) * viewWidth;
  const span = right - left;
  if (span <= 0) return null;
  const ratio = Math.min(1, Math.max(0, (x - left) / span));
  if (mode === 'bins') return Math.min(count - 1, Math.floor(ratio * count));
  return count === 1 ? 0 : Math.round(ratio * (count - 1));
}

/** Touch pointers "leave" the moment the finger lifts; keep the tooltip then. */
export const isTouchPointer = (event: { pointerType?: string }): boolean =>
  event.pointerType === 'touch';
