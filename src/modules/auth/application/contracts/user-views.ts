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

/** How an invitation resolved: a new person was emailed a link, or an existing account was given the role at once. */
export type InviteOutcome = 'invited' | 'granted';

/** An actor id and the name that person goes by. */
export interface MemberNameView {
  readonly id: string;
  readonly name: string;
}
