import type { Page } from '@lib/pagination';

import type { InvitationRole } from '../../domain/models/invitation';
import type { TenantRole } from '../../domain/models/role';

export type { TenantRole };

/** A member of the signed-in actor's tenant, as the administration screens show them. */
export interface UserView {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly emailVerified: boolean;
  readonly createdAt: Date;
  readonly roles: readonly TenantRole[];
}

/** Who a calendar can be assigned to: a name and the id the assignment stores. */
export interface EmployeeView {
  readonly id: string;
  readonly name: string;
}

export interface InvitationView {
  readonly id: string;
  readonly email: string;
  readonly role: InvitationRole;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

/** One person as the platform-wide listing shows them: who they are, and where they hold which roles. */
export interface PlatformUserView {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly createdAt: Date;
  readonly isPlatformAdmin: boolean;
  /** The websites the person works in, with their roles; websites are named where they are shown. */
  readonly memberships: ReadonlyArray<{
    readonly tenantId: string;
    readonly roles: readonly TenantRole[];
  }>;
}

export interface PlatformUserListing {
  readonly users: Page<PlatformUserView>;
  /** True when the website or role filter matches more people than one listing narrows to. */
  readonly isTruncated: boolean;
  /** The actor, so a row can say you and offer no change of one's own access. */
  readonly selfId: string;
}

/** What an emailed invitation offers, for the person who opened its link. */
export interface InvitationPreviewView {
  /** The address the invitation was sent to, and the account will have. */
  readonly email: string;
  readonly role: InvitationRole;
  /** Whose website the invitation is for; the page turns it into a name. */
  readonly tenantId: string;
  readonly expiresAt: Date;
}

/** How an invitation resolved: a new person was emailed a link, or an existing account was given the role at once. */
export type InviteOutcome = 'invited' | 'granted';

/** An actor id and the name that person goes by. */
export interface MemberNameView {
  readonly id: string;
  readonly name: string;
}

/** How many people a tenant has, per role (in the order roles are listed everywhere), and its open invitations. */
export interface MemberSummaryView {
  readonly members: number;
  readonly byRole: ReadonlyArray<{ readonly role: TenantRole; readonly count: number }>;
  readonly openInvitations: number;
}
