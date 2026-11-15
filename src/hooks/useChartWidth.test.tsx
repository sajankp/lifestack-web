import { useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChartWidth } from './useChartWidth';

type Callback = () => void;

describe('useChartWidth', () => {
  let callbacks: Callback[] = [];
  let measured = 0;

  beforeEach(() => {
    callbacks = [];
    measured = 0;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: Callback) {
          callbacks.push(cb);
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => measured);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const Probe = ({ min }: { min?: number }) => {
    const [ref, width] = useChartWidth<HTMLDivElement>(800, min);
    return (
      <div ref={ref} data-testid="probe">
        {width}
      </div>
    );
  };

  it('keeps the fallback width when the element has no layout (jsdom / hidden tab)', () => {
    measured = 0;
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('800');
  });

  it('adopts the measured width and follows later resizes', () => {
    measured = 343;
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('343');

    measured = 612;
    act(() => callbacks.forEach((cb) => cb()));
    expect(screen.getByTestId('probe')).toHaveTextContent('612');
  });

  it('never goes below the minimum width', () => {
    measured = 120;
    render(<Probe min={280} />);
    expect(screen.getByTestId('probe')).toHaveTextContent('280');
  });

  it('attaches when the element mounts after the first render (loading -> chart)', () => {
    measured = 390;
    const Late = () => {
      const [ref, width] = useChartWidth<HTMLDivElement>(800);
      const [ready, setReady] = useState(false);
      return (
        <>
          <button onClick={() => setReady(true)}>load</button>
          {ready ? (
            <div ref={ref} data-testid="late">
              {width}
            </div>
          ) : null}
        </>
      );
    };
    render(<Late />);
    act(() => screen.getByText('load').click());
    expect(screen.getByTestId('late')).toHaveTextContent('390');
  });

  it('falls back quietly when ResizeObserver is unavailable', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    measured = 400;
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('800');
  });
});
