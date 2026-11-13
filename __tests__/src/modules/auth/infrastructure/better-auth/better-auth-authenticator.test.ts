import { APIError } from 'better-auth/api';
import { describe, expect, it, vi } from 'vitest';

import { BetterAuthAuthenticator } from '@modules/auth/infrastructure/better-auth/better-auth-authenticator';

function authenticator() {
  const api = {
    signInEmail: vi.fn(async () => undefined),
    signUpEmail: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    requestPasswordReset: vi.fn(async () => undefined),
    resetPassword: vi.fn(async () => undefined),
  };
  return {
    api,
    authenticator: new BetterAuthAuthenticator({
      api,
      getHeaders: () => Promise.resolve(new Headers()),
      paths: { afterEmailVerification: '/email-verified', passwordReset: '/reset-password' },
    }),
  };
}

const draft = { name: 'Ada', email: 'ada@example.org', password: 'This is a test password!' };

describe('invitation verification callback', () => {
  it('preserves only the validated invitation token on the fixed verification destination', async () => {
    const world = authenticator();
    const result = await world.authenticator.signUp(draft, 'Invitation_Token-123');
    expect(result.isOk()).toBe(true);
    expect(world.api.signUpEmail).toHaveBeenCalledWith(
      expect.objectContaining({ callbackURL: '/email-verified?token=Invitation_Token-123' }),
    );
  });

  it('keeps ordinary account verification on the existing destination', async () => {
    const world = authenticator();
    expect((await world.authenticator.signUp(draft)).isOk()).toBe(true);
    expect(world.api.signUpEmail).toHaveBeenCalledWith(
      expect.objectContaining({ callbackURL: '/email-verified' }),
    );
  });

  it('rejects malformed invitation context before requesting account creation', async () => {
    const world = authenticator();
    expect((await world.authenticator.signUp(draft, '//foreign.example/path')).isErr()).toBe(true);
    expect(world.api.signUpEmail).not.toHaveBeenCalled();
  });
});

describe('authentication provider operations', () => {
  it('signs in through the fixed verification callback and discards provider session material', async () => {
    const world = authenticator();
    const result = await world.authenticator.signIn({
      email: draft.email,
      password: draft.password,
    });
    expect(result.isOk()).toBe(true);
    expect(world.api.signInEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: draft.email,
        password: draft.password,
        callbackURL: '/email-verified',
        headers: expect.any(Headers),
      }),
    );
  });

  it('keeps credential refusal distinct from provider failure', async () => {
    const world = authenticator();
    world.api.signInEmail.mockRejectedValue(
      new APIError('UNAUTHORIZED', {
        code: 'INVALID_EMAIL_OR_PASSWORD',
        message: 'Private provider text',
      }),
    );
    expect(
      (
        await world.authenticator.signIn({ email: draft.email, password: draft.password })
      )._unsafeUnwrapErr().kind,
    ).toBe('unauthorized');
  });

  it('does not expose account existence when sign-up encounters an existing account', async () => {
    const world = authenticator();
    world.api.signUpEmail.mockRejectedValue(
      new APIError('CONFLICT', { code: 'USER_ALREADY_EXISTS', message: 'Account exists' }),
    );
    expect((await world.authenticator.signUp(draft)).isOk()).toBe(true);
  });

  it('treats an already anonymous sign-out as successful', async () => {
    const world = authenticator();
    expect((await world.authenticator.signOut()).isOk()).toBe(true);
    world.api.signOut.mockRejectedValue(new APIError('UNAUTHORIZED'));
    expect((await world.authenticator.signOut()).isOk()).toBe(true);
  });

  it('uses the fixed reset destination and passes token-based password changes to the provider', async () => {
    const world = authenticator();
    expect((await world.authenticator.requestPasswordReset({ email: draft.email })).isOk()).toBe(
      true,
    );
    expect(world.api.requestPasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({ email: draft.email, redirectTo: '/reset-password' }),
    );
    expect(
      (
        await world.authenticator.resetPassword({
          token: 'valid-token',
          newPassword: draft.password,
        })
      ).isOk(),
    ).toBe(true);
    expect(world.api.resetPassword).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'valid-token', newPassword: draft.password }),
    );
  });

  it('fails closed when headers or the provider are unavailable', async () => {
    const world = authenticator();
    world.api.requestPasswordReset.mockRejectedValue(new Error('Provider unavailable'));
    expect(
      (await world.authenticator.requestPasswordReset({ email: draft.email }))._unsafeUnwrapErr()
        .kind,
    ).toBe('infrastructure');
    const broken = new BetterAuthAuthenticator({
      api: world.api,
      getHeaders: () => {
        throw new Error('Request unavailable');
      },
      paths: { afterEmailVerification: '/verified', passwordReset: '/reset' },
    });
    expect((await broken.signOut())._unsafeUnwrapErr().kind).toBe('infrastructure');
  });
});
