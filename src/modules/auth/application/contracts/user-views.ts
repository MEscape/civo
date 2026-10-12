import type { Role } from '../../domain/models/role';

export type { Role };

/** A member of the signed-in actor's tenant, as the administration screens show them. */
export interface UserView {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly emailVerified: boolean;
  readonly createdAt: Date;
  readonly roles: readonly Role[];
}

/** Who a calendar can be assigned to: a name and the id the assignment stores. */
export interface EmployeeView {
  readonly id: string;
  readonly name: string;
}

export interface InvitationView {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

/** How an invitation resolved: a new person was emailed a link, or an existing account was given the role at once. */
export type InviteOutcome = 'invited' | 'granted';
