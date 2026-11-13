import { instantToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';

import { toActorId, toInvitationId, toTenantId } from '../../domain/models/ids';
import { isAnyRole } from '../../domain/models/role';

import type { Invitation } from '../../domain/models/invitation';

interface InvitationRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly email: string;
  readonly role: string;
  readonly invitedBy: string;
  readonly expiresAt: InstantRecord;
  readonly acceptedAt: InstantRecord | null;
  readonly createdAt: InstantRecord;
}

/** Every field of the record except the token hash, which never leaves the repository's own lookup. */
export const INVITATION_SELECT = [
  'id',
  'tenantId',
  'email',
  'role',
  'invitedBy',
  'expiresAt',
  'acceptedAt',
  'createdAt',
] as const satisfies ReadonlyArray<keyof InvitationRecord>;

/** A stored role this code no longer knows makes the invitation unusable, never a broader one. */
export function toInvitation(record: InvitationRecord): Invitation | null {
  if (!isAnyRole(record.role)) {
    return null;
  }
  return {
    id: toInvitationId(record.id),
    tenantId: toTenantId(record.tenantId),
    email: record.email,
    role: record.role,
    invitedBy: toActorId(record.invitedBy),
    expiresAt: instantToDate(record.expiresAt),
    acceptedAt: record.acceptedAt === null ? null : instantToDate(record.acceptedAt),
    createdAt: instantToDate(record.createdAt),
  };
}
