import { describe, expect, it, vi } from 'vitest';

import {
  conflictError,
  forbiddenError,
  infrastructureError,
  notFoundError,
  rateLimitedError,
  unauthorizedError,
  unexpectedError,
  validationError,
} from '@lib/errors';
import { orNull } from '@lib/errors/or-null';
import { err, ok, okAsync } from '@lib/result';

import { orFail } from '@/app/_lib/or-fail';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('not-found');
  },
}));
vi.mock('@modules/auth', () => ({ authRoutes: { signIn: () => '/sign-in' } }));
const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn(() => {
    throw new Error('sign-in');
  }),
}));
vi.mock('@i18n', () => ({ redirect }));
vi.mock('@i18n/server', () => ({ getLocale: async () => 'de' }));

const refusals = [
  forbiddenError('denied', 'Denied'),
  validationError('invalid', 'Invalid', {}),
  notFoundError('missing', 'Missing'),
  conflictError('conflict', 'Conflict'),
];

describe('route result boundaries', () => {
  it('unwraps both synchronous and asynchronous successful results', async () => {
    expect(await orFail(ok('visible'))).toBe('visible');
    expect(await orFail(okAsync('visible'))).toBe('visible');
    expect(await orNull(ok('visible'))).toBe('visible');
  });

  it.each(refusals)('hides resource existence for $kind', async (error) => {
    await expect(orFail(err(error))).rejects.toThrow('not-found');
    expect(await orNull(err(error))).toBeNull();
  });

  it('redirects an expired session in the request locale, but omits optional blocks', async () => {
    const error = unauthorizedError('expired', 'Expired');
    await expect(orFail(err(error))).rejects.toThrow('sign-in');
    expect(redirect).toHaveBeenCalledWith({ href: '/sign-in', locale: 'de' });
    expect(await orNull(err(error))).toBeNull();
  });

  it.each([
    infrastructureError('down', 'Down', new Error('connection')),
    unexpectedError('bug', 'Bug', new Error('bug')),
    rateLimitedError('limited', 'Limited', 30),
  ])('propagates operational $kind errors from both boundaries', async (error) => {
    await expect(orFail(err(error))).rejects.toMatchObject({ message: error.code, cause: error });
    await expect(orNull(err(error))).rejects.toMatchObject({ message: error.code, cause: error });
  });
});
