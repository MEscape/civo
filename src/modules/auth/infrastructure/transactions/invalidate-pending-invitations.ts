import type { Transaction } from '@lib/db';

import { normalizeEmail } from '../../domain/models/credentials';

/** An explicit access decision supersedes older unaccepted offers for that same account and scope. */
export async function invalidatePendingInvitations(
  tx: Transaction,
  input: { readonly tenantId: string; readonly email?: string | undefined },
): Promise<void> {
  if (input.email === undefined) {
    return;
  }
  await tx.orm.public.Invitation.where({
    tenantId: input.tenantId,
    email: normalizeEmail(input.email),
  })
    .where((invitation) => invitation.acceptedAt.isNull())
    .deleteAndCount();
}

/** Offers outlive neither their inviter's authority nor its scope: open offers the person issued there are withdrawn. */
export async function invalidateInvitationsIssuedBy(
  tx: Transaction,
  input: { readonly tenantId: string; readonly invitedBy: string },
): Promise<void> {
  await tx.orm.public.Invitation.where({ tenantId: input.tenantId, invitedBy: input.invitedBy })
    .where((invitation) => invitation.acceptedAt.isNull())
    .deleteAndCount();
}
