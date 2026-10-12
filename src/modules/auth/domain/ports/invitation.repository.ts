import type { InfrastructureAppError } from '@lib/errors';
import type { Page, PageRequest } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import type { ActorId, InvitationId, TenantId } from '../models/ids';
import type { Invitation } from '../models/invitation';
import type { Role } from '../models/role';

export interface NewInvitation {
  readonly tenantId: TenantId;
  readonly email: string;
  readonly role: Role;
  readonly invitedBy: ActorId;
  readonly expiresAt: Date;
  /** SHA-256 of the emailed token. The token itself is never stored. */
  readonly tokenHash: string;
}

/** Persistence for invitations. Tenant-owned reads and writes match on the tenant. */
export interface InvitationRepository {
  create(invitation: NewInvitation): AppResultAsync<Invitation, InfrastructureAppError>;

  /** Public lookup by the hash of an emailed token: the token is the credential. */
  findByTokenHash(tokenHash: string): AppResultAsync<Invitation | null, InfrastructureAppError>;

  /**
   * Claims an open invitation. `false` when it was already accepted or has
   * expired, so two requests with the same link cannot both win.
   */
  claim(id: InvitationId, now: Date): AppResultAsync<boolean, InfrastructureAppError>;

  /** Gives a claim back after the account could not be set up, so the same link can be tried again. */
  release(id: InvitationId): AppResultAsync<void, InfrastructureAppError>;

  /** Open invitations of the tenant, newest first. */
  listOpen(
    tenantId: TenantId,
    now: Date,
    page: PageRequest,
  ): AppResultAsync<Page<Invitation>, InfrastructureAppError>;

  /** Idempotent. */
  revoke(id: InvitationId, tenantId: TenantId): AppResultAsync<void, InfrastructureAppError>;
}
