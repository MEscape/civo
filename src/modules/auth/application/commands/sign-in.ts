import type { AppResultAsync } from '@lib/result';

import { createSignInCredentials } from '../../domain/models/credentials';
import { enforceRateLimit } from '../services/enforce-rate-limit';

import type { AuthenticatorError } from '../../domain/ports/authenticator.port';
import type { AuthenticationDependencies } from '../auth-dependencies';
import type { SignInInput } from '../contracts/auth-inputs';
import type { RateLimitError } from '../services/enforce-rate-limit';

export type SignInError = AuthenticatorError | RateLimitError;

/**
 * Signs a user in by email and password. Intentionally unauthenticated.
 * Validates first, then spends one attempt from the subject's budget, and
 * only then touches the provider, so a throttled caller learns nothing
 * about the credentials. The session cookie is a side effect of the
 * authenticator; nothing secret is returned.
 *
 * @authorization public Signing in is how an actor comes to exist; the rate limiter gates it.
 * @audit-exempt Outcomes are audited by the identity provider hooks (create-security-audit-options) where sessions and accounts change; this command audits only its rate-limit refusal, through enforceRateLimit.
 */
export class SignIn {
  constructor(private readonly deps: AuthenticationDependencies) {}

  execute(input: SignInInput): AppResultAsync<void, SignInError> {
    return createSignInCredentials(input).asyncAndThen((credentials) =>
      enforceRateLimit(this.deps, 'sign_in', credentials.email).andThen(() =>
        this.deps.authenticator.signIn(credentials),
      ),
    );
  }
}
