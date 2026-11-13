import { describe, expect, it, vi } from 'vitest';

import {
  conflictError,
  forbiddenError,
  infrastructureError,
  notFoundError,
  unauthorizedError,
  validationError,
} from '@lib/errors/factory';
import { orNull } from '@lib/errors/or-null';
import { err, errAsync, ok, okAsync } from '@lib/result';

vi.mock('server-only', () => ({}));
vi.mock('@lib/logger', () => ({ logger: { error: vi.fn() } }));

describe('orNull', () => {
  it('hands back the value of a successful result, synchronous or pending', async () => {
    expect(await orNull(ok(7))).toBe(7);
    expect(await orNull(okAsync('x'))).toBe('x');
  });

  it.each([
    ['forbidden', forbiddenError('auth.permission_denied', 'no')],
    ['unauthorized', unauthorizedError('auth.unauthorized', 'who?')],
    ['not found', notFoundError('x.not_found', 'gone')],
    ['conflict', conflictError('x.conflict', 'taken')],
    ['validation', validationError('x.invalid', 'bad', {})],
  ])('is null for a %s refusal: the block is simply absent', async (_name, error) => {
    expect(await orNull(err(error))).toBeNull();
    expect(await orNull(errAsync(error))).toBeNull();
  });

  it('never turns a real failure into an empty block', async () => {
    await expect(orNull(errAsync(infrastructureError('db.down', 'down')))).rejects.toThrow(
      'db.down',
    );
  });
});
