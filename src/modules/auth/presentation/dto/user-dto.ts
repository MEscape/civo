import type { InvitationView } from '../../application/contracts/user-views';

export interface InvitationRowDto {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly expiresAt: string;
}

export function toInvitationRowDto(invitation: InvitationView): InvitationRowDto {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt.toISOString(),
  };
}
