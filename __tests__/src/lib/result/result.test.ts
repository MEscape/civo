import { describe, expect, it } from 'vitest';

import type { AppError } from '@lib/errors';

import { fromThrowable, fromThrowableAsync } from '../../../../src/lib/result/app-result';

const toSystemError = (thrown: unknown): AppError =>
  ({
    kind: 'system',
    code: 'UNEXPECTED',
    message: thrown instanceof Error ? thrown.message : 'Unknown',
  }) as unknown as AppError;

describe('fromThrowable', () => {
  it('wraps successful synchronous returns in an Ok Result', () => {
    const result = fromThrowable(() => 'success', toSystemError);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe('success');
    }
  });

  it('catches thrown exceptions and maps them to an Err Result', () => {
    const result = fromThrowable(() => {
      throw new Error('sync failure');
    }, toSystemError);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('UNEXPECTED');
      expect(result.error.message).toBe('sync failure');
    }
  });
});

describe('fromThrowableAsync', () => {
  it('wraps resolved promises in an Ok ResultAsync', async () => {
    const result = await fromThrowableAsync(async () => 'async success', toSystemError);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe('async success');
    }
  });

  it('catches rejected promises and maps them to an Err ResultAsync', async () => {
    const result = await fromThrowableAsync(async () => {
      throw new Error('async failure');
    }, toSystemError);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('UNEXPECTED');
      expect(result.error.message).toBe('async failure');
    }
  });

  it('catches synchronous throws before the promise is even returned', async () => {
    const result = await fromThrowableAsync(() => {
      // Intentionally throwing synchronously instead of returning a rejected Promise
      throw new Error('early failure');
    }, toSystemError);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('early failure');
    }
  });
});
