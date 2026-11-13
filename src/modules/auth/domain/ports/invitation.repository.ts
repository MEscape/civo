import type { InfrastructureAppError } from '@lib/errors';
import type { Page, PageRequest } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import type { ActorId, InvitationId, TenantId } from '../models/ids';
import type { Invitation, InvitationRole } from '../models/invitation';

export interface NewInvitation {
  readonly tenantId: TenantId;
  readonly email: string;
  readonly role: InvitationRole;
  readonly invitedBy: ActorId;
  readonly expiresAt: Date;
  /** SHA-256 of the emailed token. The token itself is never stored. */
  readonly tokenHash: string;
}

/**
 * `accepted`: access was granted. `already_member`: the account already held access in the offer's scope
 * (an existing role is never overwritten), or the offer was consumed earlier and the account still holds it.
 * `unavailable`: the offer cannot be used, with no further distinction.
 */
export type InvitationAcceptance = 'accepted' | 'already_member' | 'unavailable';

/** Persistence for invitations. Tenant-owned reads and writes match on the tenant. */
export interface InvitationRepository {
  /** Creates only when no unexpired pending offer exists for this scope and address. */
  createPending(
    invitation: NewInvitation,
    now: Date,
  ): AppResultAsync<Invitation | null, InfrastructureAppError>;

  /**
   * Checks live scope and inviter authority, grants access, and consumes the offer in one transaction.
   * An already consumed offer is idempotent only for an account that still holds access in its scope.
   */
  accept(input: {
    readonly id: InvitationId;
    readonly actorId: ActorId;
    readonly now: Date;
    /** Trusted application decision from verified configuration, never request input. */
    readonly bootstrapAuthority: boolean;
  }): AppResultAsync<InvitationAcceptance, InfrastructureAppError>;

  /** Public lookup by the hash of an emailed token: the token is the credential. */
  findByTokenHash(tokenHash: string): AppResultAsync<Invitation | null, InfrastructureAppError>;

  /** Exact lookup for startup deduplication; no bounded roster scan can hide an existing offer. */
  hasOpenForEmail(
    tenantId: TenantId,
    email: string,
    now: Date,
  ): AppResultAsync<boolean, InfrastructureAppError>;

  /** How many invitations of the tenant can still be accepted at `now`. */
  countOpen(tenantId: TenantId, now: Date): AppResultAsync<number, InfrastructureAppError>;

  /** Open invitations of the authorized tenants, newest first; one authorized set determines rows, ordering and totals before pagination; `null` is every scope, the platform's own included, for platform authority only. */
  listOpenForTenants(
    tenantIds: readonly TenantId[] | null,
    now: Date,
    page: PageRequest,
  ): AppResultAsync<Page<Invitation>, InfrastructureAppError>;

  /** Idempotent. True only when this call removed an open invitation. */
  revoke(id: InvitationId, tenantId: TenantId): AppResultAsync<boolean, InfrastructureAppError>;
}
