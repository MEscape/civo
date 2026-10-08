import { describe, expect, it } from 'vitest';

import type { AppError } from '@lib/errors/app-error';
import { httpStatusForError, toErrorResponseBody } from '@lib/errors/http-mapping';

// Factory helpers to construct AppErrors for testing without depending on the real constructors
const createError = (
  kind: AppError['kind'],
  code: string,
  message: string,
  extra?: Partial<AppError>,
): AppError =>
  ({
    kind,
    code,
    message,
    ...extra,
  }) as AppError;

describe('httpStatusForError', () => {
  it('maps validation errors to 422 Unprocessable Entity', () => {
    const error = createError('validation', 'ERR', 'msg');
    expect(httpStatusForError(error)).toBe(422);
  });

  it('maps not_found errors to 404 Not Found', () => {
    const error = createError('not_found', 'ERR', 'msg');
    expect(httpStatusForError(error)).toBe(404);
  });

  it('maps infrastructure errors to 502 Bad Gateway', () => {
    const error = createError('infrastructure', 'ERR', 'msg');
    expect(httpStatusForError(error)).toBe(502);
  });

  it('maps unexpected errors to 500 Internal Server Error', () => {
    const error = createError('unexpected', 'ERR', 'msg');
    expect(httpStatusForError(error)).toBe(500);
  });
});

describe('toErrorResponseBody', () => {
  it('maps standard errors to a payload containing only code and message', () => {
    const error = createError('not_found', 'USER_NOT_FOUND', 'User does not exist', {
      cause: new Error('Hidden internal cause'),
    });

    const body = toErrorResponseBody(error);

    expect(body).toEqual({
      code: 'USER_NOT_FOUND',
      message: 'User does not exist',
    });
    // Ensure cause is completely excluded
    expect('cause' in body).toBe(false);
  });

  it('includes fieldErrors exclusively for validation errors', () => {
    const error = createError('validation', 'INVALID_INPUT', 'Validation failed', {
      fieldErrors: {
        email: ['Must be a valid email'],
        age: ['Must be over 18'],
      },
    });

    const body = toErrorResponseBody(error);

    expect(body).toEqual({
      code: 'INVALID_INPUT',
      message: 'Validation failed',
      fieldErrors: {
        email: ['Must be a valid email'],
        age: ['Must be over 18'],
      },
    });
  });
});
