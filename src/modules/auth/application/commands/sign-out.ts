import type { AppResultAsync } from '@lib/result';

import type { AuthenticatorError } from '../../domain/ports/authenticator.port';
import type { AuthenticationDependencies } from '../auth-dependencies';

/**
 * Ends the current session. Idempotent: signing out while signed out succeeds.
 *
 * @authorization public Ends whatever session the request carries; without one it is a no-op.
 * @audit-exempt Outcomes are audited by the identity provider hooks (create-security-audit-options) where sessions and accounts change; this command audits only its rate-limit refusal, through enforceRateLimit.
 */
export class SignOut {
  constructor(private readonly deps: AuthenticationDependencies) {}

  execute(): AppResultAsync<void, AuthenticatorError> {
    return this.deps.authenticator.signOut();
  }
}
