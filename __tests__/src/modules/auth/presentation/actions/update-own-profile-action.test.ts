import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateOwnProfileAction } from '@modules/auth/presentation/actions/update-own-profile-action';

import { unauthorizedError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

const boundary = vi.hoisted(() => ({ execute: vi.fn(), revalidate: vi.fn() }));
vi.mock('@modules/auth/composition', () => ({
  getProfileCommands: () => ({ updateOwnProfile: { execute: boundary.execute } }),
}));
vi.mock('next/cache', () => ({ revalidatePath: boundary.revalidate }));
beforeEach(() => {
  boundary.execute.mockReset();
  boundary.revalidate.mockClear();
});

function data(name = 'Ada') {
  const input = new FormData();
  input.set('name', name);
  return input;
}

describe('updateOwnProfileAction', () => {
  it.each([undefined, {}, data(''), data('x'.repeat(101))])(
    'rejects untrusted or invalid input %#',
    async (input) => {
      expect(await updateOwnProfileAction(input)).toMatchObject({
        ok: false,
        error: { code: 'auth.validation_failed' },
      });
      expect(boundary.execute).not.toHaveBeenCalled();
    },
  );

  it('forwards only editable fields, then refreshes account-dependent content', async () => {
    boundary.execute.mockReturnValue(okAsync(undefined));
    const input = data(' Ada ');
    input.set('userId', 'another-user');
    input.set('role', 'platform_admin');
    input.set('email', 'attacker@example.org');
    expect(await updateOwnProfileAction(input)).toEqual({ ok: true, data: undefined });
    expect(boundary.execute).toHaveBeenCalledWith({ name: 'Ada' });
    expect(boundary.revalidate).toHaveBeenCalledWith('/', 'layout');
  });

  it('bounds photo types and sizes before reading bytes or invoking the use case', async () => {
    const input = data();
    input.set('image', new File(['<svg/>'], 'photo.svg', { type: 'image/svg+xml' }));
    expect(await updateOwnProfileAction(input)).toMatchObject({
      ok: false,
      error: { fieldErrors: { image: expect.any(Array) } },
    });
    expect(boundary.execute).not.toHaveBeenCalled();
  });

  it('returns authentication denial without refreshing protected content', async () => {
    boundary.execute.mockReturnValue(
      errAsync(unauthorizedError('auth.unauthenticated', 'Sign in required')),
    );
    expect(await updateOwnProfileAction(data())).toMatchObject({
      ok: false,
      error: { code: 'auth.unauthenticated' },
    });
    expect(boundary.revalidate).not.toHaveBeenCalled();
  });
});
