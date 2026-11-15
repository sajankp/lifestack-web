import { useLayoutEffect, useState } from 'react';

/**
 * Tracks the rendered pixel width of an element so SVG charts can lay out in
 * real pixels instead of scaling a fixed 800-unit viewBox (which shrinks axis
 * labels to ~4px on a phone).
 *
 * Returns a callback ref (not an object ref) because the chart container is
 * usually mounted later than the component itself — after a loading or
 * empty-state branch — and the observer must attach whenever it appears.
 *
 * `fallback` is used until a real measurement exists, and whenever the element
 * has no layout (jsdom, a hidden tab) or `ResizeObserver` is unavailable.
 * `min` stops very narrow containers from producing an unusable plot area.
 */
export function useChartWidth<T extends HTMLElement>(
  fallback = 800,
  min = 280,
): readonly [(node: T | null) => void, number] {
  const [element, setElement] = useState<T | null>(null);
  const [width, setWidth] = useState(fallback);

  useLayoutEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return;

    const update = () => {
      const measured = Math.round(element.clientWidth);
      if (measured > 0) setWidth(Math.max(min, measured));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, min]);

  return [setElement, width] as const;
}
