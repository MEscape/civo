import { describe, expect, it } from 'vitest';

import {
  infrastructureError,
  notFoundError,
  rateLimitedError,
  toErrorResponseBody,
  validationError,
} from '@lib/errors';
import { toActionResult } from '@lib/result/action-app-result';
import { err, ok } from '@lib/result/app-result';

describe('toActionResult', () => {
  it('maps an Ok result to a serializable success object', () => {
    const result = ok({ id: 1, name: 'Test' });
    expect(toActionResult(result)).toEqual({
      ok: true,
      data: { id: 1, name: 'Test' },
    });
  });

  it('maps an Err result to a serializable error object omitting internal details', () => {
    const result = err(
      infrastructureError('STORE_DOWN', 'Test error message', new Error('connection string')),
    );

    expect(toActionResult(result)).toEqual({
      ok: false,
      error: {
        code: 'STORE_DOWN',
        message: 'Test error message',
      },
    });
  });

  it('includes fieldErrors exclusively for validation errors', () => {
    const result = err(
      validationError('INVALID_INPUT', 'Test error message', { email: ['Must be valid email'] }),
    );

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

  it('includes the whole-second retry delay for a rate-limited error', () => {
    const result = err(rateLimitedError('SLOW_DOWN', 'Test error message', 2.2));

    expect(toActionResult(result)).toEqual({
      ok: false,
      error: { code: 'SLOW_DOWN', message: 'Test error message', retryAfterSeconds: 3 },
    });
  });

  it('answers with exactly the body a Route Handler would', () => {
    const error = notFoundError('GONE', 'Test error message');

    expect(toActionResult(err(error))).toEqual({ ok: false, error: toErrorResponseBody(error) });
  });
});
