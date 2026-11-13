import { createPersistenceFailures, db, dateToInstant } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { offsetOf, toPage } from '@lib/pagination';
import type { Page, PageRequest } from '@lib/pagination';
import { fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { isDefined } from '@lib/utils';

import { AUTH_ERROR_CODES } from '../../domain/errors/auth-errors';
import { acceptInvitation } from '../transactions/accept-invitation';
import { insertPendingInvitation } from '../transactions/create-pending-invitation';

import { INVITATION_SELECT, toInvitation } from './invitation-record-mapper';

import type { InvitationId, TenantId } from '../../domain/models/ids';
import type { Invitation } from '../../domain/models/invitation';
import type {
  InvitationAcceptance,
  InvitationRepository,
  NewInvitation,
} from '../../domain/ports/invitation.repository';

const failures = createPersistenceFailures({
  module: 'auth.invitation.persistence',
  code: AUTH_ERROR_CODES.invitationFailed,
  subject: 'Invitation',
});

/** @owner-scope builder Created with its tenant, found by a secret token hash, or tagged by the caller. */
const invitations = () => db.orm.public.Invitation.select(...INVITATION_SELECT);

/**
 * Prisma 8 repository for invitations. Only the hash of an emailed token is
 * ever stored or compared. Acceptance uses one conditional UPDATE, so two requests
 * with the same link cannot both succeed.
 */
export class PrismaInvitationRepository implements InvitationRepository {
  accept(
    input: Parameters<InvitationRepository['accept']>[0],
  ): AppResultAsync<InvitationAcceptance, InfrastructureAppError> {
    return fromThrowableAsync(() => acceptInvitation(input), failures.infraOnly('accept'));
  }

  createPending(
    invitation: NewInvitation,
    now: Date,
  ): AppResultAsync<Invitation | null, InfrastructureAppError> {
    return fromThrowableAsync(
      () => insertPendingInvitation(invitation, now),
      failures.infraOnly('createPending'),
    ).map((record) => (record === null ? null : toInvitation(record)));
  }

  /** @owner-scope capability The hash of a single-use secret that only the invited person has; the invitation names the tenant. */
  findByTokenHash(tokenHash: string): AppResultAsync<Invitation | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => invitations().where({ tokenHash }).first(),
      failures.infraOnly('findByTokenHash'),
    ).map((record) => (record === null ? null : toInvitation(record)));
  }

  hasOpenForEmail(
    tenantId: TenantId,
    email: string,
    now: Date,
  ): AppResultAsync<boolean, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.Invitation.where({ tenantId, email })
          .where((invitation) => invitation.acceptedAt.isNull())
          .where((invitation) => invitation.expiresAt.gt(dateToInstant(now)))
          .select('id')
          .first(),
      failures.infraOnly('hasOpenForEmail'),
    ).map((record) => record !== null);
  }

  countOpen(tenantId: TenantId, now: Date): AppResultAsync<number, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.Invitation.where({ tenantId })
          .where((invitation) => invitation.acceptedAt.isNull())
          .where((invitation) => invitation.expiresAt.gt(dateToInstant(now)))
          .aggregate((aggregate) => ({ total: aggregate.count() })),
      failures.infraOnly('countOpen'),
    ).map(({ total }) => total);
  }

  /** @owner-scope platform The open invitations of the websites the reader may manage (`null`: every website, for the platform administrator); the caller names the allowed tenants. */
  listOpenForTenants(
    tenantIds: readonly TenantId[] | null,
    now: Date,
    page: PageRequest,
  ): AppResultAsync<Page<Invitation>, InfrastructureAppError> {
    if (tenantIds?.length === 0) {
      return okAsync(toPage([], 0, page));
    }
    return fromThrowableAsync(async () => {
      const records = db.orm.public.Invitation;
      const scoped =
        tenantIds === null
          ? records
          : records.where((invitation) => invitation.tenantId.in([...tenantIds]));
      const open = () =>
        scoped
          .where((invitation) => invitation.acceptedAt.isNull())
          .where((invitation) => invitation.expiresAt.gt(dateToInstant(now)));
      const total = await open().aggregate((aggregate) => ({ total: aggregate.count() }));
      const rows = await open()
        .select(...INVITATION_SELECT)
        .orderBy([(invitation) => invitation.createdAt.desc(), (invitation) => invitation.id.asc()])
        .limit(page.pageSize)
        .offset(offsetOf(page))
        .all();
      return { rows, total: total.total };
    }, failures.infraOnly('listOpen')).map(({ rows, total }) =>
      toPage(rows.map(toInvitation).filter(isDefined), total, page),
    );
  }

  revoke(id: InvitationId, tenantId: TenantId): AppResultAsync<boolean, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.Invitation.where({ id, tenantId })
          .where((record) => record.acceptedAt.isNull())
          .deleteAndCount(),
      failures.infraOnly('revoke'),
    ).map((removed) => removed > 0);
  }
}
