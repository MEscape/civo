import type { Clock } from '@lib/clock';
import type { ClientAddressProvider, RateLimiter } from '@lib/rate-limit';

import type { AuthorizationService } from './authorization-service';
import type { AuthMailer } from '../domain/ports/auth-mailer.port';
import type { Authenticator } from '../domain/ports/authenticator.port';
import type { CurrentActorProvider } from '../domain/ports/current-actor-provider.port';
import type { InvitationRepository } from '../domain/ports/invitation.repository';
import type { MembershipRepository } from '../domain/ports/membership.repository';
import type { SecurityAuditLog } from '../domain/ports/security-audit-log.port';
import type { TenantRepository } from '../domain/ports/tenant.repository';
import type { TokenGenerator } from '../domain/ports/token-generator.port';
import type { UserDirectory } from '../domain/ports/user-directory.port';

/**
 * What every unauthenticated flow (sign-in, accepting an invitation, password reset) is
 * built from. They have no actor, so there is no authorization service;
 * the rate limiter, counting against the caller's address and the account
 * the flow names, takes its place as the gate.
 */
export interface AuthenticationDependencies {
  readonly authenticator: Authenticator;
  readonly rateLimiter: RateLimiter;
  readonly clientAddress: ClientAddressProvider;
  readonly audit: SecurityAuditLog;
}

/** What mailing the deployment's platform administrators at start needs: no actor, only stores and the mailer. */
export interface BootstrapDependencies {
  readonly directory: UserDirectory;
  readonly invitations: InvitationRepository;
  readonly tokens: TokenGenerator;
  readonly mailer: AuthMailer;
  readonly audit: SecurityAuditLog;
  readonly clock: Clock;
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

/** What inviting a person is built from: administration, plus a budget for the mail it sends. */
export interface InviteUserDependencies extends UserAdministrationDependencies {
  readonly rateLimiter: RateLimiter;
}

/** What the platform-wide user listing is built from: who may ask, and the stores it reads. */
export type PlatformUserListDependencies = Pick<
  UserAdministrationDependencies,
  'authorization' | 'members' | 'directory'
>;

/** What changing a person's access to a website from outside it is built from: also whether the website exists. */
export interface PlatformAccessDependencies extends Pick<
  UserAdministrationDependencies,
  'authorization' | 'members' | 'directory'
> {
  readonly tenants: TenantRepository;
  readonly audit: SecurityAuditLog;
}

/** What accepting an invitation is built from: the unauthenticated flows plus the invitation and membership stores. */
export interface AcceptInvitationDependencies
  extends
    AuthenticationDependencies,
    Pick<
      UserAdministrationDependencies,
      'invitations' | 'tokens' | 'members' | 'directory' | 'clock'
    > {}

/** What looking at an invitation needs: the invitations, the way a token is hashed, and the time. */
export type PreviewInvitationDependencies = Pick<
  UserAdministrationDependencies,
  'invitations' | 'tokens' | 'clock'
>;
