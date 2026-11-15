import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIsScrolling } from './useIsScrolling';

const Probe = () => <span data-testid="p">{String(useIsScrolling(500))}</span>;

describe('useIsScrolling', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is true while scrolling and settles after the idle delay', () => {
    render(<Probe />);
    expect(screen.getByTestId('p')).toHaveTextContent('false');

    act(() => {
      fireEvent.scroll(window);
    });
    expect(screen.getByTestId('p')).toHaveTextContent('true');

    act(() => vi.advanceTimersByTime(400));
    expect(screen.getByTestId('p')).toHaveTextContent('true');

    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByTestId('p')).toHaveTextContent('false');
  });

  it('restarts the idle timer on every scroll event', () => {
    render(<Probe />);
    act(() => {
      fireEvent.scroll(window);
    });
    act(() => vi.advanceTimersByTime(400));
    act(() => {
      fireEvent.scroll(window);
    });
    act(() => vi.advanceTimersByTime(400));
    expect(screen.getByTestId('p')).toHaveTextContent('true');
    act(() => vi.advanceTimersByTime(150));
    expect(screen.getByTestId('p')).toHaveTextContent('false');
  });
});
