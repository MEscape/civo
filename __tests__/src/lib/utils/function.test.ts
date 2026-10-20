import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { debounce, identity, noop, once } from '@lib/utils/function';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('debounce', () => {
  it('calls once after the quiet period, with the last arguments', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('a');
    vi.advanceTimersByTime(50);
    debounced('b');
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('b');
  });

  it('can run again after it ran', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 10);

    debounced();
    vi.advanceTimersByTime(10);
    debounced();
    vi.advanceTimersByTime(10);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('drops a pending call on cancel', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 10);

    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(100);

    expect(fn).not.toHaveBeenCalled();
  });

  it('has nothing to cancel before the first call', () => {
    expect(() => {
      debounce(vi.fn(), 10).cancel();
    }).not.toThrow();
  });
});

describe('once', () => {
  it('runs the function once and returns the cached result', () => {
    const fn = vi.fn(() => ({ built: true }));
    const get = once(fn);

    expect(get()).toBe(get());
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('caches an undefined result too', () => {
    const fn = vi.fn(() => undefined);
    const get = once(fn);

    get();
    get();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('caches nothing when the call throws, so the next call tries again', () => {
    const fn = vi
      .fn<() => string>()
      .mockImplementationOnce(() => {
        throw new Error('not yet');
      })
      .mockImplementation(() => 'built');
    const get = once(fn);

    expect(get).toThrow('not yet');
    expect(get()).toBe('built');
    expect(get()).toBe('built');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('identity and noop', () => {
  it('identity returns its argument', () => {
    const value = { a: 1 };

    expect(identity(value)).toBe(value);
  });

  it('noop returns nothing', () => {
    expect(noop).not.toThrow();
  });
});
