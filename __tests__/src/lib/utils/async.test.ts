import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { retry, sleep, TimeoutError, withTimeout } from '@lib/utils/async';

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

describe('retry', () => {
  const always = () => true;
  const constantDelay = () => 50;

  it('returns the first outcome when it needs no retry', async () => {
    const attempt = vi.fn().mockResolvedValue('done');

    await expect(
      retry(attempt, { attempts: 3, shouldRetry: () => false, delayMs: constantDelay }),
    ).resolves.toBe('done');
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('runs again, after the pause for the attempts made, until the outcome is good', async () => {
    const attempt = vi
      .fn()
      .mockResolvedValueOnce('bad')
      .mockResolvedValueOnce('bad')
      .mockResolvedValue('good');
    const delayMs = vi.fn((made: number) => made * 10);

    const outcome = retry(attempt, {
      attempts: 5,
      shouldRetry: (value) => value === 'bad',
      delayMs,
    });
    await vi.advanceTimersByTimeAsync(10);
    expect(attempt).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(20);

    await expect(outcome).resolves.toBe('good');
    expect(attempt).toHaveBeenCalledTimes(3);
    expect(delayMs.mock.calls).toEqual([[1], [2]]);
  });

  it('gives up after the allowed attempts and returns the last outcome', async () => {
    const attempt = vi.fn().mockResolvedValue('bad');

    const outcome = retry(attempt, { attempts: 3, shouldRetry: always, delayMs: constantDelay });
    await vi.advanceTimersByTimeAsync(100);

    await expect(outcome).resolves.toBe('bad');
    expect(attempt).toHaveBeenCalledTimes(3);
  });

  it('runs once when only one attempt is allowed', async () => {
    const attempt = vi.fn().mockResolvedValue('bad');

    await retry(attempt, { attempts: 1, shouldRetry: always, delayMs: constantDelay });

    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('lets a throw end the retries instead of catching it', async () => {
    const attempt = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(
      retry(attempt, { attempts: 3, shouldRetry: always, delayMs: constantDelay }),
    ).rejects.toThrow('boom');
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});

describe('sleep', () => {
  it('stays pending until the time has passed, then resolves', async () => {
    const settled = vi.fn();
    void sleep(100).then(settled);

    await vi.advanceTimersByTimeAsync(99);
    expect(settled).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toHaveBeenCalledOnce();
  });

  it('leaves no timer pending once it has resolved', async () => {
    const done = sleep(10);
    await vi.advanceTimersByTimeAsync(10);
    await done;

    expect(vi.getTimerCount()).toBe(0);
  });
});
