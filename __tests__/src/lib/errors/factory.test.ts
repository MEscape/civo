import { describe, expect, it, vi } from 'vitest';

import type { AppError } from '@lib/errors/app-error';
import {
  conflictError,
  forbiddenError,
  infrastructureError,
  matchAppError,
  notFoundError,
  unauthorizedError,
  unexpectedError,
  validationError,
} from '@lib/errors/factory';

describe('error constructors', () => {
  it('validationError carries fieldErrors and the validation kind', () => {
    const error = validationError('user.invalid', 'Invalid user', {
      email: ['Required'],
    });
    expect(error).toEqual({
      kind: 'validation',
      code: 'user.invalid',
      message: 'Invalid user',
      fieldErrors: { email: ['Required'] },
    });
  });

  it('notFoundError carries only kind/code/message', () => {
    expect(notFoundError('order.not_found', 'Order not found')).toEqual({
      kind: 'not_found',
      code: 'order.not_found',
      message: 'Order not found',
    });
  });

  it('conflictError carries only kind/code/message', () => {
    expect(conflictError('order.exists', 'Order already exists')).toEqual({
      kind: 'conflict',
      code: 'order.exists',
      message: 'Order already exists',
    });
  });

  it('unauthorizedError carries only kind/code/message', () => {
    expect(unauthorizedError('auth.required', 'Sign in required')).toEqual({
      kind: 'unauthorized',
      code: 'auth.required',
      message: 'Sign in required',
    });
  });

  it('forbiddenError carries only kind/code/message', () => {
    expect(forbiddenError('auth.forbidden', 'Not allowed')).toEqual({
      kind: 'forbidden',
      code: 'auth.forbidden',
      message: 'Not allowed',
    });
  });

  it('infrastructureError preserves cause without exposing it in message', () => {
    const cause = new Error('connection refused');
    const error = infrastructureError('db.unreachable', 'Service unavailable', cause);
    expect(error.kind).toBe('infrastructure');
    expect(error.message).toBe('Service unavailable');
    expect(error.cause).toBe(cause);
  });

  it('infrastructureError works without a cause', () => {
    const error = infrastructureError('db.unreachable', 'Service unavailable');
    expect(error.cause).toBeUndefined();
  });

  it('unexpectedError preserves cause without exposing it in message', () => {
    const cause = new Error('boom');
    const error = unexpectedError('internal.error', 'Something went wrong', cause);
    expect(error.kind).toBe('unexpected');
    expect(error.message).toBe('Something went wrong');
    expect(error.cause).toBe(cause);
  });
});

describe('matchAppError', () => {
  const allKinds: AppError[] = [
    validationError('v', 'v', {}),
    notFoundError('nf', 'nf'),
    conflictError('c', 'c'),
    unauthorizedError('u', 'u'),
    forbiddenError('f', 'f'),
    infrastructureError('i', 'i'),
    unexpectedError('e', 'e'),
  ];

  it('dispatches to the handler matching the error kind', () => {
    for (const error of allKinds) {
      const handlers = {
        validation: vi.fn(() => 'validation'),
        not_found: vi.fn(() => 'not_found'),
        conflict: vi.fn(() => 'conflict'),
        unauthorized: vi.fn(() => 'unauthorized'),
        forbidden: vi.fn(() => 'forbidden'),
        infrastructure: vi.fn(() => 'infrastructure'),
        unexpected: vi.fn(() => 'unexpected'),
      };

      const result = matchAppError(error, handlers);

      expect(result).toBe(error.kind);
      expect(handlers[error.kind]).toHaveBeenCalledWith(error);
    }
  });

  it('calls exactly one handler per invocation', () => {
    const handlers = {
      validation: vi.fn(),
      not_found: vi.fn(),
      conflict: vi.fn(),
      unauthorized: vi.fn(),
      forbidden: vi.fn(),
      infrastructure: vi.fn(),
      unexpected: vi.fn(),
    };

    matchAppError(notFoundError('nf', 'nf'), handlers);

    const callCounts = Object.values(handlers).map((h) => h.mock.calls.length);
    expect(callCounts).toEqual([0, 1, 0, 0, 0, 0, 0]);
  });
});
