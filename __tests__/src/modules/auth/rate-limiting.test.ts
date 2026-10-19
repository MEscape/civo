import { describe, expect, it, vi } from 'vitest';

import type { AuthenticationDependencies } from '@modules/auth/application/auth-dependencies';
import { RequestPasswordReset } from '@modules/auth/application/commands/request-password-reset';
import { ResetPassword } from '@modules/auth/application/commands/reset-password';
import { SignIn } from '@modules/auth/application/commands/sign-in';
import { AUTH_RATE_LIMITS } from '@modules/auth/application/rate-limits';
import { AUTH_ERROR_CODES } from '@modules/auth/domain/errors/auth-errors';

import { infrastructureError } from '@lib/errors';
import type { RateLimiter } from '@lib/rate-limit';
import { errAsync, okAsync } from '@lib/result';

import { UNRESOLVED_CLIENT, clientAt, createTestRateLimiter } from '../../support/rate-limiting';

const PASSWORD = 'correct horse battery staple';
const TOKEN = 't'.repeat(64);

function setup(
  options: {
    readonly clientAddress?: AuthenticationDependencies['clientAddress'];
    readonly rateLimiter?: RateLimiter;
  } = {},
) {
  const signIn = vi.fn(() => okAsync(undefined));
  const requestPasswordReset = vi.fn(() => okAsync(undefined));
  const resetPassword = vi.fn(() => okAsync(undefined));
  const deps = {
    authenticator: { signIn, requestPasswordReset, resetPassword },
    rateLimiter: options.rateLimiter ?? createTestRateLimiter(),
    clientAddress: options.clientAddress ?? clientAt('203.0.113.7'),
    audit: { record: () => undefined },
  } as unknown as AuthenticationDependencies;
  return { deps, signIn, requestPasswordReset, resetPassword };
}

const signInAs = (email: string) => ({ email, password: PASSWORD });

describe('SignIn rate limits', () => {
  it('refuses the attempt after the account budget is used up, without reaching the provider', async () => {
    const { deps, signIn } = setup();
    const signInUseCase = new SignIn(deps);

    for (let attempt = 0; attempt < AUTH_RATE_LIMITS.signIn.limit; attempt += 1) {
      expect((await signInUseCase.execute(signInAs('person@example.org'))).isOk()).toBe(true);
    }
    const refused = await signInUseCase.execute(signInAs('Person@Example.org '));

    expect(refused._unsafeUnwrapErr()).toMatchObject({
      kind: 'rate_limited',
      code: AUTH_ERROR_CODES.rateLimited,
    });
    expect(signIn).toHaveBeenCalledTimes(AUTH_RATE_LIMITS.signIn.limit);
  });

  it('refuses a client that tries many accounts, although no account budget is used up', async () => {
    const { deps } = setup();
    const signInUseCase = new SignIn(deps);

    const outcomes: boolean[] = [];
    for (let attempt = 0; attempt <= AUTH_RATE_LIMITS.signInClient.limit; attempt += 1) {
      outcomes.push((await signInUseCase.execute(signInAs(`user-${attempt}@example.org`))).isOk());
    }

    expect(outcomes.filter(Boolean)).toHaveLength(AUTH_RATE_LIMITS.signInClient.limit);
    expect(outcomes.at(-1)).toBe(false);
  });

  it('counts clients apart: another address still gets through', async () => {
    const limiter = createTestRateLimiter();
    const flooder = new SignIn(setup({ rateLimiter: limiter }).deps);
    const bystander = new SignIn(
      setup({ rateLimiter: limiter, clientAddress: clientAt('198.51.100.9') }).deps,
    );
    for (let attempt = 0; attempt <= AUTH_RATE_LIMITS.signInClient.limit; attempt += 1) {
      await flooder.execute(signInAs(`user-${attempt}@example.org`));
    }

    expect((await bystander.execute(signInAs('fresh@example.org'))).isOk()).toBe(true);
  });

  it('still applies the account budget when the client address cannot be determined', async () => {
    const { deps } = setup({ clientAddress: UNRESOLVED_CLIENT });
    const signInUseCase = new SignIn(deps);

    const outcomes: boolean[] = [];
    for (let attempt = 0; attempt <= AUTH_RATE_LIMITS.signIn.limit; attempt += 1) {
      outcomes.push((await signInUseCase.execute(signInAs('person@example.org'))).isOk());
    }

    expect(outcomes.filter(Boolean)).toHaveLength(AUTH_RATE_LIMITS.signIn.limit);
  });

  it('refuses, as an infrastructure failure and not as rate limiting, when the limiter is down', async () => {
    const down: RateLimiter = {
      enforce: () => {
        throw new Error('not used');
      },
      enforceAll: () =>
        errAsync(
          infrastructureError('rate_limit.backend_unavailable', 'Rate limiting is unavailable.'),
        ),
    };
    const { deps, signIn } = setup({ rateLimiter: down });

    const result = await new SignIn(deps).execute(signInAs('person@example.org'));

    expect(result._unsafeUnwrapErr()).toMatchObject({
      kind: 'infrastructure',
      code: AUTH_ERROR_CODES.rateLimiterFailed,
    });
    expect(signIn).not.toHaveBeenCalled();
  });
});

describe('password reset rate limits', () => {
  it('limits requests per address, so one inbox cannot be flooded', async () => {
    const { deps, requestPasswordReset } = setup();
    const request = new RequestPasswordReset(deps);

    for (let attempt = 0; attempt < AUTH_RATE_LIMITS.passwordResetRequest.limit; attempt += 1) {
      await request.execute({ email: 'person@example.org' });
    }
    const refused = await request.execute({ email: 'person@example.org' });

    expect(refused._unsafeUnwrapErr().kind).toBe('rate_limited');
    expect(requestPasswordReset).toHaveBeenCalledTimes(AUTH_RATE_LIMITS.passwordResetRequest.limit);
  });

  it('limits setting a new password per client', async () => {
    const { deps, resetPassword } = setup();
    const reset = new ResetPassword(deps);

    const outcomes: boolean[] = [];
    for (let attempt = 0; attempt <= AUTH_RATE_LIMITS.passwordResetClient.limit; attempt += 1) {
      outcomes.push((await reset.execute({ token: TOKEN, newPassword: PASSWORD })).isOk());
    }

    expect(outcomes.at(-1)).toBe(false);
    expect(resetPassword).toHaveBeenCalledTimes(AUTH_RATE_LIMITS.passwordResetClient.limit);
  });
});
