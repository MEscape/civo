import type { InvitationView, UserView } from '../../application/contracts/user-views';

/** A member row for the browser: plain strings, no entity. */
export interface UserRowDto {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly isVerified: boolean;
  readonly createdAt: string;
  readonly roles: readonly string[];
  readonly isSelf: boolean;
}

export interface InvitationRowDto {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly expiresAt: string;
}

export function toUserRowDto(user: UserView, selfId: string): UserRowDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
    roles: user.roles,
    isSelf: user.id === selfId,
  };
}

export function toInvitationRowDto(invitation: InvitationView): InvitationRowDto {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt.toISOString(),
  };
}
