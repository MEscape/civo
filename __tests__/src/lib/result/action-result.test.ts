import { describe, expect, it } from 'vitest';

import type { AppError } from '@lib/errors';
import { isActionSuccess, toActionResult } from '@lib/result/action-app-result';
import { err, ok } from '@lib/result/app-result';

// Stubbing an AppError for testing boundaries without importing actual domain errors
const createError = (
  kind: 'domain' | 'validation' | 'system',
  code: string,
  fieldErrors?: Record<string, string[]>,
): AppError =>
  ({
    kind,
    code,
    message: 'Test error message',
    ...(fieldErrors ? { fieldErrors } : {}),
  }) as unknown as AppError;

describe('toActionResult', () => {
  it('maps an Ok result to a serializable success object', () => {
    const result = ok({ id: 1, name: 'Test' });
    expect(toActionResult(result)).toEqual({
      ok: true,
      data: { id: 1, name: 'Test' },
    });
  });

  it('maps an Err result to a serializable error object omitting internal details', () => {
    const error = createError('domain', 'NOT_FOUND');
    const result = err(error);

    expect(toActionResult(result)).toEqual({
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Test error message',
      },
    });
  });

  it('includes fieldErrors exclusively for validation errors', () => {
    const error = createError('validation', 'INVALID_INPUT', {
      email: ['Must be valid email'],
    });
    const result = err(error);

    expect(toActionResult(result)).toEqual({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'Test error message',
        fieldErrors: {
          email: ['Must be valid email'],
        },
      },
    });
  });
});

describe('isActionSuccess', () => {
  it('returns true and acts as a type guard for success results', () => {
    const result = { ok: true as const, data: 'success' };
    expect(isActionSuccess(result)).toBe(true);
  });

  it('returns false for error results', () => {
    const result = {
      ok: false as const,
      error: { code: 'ERR', message: 'failed' },
    };
    expect(isActionSuccess(result)).toBe(false);
  });
});
