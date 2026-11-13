import { SqlQueryError } from '@prisma/orm-family-sql/errors';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  retryTransient,
  TRANSIENT_ATTEMPTS,
  TRANSIENT_RETRY_DELAY_MS,
} from '@lib/db/retry-transient';

// The driver's own predicates are the boundary being faked: real driver errors need a database.
vi.mock('@prisma/orm-family-sql/errors', () => ({
  SqlQueryError: { is: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(SqlQueryError.is).mockReturnValue(false);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('retryTransient', () => {
  const driverFailure = (sqlState: string) => {
    const thrown = Object.assign(new Error('aborted'), { sqlState });
    vi.mocked(SqlQueryError.is).mockImplementation((e) => e === thrown);
    return thrown;
  };

  it('returns the result of an operation that works', async () => {
    await expect(retryTransient(() => Promise.resolve('done'))).resolves.toBe('done');
  });

  it.each(['40001', '40P01'])('runs the operation again after SQLSTATE %s', async (sqlState) => {
    const thrown = driverFailure(sqlState);
    const operation = vi.fn().mockRejectedValueOnce(thrown).mockResolvedValueOnce('done');

    await expect(retryTransient(operation)).resolves.toBe('done');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('gives up after the allowed attempts and throws the last failure', async () => {
    const thrown = driverFailure('40P01');
    const operation = vi.fn().mockRejectedValue(thrown);

    await expect(retryTransient(operation)).rejects.toBe(thrown);
    expect(operation).toHaveBeenCalledTimes(TRANSIENT_ATTEMPTS);
  });

  it('pauses a little longer before each new attempt', async () => {
    vi.useFakeTimers();
    try {
      const thrown = driverFailure('40001');
      const operation = vi.fn().mockRejectedValue(thrown);
      const outcome = retryTransient(operation).catch((error: unknown) => error);

      expect(operation).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(2 * TRANSIENT_RETRY_DELAY_MS - 1);
      expect(operation).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(TRANSIENT_RETRY_DELAY_MS);
      expect(operation).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(3 * TRANSIENT_RETRY_DELAY_MS);
      expect(operation).toHaveBeenCalledTimes(TRANSIENT_ATTEMPTS);
      expect(await outcome).toBe(thrown);
    } finally {
      vi.useRealTimers();
    }
  });

  it('never repeats a conflict or any other failure', async () => {
    const thrown = driverFailure('23P01');
    const operation = vi.fn().mockRejectedValue(thrown);

    await expect(retryTransient(operation)).rejects.toBe(thrown);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('never repeats an error that came from no driver', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(retryTransient(operation)).rejects.toThrow('boom');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('does not mistake a driver error without a SQLSTATE for a transient one', async () => {
    const thrown = new Error('no state');
    vi.mocked(SqlQueryError.is).mockImplementation((e) => e === thrown);
    const operation = vi.fn().mockRejectedValue(thrown);

    await expect(retryTransient(operation)).rejects.toBe(thrown);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
