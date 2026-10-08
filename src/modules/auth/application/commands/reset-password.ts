import type { AppResultAsync } from '@lib/result';

import { createPasswordResetDraft } from '../../domain/models/credentials';

import type { AuthenticatorError } from '../../domain/ports/authenticator.port';
import type { AuthenticationDependencies } from '../auth-dependencies';
import type { PasswordResetInput } from '../contracts/auth-inputs';

/**
 * Sets a new password from an emailed token. The token is single-use,
 * high-entropy and short-lived, so guessing is not a practical attack and
 * this flow needs no per-subject throttle. Existing sessions are revoked by
 * the provider.
 *
 * @authorization public The emailed single-use token is the credential; the rate limiter gates it.
 * @audit-exempt Outcomes are audited by the identity provider hooks (create-security-audit-options) where sessions and accounts change; this command audits only its rate-limit refusal, through enforceRateLimit.
 */
export class ResetPassword {
  constructor(private readonly deps: AuthenticationDependencies) {}

  execute(input: PasswordResetInput): AppResultAsync<void, AuthenticatorError> {
    return createPasswordResetDraft(input).asyncAndThen((draft) =>
      this.deps.authenticator.resetPassword(draft),
    );
  }
}
