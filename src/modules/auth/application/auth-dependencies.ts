import type { Clock } from '@lib/clock';

import type { AuthorizationService } from './authorization-service';
import type { AuthMailer } from '../domain/ports/auth-mailer.port';
import type { AuthRateLimiter } from '../domain/ports/auth-rate-limiter.port';
import type { Authenticator } from '../domain/ports/authenticator.port';
import type { CurrentActorProvider } from '../domain/ports/current-actor-provider.port';
import type { InvitationRepository } from '../domain/ports/invitation.repository';
import type { MembershipRepository } from '../domain/ports/membership.repository';
import type { SecurityAuditLog } from '../domain/ports/security-audit-log.port';
import type { TokenGenerator } from '../domain/ports/token-generator.port';
import type { UserDirectory } from '../domain/ports/user-directory.port';

/**
 * What every unauthenticated flow (sign-in, accepting an invitation, password reset) is
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

/** What every administration use case (users, roles, invitations) is built from. */
export interface UserAdministrationDependencies {
  readonly authorization: AuthorizationService;
  readonly members: MembershipRepository;
  readonly directory: UserDirectory;
  readonly invitations: InvitationRepository;
  readonly tokens: TokenGenerator;
  readonly mailer: AuthMailer;
  readonly audit: SecurityAuditLog;
  readonly clock: Clock;
}

/** What accepting an invitation is built from: the unauthenticated flows plus the invitation and membership stores. */
export interface AcceptInvitationDependencies
  extends
    AuthenticationDependencies,
    Pick<
      UserAdministrationDependencies,
      'invitations' | 'tokens' | 'members' | 'directory' | 'clock'
    > {}
