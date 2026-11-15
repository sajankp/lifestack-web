import { describe, expect, it } from 'vitest';
import type { PointerEvent } from 'react';
import { indexFromPointer, isTouchPointer } from './chartPointer';

const evt = (clientX: number, width = 400) =>
  ({
    clientX,
    currentTarget: { getBoundingClientRect: () => ({ left: 100, width }) },
  }) as unknown as PointerEvent<SVGSVGElement>;

describe('indexFromPointer', () => {
  // viewBox is 800 wide rendered at 400px, so 1px on screen = 2 viewBox units.
  it('snaps to the nearest point on a line chart', () => {
    expect(indexFromPointer(evt(100), 5, 800, 100, 700)).toBe(0);
    expect(indexFromPointer(evt(300), 5, 800, 100, 700)).toBe(2); // x=400 -> middle
    expect(indexFromPointer(evt(450), 5, 800, 100, 700)).toBe(4); // x=700 -> last
  });

  it('clamps outside the plot', () => {
    expect(indexFromPointer(evt(0), 5, 800, 100, 700)).toBe(0);
    expect(indexFromPointer(evt(900), 5, 800, 100, 700)).toBe(4);
  });

  it('uses equal-width slots for bar charts', () => {
    // plot 100..700 (600 wide), 3 bars -> slots of 200 units
    expect(indexFromPointer(evt(120), 3, 800, 100, 700, 'bins')).toBe(0); // x=40 -> clamped
    expect(indexFromPointer(evt(190), 3, 800, 100, 700, 'bins')).toBe(0); // x=180
    expect(indexFromPointer(evt(260), 3, 800, 100, 700, 'bins')).toBe(1); // x=320
    expect(indexFromPointer(evt(450), 3, 800, 100, 700, 'bins')).toBe(2); // x=700 -> edge
  });

  it('returns null for empty data or an unlaid-out svg', () => {
    expect(indexFromPointer(evt(200), 0, 800, 100, 700)).toBeNull();
    expect(indexFromPointer(evt(200, 0), 5, 800, 100, 700)).toBeNull();
  });

  it('handles a single point', () => {
    expect(indexFromPointer(evt(250), 1, 800, 100, 700)).toBe(0);
  });
});

describe('isTouchPointer', () => {
  it('distinguishes touch from mouse', () => {
    expect(isTouchPointer({ pointerType: 'touch' })).toBe(true);
    expect(isTouchPointer({ pointerType: 'mouse' })).toBe(false);
  });
});
