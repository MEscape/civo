import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { debounce, memoize, once, throttle } from '@lib/utils/function';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('debounce', () => {
  it('calls once with the last arguments after the wait', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced(1);
    debounced(2);
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(2);
  });

  it('can be cancelled', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('throttle', () => {
  it('runs the first call and ignores calls inside the window', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled(1);
    throttled(2);
    vi.advanceTimersByTime(100);
    throttled(3);
    expect(fn.mock.calls).toEqual([[1], [3]]);
  });
});

describe('once', () => {
  it('runs the function a single time and caches the result', () => {
    const fn = vi.fn(() => Math.random());
    const wrapped = once(fn);
    expect(wrapped()).toBe(wrapped());
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('caches a falsy result', () => {
    const fn = vi.fn(() => 0);
    const wrapped = once(fn);
    wrapped();
    wrapped();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('memoize', () => {
  it('computes once per argument', () => {
    const fn = vi.fn((n: number) => n * 2);
    const memoized = memoize(fn);
    expect(memoized(2)).toBe(4);
    expect(memoized(2)).toBe(4);
    expect(memoized(3)).toBe(6);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('caches undefined results', () => {
    const fn = vi.fn(() => undefined);
    const memoized = memoize(fn);
    memoized('a');
    memoized('a');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
