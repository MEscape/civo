import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TimeoutError, withTimeout } from '@lib/utils/async';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('withTimeout', () => {
  it('resolves when the promise settles in time', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 100)).resolves.toBe('ok');
  });

  it('passes on the rejection of the promise itself', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 100)).rejects.toThrow('boom');
  });

  it('rejects with TimeoutError, naming the limit, when too slow', async () => {
    const slow = new Promise<string>(() => undefined);
    const result = withTimeout(slow, 100);
    const assertion = expect(result).rejects.toMatchObject({
      name: 'TimeoutError',
      timeoutMs: 100,
      message: 'Operation timed out after 100ms',
    });
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });

  it('is an instance of TimeoutError', async () => {
    const result = withTimeout(new Promise<string>(() => undefined), 10);
    const assertion = expect(result).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(10);
    await assertion;
  });

  it('leaves no timer pending once the promise has settled', async () => {
    await withTimeout(Promise.resolve('ok'), 1000);

    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not report a rejection that comes after the timeout as unhandled', async () => {
    let rejectLate: (reason: Error) => void = () => undefined;
    const late = new Promise<string>((_, reject) => {
      rejectLate = reject;
    });
    const result = withTimeout(late, 50);
    const assertion = expect(result).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(50);
    await assertion;

    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    rejectLate(new Error('too late'));
    await vi.advanceTimersByTimeAsync(10);
    process.off('unhandledRejection', unhandled);

    expect(unhandled).not.toHaveBeenCalled();
  });
});
