import { advisoryLock, dateToInstant, db, retryTransient } from '@lib/db';

import { INVITATION_SELECT } from '../prisma/invitation-record-mapper';

import type { NewInvitation } from '../../domain/ports/invitation.repository';

/**
 * Stores an invitation unless the address already holds an open one for the scope, in one
 * transaction under a lock per scope and address: concurrent offers queue here, so only one can
 * pass the check. `null`: an open offer exists. Retried as a whole when the database aborts it as
 * a deadlock or serialization failure.
 */
export function insertPendingInvitation(invitation: NewInvitation, now: Date) {
  return retryTransient(() =>
    db.transaction(async (tx) => {
      await advisoryLock(tx, `invitation:${invitation.tenantId}:${invitation.email}`);
      const pending = await tx.orm.public.Invitation.where({
        tenantId: invitation.tenantId,
        email: invitation.email,
      })
        .where((record) => record.acceptedAt.isNull())
        .where((record) => record.expiresAt.gt(dateToInstant(now)))
        .select('id')
        .first();
      if (pending !== null) {
        return null;
      }
      return tx.orm.public.Invitation.select(...INVITATION_SELECT).create({
        ...invitation,
        expiresAt: dateToInstant(invitation.expiresAt),
      });
    }),
  );
}
