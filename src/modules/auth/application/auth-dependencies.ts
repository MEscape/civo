import type { AuthRateLimiter } from '../domain/ports/auth-rate-limiter.port';
import type { Authenticator } from '../domain/ports/authenticator.port';
import type { CurrentActorProvider } from '../domain/ports/current-actor-provider.port';
import type { SecurityAuditLog } from '../domain/ports/security-audit-log.port';

/**
 * What every unauthenticated flow (sign-in, sign-up, password reset) is
 * built from. They have no actor, so there is no authorization service;
 * the rate limiter takes its place as the gate.
 */
export interface AuthenticationDependencies {
  readonly authenticator: Authenticator;
  readonly rateLimiter: AuthRateLimiter;
  readonly audit: SecurityAuditLog;
}

export interface CurrentActorDependencies {
  readonly currentActor: CurrentActorProvider;
}
