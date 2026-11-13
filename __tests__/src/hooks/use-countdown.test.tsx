import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCountdown } from '@hooks/use-countdown';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useCountdown', () => {
  it('counts whole seconds, stops at zero, and restarts from the supplied duration', async () => {
    const { result } = renderHook(() => useCountdown(2));
    expect(result.current.secondsLeft).toBe(2);
    await act(async () => vi.advanceTimersByTime(1000));
    expect(result.current.secondsLeft).toBe(1);
    await act(async () => vi.advanceTimersByTime(1000));
    expect(result.current.secondsLeft).toBe(0);
    await act(async () => vi.advanceTimersByTime(5000));
    expect(result.current.secondsLeft).toBe(0);
    await act(async () => {
      result.current.restart();
    });
    expect(result.current.secondsLeft).toBe(2);
  });

  it('uses a changed duration on restart and cancels timers on unmount', async () => {
    const { result, rerender, unmount } = renderHook(({ duration }) => useCountdown(duration), {
      initialProps: { duration: 3 },
    });
    rerender({ duration: 5 });
    await act(async () => {
      result.current.restart();
    });
    expect(result.current.secondsLeft).toBe(5);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not schedule a timer for an expired countdown', () => {
    const { result } = renderHook(() => useCountdown(0));
    expect(result.current.secondsLeft).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
