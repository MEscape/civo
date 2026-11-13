import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireSignedIn } from '@modules/auth/presentation/guards/require-signed-in';

import { unauthorizedError, infrastructureError } from '@lib/errors';
import { err, ok } from '@lib/result';

const execute = vi.hoisted(() => vi.fn());
/** The real `redirect` never returns: it throws to unwind the render. */
const redirect = vi.hoisted(() =>
  vi.fn((_target: { href: string; locale: string }) => {
    throw new Error('NEXT_REDIRECT');
  }),
);

vi.mock('@modules/auth/composition', () => ({
  getAuthQueries: () => ({ getCurrentActor: { execute } }),
}));
vi.mock('@i18n', () => ({ redirect }));
vi.mock('@i18n/server', () => ({ getLocale: () => Promise.resolve('de') }));

/**
 * The guard is navigation convenience in front of use cases that authorize
 * for themselves: it must send only the anonymous to sign-in, and let a
 * failure of the lookup reach the error boundary instead of looking like a
 * sign-out.
 */
describe('requireSignedIn', () => {
  beforeEach(() => {
    execute.mockReset();
    redirect.mockReset();
  });

  it('returns the actor when someone is signed in', async () => {
    const actor = { id: 'a1', roles: ['viewer'] };
    execute.mockResolvedValue(ok(actor));

    await expect(requireSignedIn()).resolves.toBe(actor);
    expect(redirect).not.toHaveBeenCalled();
  });

  it('sends an anonymous visitor to sign-in in their language, carrying where they were going', async () => {
    execute.mockResolvedValue(err(unauthorizedError('auth.unauthenticated', 'No session.')));

    await expect(requireSignedIn('/websites/42')).rejects.toThrow('NEXT_REDIRECT');

    expect(redirect).toHaveBeenCalledTimes(1);
    const [target] = redirect.mock.calls[0] ?? [];
    expect(target?.locale).toBe('de');
    expect(target?.href).toContain('/sign-in');
    expect(target?.href).toContain(encodeURIComponent('/websites/42'));
  });

  it('does not bounce a visitor to sign-in when the session lookup itself fails', async () => {
    execute.mockResolvedValue(err(infrastructureError('auth.lookup_failed', 'Database down.')));

    await expect(requireSignedIn()).rejects.toThrow('auth.lookup_failed');
    expect(redirect).not.toHaveBeenCalled();
  });
});
