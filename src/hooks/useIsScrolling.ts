import { useEffect, useState } from 'react';

/**
 * True while the page is being scrolled and for `idleMs` after the last scroll
 * event. Used to tuck floating controls out of the way of the content that is
 * moving underneath them.
 */
export function useIsScrolling(idleMs = 500): boolean {
  const [isScrolling, setIsScrolling] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      setIsScrolling(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setIsScrolling(false), idleMs);
    };
    // Capture phase: scroll does not bubble, and the app may scroll an inner container.
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true });
      if (timer) clearTimeout(timer);
    };
  }, [idleMs]);

  return isScrolling;
}
