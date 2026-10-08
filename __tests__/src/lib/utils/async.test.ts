import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  mapWithConcurrency,
  retryWithBackoff,
  sleep,
  TimeoutError,
  withTimeout,
} from '@lib/utils/async';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('sleep', () => {
  it('resolves after the delay', async () => {
    const done = vi.fn();
    void sleep(100).then(done);
    await vi.advanceTimersByTimeAsync(99);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toHaveBeenCalled();
  });
});

describe('withTimeout', () => {
  it('resolves when the promise settles in time', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 100)).resolves.toBe('ok');
  });

  it('rejects with TimeoutError when too slow', async () => {
    const slow = new Promise<string>(() => undefined);
    const result = withTimeout(slow, 100);
    const assertion = expect(result).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });
});

describe('retryWithBackoff', () => {
  it('returns immediately on success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(retryWithBackoff(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries with exponential backoff until success', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('a'))
      .mockRejectedValueOnce(new Error('b'))
      .mockResolvedValue('ok');

    const result = retryWithBackoff(fn, { baseDelayMs: 100 });
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);

    await expect(result).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('rethrows the last error after exhausting attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    const result = retryWithBackoff(fn, { attempts: 2, baseDelayMs: 10 });
    const assertion = expect(result).rejects.toThrow('boom');
    await vi.advanceTimersByTimeAsync(10);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('stops early when shouldRetry returns false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fatal'));
    await expect(retryWithBackoff(fn, { attempts: 5, shouldRetry: () => false })).rejects.toThrow(
      'fatal',
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid attempts value as a programmer error', async () => {
    await expect(retryWithBackoff(vi.fn(), { attempts: 0 })).rejects.toThrow(RangeError);
  });
});

describe('mapWithConcurrency', () => {
  it('preserves result order', async () => {
    vi.useRealTimers();
    const result = await mapWithConcurrency([30, 10, 20], 2, async (ms) => {
      await sleep(ms);
      return ms;
    });
    expect(result).toEqual([30, 10, 20]);
  });

  it('never exceeds the concurrency limit', async () => {
    vi.useRealTimers();
    let active = 0;
    let peak = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await sleep(5);
      active -= 1;
    });
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('handles empty input', async () => {
    await expect(mapWithConcurrency([], 3, async (x) => x)).resolves.toEqual([]);
  });

  it('rejects an invalid concurrency value', async () => {
    await expect(mapWithConcurrency([1], 0, async (x) => x)).rejects.toThrow(RangeError);
  });
});
