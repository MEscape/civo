import { beforeEach, describe, expect, it, vi } from 'vitest';

import { signInAction } from '@modules/auth/presentation/actions/sign-in-action';

import { unauthorizedError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

const boundary = vi.hoisted(() => ({ execute: vi.fn(), revalidate: vi.fn() }));
vi.mock('@modules/auth/composition', () => ({
  getAuthCommands: () => ({ signIn: { execute: boundary.execute } }),
}));
vi.mock('next/cache', () => ({ revalidatePath: boundary.revalidate }));
beforeEach(() => {
  boundary.execute.mockReset();
  boundary.revalidate.mockClear();
});
const credentials = { email: 'person@example.org', password: 'long-private-password' };

describe('signInAction', () => {
  it('rejects invalid credentials before reaching authentication', async () => {
    expect(await signInAction({ email: 'invalid', password: '' })).toMatchObject({
      ok: false,
      error: { code: 'auth.validation_failed' },
    });
    expect(boundary.execute).not.toHaveBeenCalled();
  });

  it.each([
    { returnTo: '/websites/site-1', expected: '/websites/site-1' },
    { returnTo: 'https://attacker.example', expected: '/websites' },
  ])('returns only a safe destination for $returnTo', async ({ returnTo, expected }) => {
    boundary.execute.mockReturnValue(okAsync(undefined));
    expect(await signInAction({ ...credentials, returnTo })).toEqual({
      ok: true,
      data: { redirectTo: expected },
    });
    expect(boundary.execute).toHaveBeenCalledWith(credentials);
    expect(boundary.revalidate.mock.calls).toEqual([['/', 'layout']]);
  });

  it('preserves credential refusal without invalidating authenticated content', async () => {
    boundary.execute.mockReturnValue(
      errAsync(unauthorizedError('auth.credentials_invalid', 'Invalid credentials')),
    );
    expect(await signInAction(credentials)).toMatchObject({
      ok: false,
      error: { code: 'auth.credentials_invalid' },
    });
    expect(boundary.revalidate).not.toHaveBeenCalled();
  });
});
