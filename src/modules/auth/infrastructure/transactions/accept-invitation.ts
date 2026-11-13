import { db, retryTransient } from '@lib/db';
import type { Transaction } from '@lib/db';

import { isInvitationOpen } from '../../domain/models/invitation';
import { PLATFORM_ADMIN_ROLE } from '../../domain/models/role';
import { PLATFORM_TENANT_ID } from '../../domain/models/tenant';
import { INVITATION_SELECT, toInvitation } from '../prisma/invitation-record-mapper';

import {
  addMembership,
  isPlatformAdminMember,
  lockTenantRoster,
  lockWebsite,
  managesUsersIn,
} from './membership-role-writes';

import type { InvitationId } from '../../domain/models/ids';
import type { Invitation } from '../../domain/models/invitation';
import type {
  InvitationAcceptance,
  InvitationRepository,
} from '../../domain/ports/invitation.repository';

type Acceptance = Parameters<InvitationRepository['accept']>[0];

async function readInvitation(tx: Transaction, id: InvitationId): Promise<Invitation | null> {
  const record = await tx.orm.public.Invitation.where({ id })
    .select(...INVITATION_SELECT)
    .first();
  return record === null ? null : toInvitation(record);
}

async function holdsAccess(
  tx: Transaction,
  actorId: Acceptance['actorId'],
  invitation: Invitation,
): Promise<boolean> {
  const held = await tx.orm.public.Membership.where({ actorId, tenantId: invitation.tenantId })
    .select('actorId')
    .first();
  return held !== null;
}

/** A consumed offer is a repeat only for an account that still holds access; anyone else learns nothing. */
async function repeatOutcome(
  tx: Transaction,
  invitation: Invitation,
  input: Acceptance,
): Promise<InvitationAcceptance> {
  return (await holdsAccess(tx, input.actorId, invitation)) ? 'already_member' : 'unavailable';
}

/**
 * The offer when it can still be accepted; otherwise the final outcome. Read once before taking the
 * locks (cheap refusal) and once after (the state that counts).
 */
async function loadOpenOffer(
  tx: Transaction,
  input: Acceptance,
): Promise<Invitation | InvitationAcceptance> {
  const offer = await readInvitation(tx, input.id);
  if (offer === null) {
    return 'unavailable';
  }
  if (offer.acceptedAt !== null) {
    return repeatOutcome(tx, offer, input);
  }
  return isInvitationOpen(offer, input.now) ? offer : 'unavailable';
}

/**
 * Platform roster first, then the website's roster and row: the order `replaceMembershipRoles` uses.
 * Locking the website row stops its deletion from invalidating a grant before this transaction commits.
 */
async function lockScope(tx: Transaction, invitation: Invitation): Promise<boolean> {
  await lockTenantRoster(tx, PLATFORM_TENANT_ID);
  if (invitation.role === PLATFORM_ADMIN_ROLE) {
    return true;
  }
  await lockTenantRoster(tx, invitation.tenantId);
  return lockWebsite(tx, invitation.tenantId);
}

/** Bootstrap authority is configuration; otherwise the inviter must still hold authority over the offer's scope. */
async function inviterHasAuthority(
  tx: Transaction,
  invitation: Invitation,
  isBootstrap: boolean,
): Promise<boolean> {
  if (isBootstrap || (await isPlatformAdminMember(tx, invitation.invitedBy))) {
    return true;
  }
  // Only a platform administrator may hand out the platform role.
  return (
    invitation.role !== PLATFORM_ADMIN_ROLE &&
    managesUsersIn(tx, invitation.invitedBy, invitation.tenantId)
  );
}

/** A conditional update and its exact grant commit together; existing membership decisions take precedence. */
async function consumeAndGrant(
  tx: Transaction,
  invitation: Invitation,
  input: Acceptance,
): Promise<InvitationAcceptance> {
  // Database time closes the window where an offer expires while waiting for a roster lock.
  // The later supplied clock also permits deterministic future-clock integration tests.
  const now = input.now.toISOString();
  const claim = db.raw
    .sql`UPDATE "Invitation" SET "acceptedAt" = GREATEST(${now}::timestamptz, clock_timestamp())
    WHERE "id" = ${input.id} AND "acceptedAt" IS NULL AND "expiresAt" > GREATEST(${now}::timestamptz, clock_timestamp()) RETURNING "id"`
    .returnsRow({ id: { codecId: 'pg/text@1', nullable: false } })
    .build();
  const changed = await tx.query(claim);
  if (changed.length !== 1) {
    return 'unavailable';
  }
  // A later access decision supersedes the offered role; accepting an old link must not restore privileges.
  if (await holdsAccess(tx, input.actorId, invitation)) {
    return 'already_member';
  }
  await addMembership(tx, {
    actorId: input.actorId,
    tenantId: invitation.tenantId,
    role: invitation.role,
  });
  return 'accepted';
}

/**
 * Platform then website roster locks serialize authorization with revocations.
 * Lifecycle is reread after locking. External account setup never consumes an invitation.
 */
export function acceptInvitation(input: Acceptance): Promise<InvitationAcceptance> {
  return retryTransient(() =>
    db.transaction(async (tx) => {
      const preliminary = await loadOpenOffer(tx, input);
      if (typeof preliminary === 'string') {
        return preliminary;
      }
      if (!(await lockScope(tx, preliminary))) {
        return 'unavailable';
      }
      // Another acceptance may have won while this one waited for the locks.
      const offer = await loadOpenOffer(tx, input);
      if (typeof offer === 'string') {
        return offer;
      }
      if (!(await inviterHasAuthority(tx, offer, input.bootstrapAuthority))) {
        return 'unavailable';
      }
      return consumeAndGrant(tx, offer, input);
    }),
  );
}
