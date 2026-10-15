import { createPersistenceFailures, db, dateToInstant, instantToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { offsetOf, toPage } from '@lib/pagination';
import type { Page, PageRequest } from '@lib/pagination';
import { errAsync, fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { AUTH_ERROR_CODES, invitationFailed } from '../../domain/errors/auth-errors';
import { toActorId, toInvitationId, toTenantId } from '../../domain/models/ids';
import { isAnyRole } from '../../domain/models/role';

import type { InvitationId, TenantId } from '../../domain/models/ids';
import type { Invitation } from '../../domain/models/invitation';
import type { InvitationRepository, NewInvitation } from '../../domain/ports/invitation.repository';

const failures = createPersistenceFailures({
  module: 'auth.invitation.persistence',
  code: AUTH_ERROR_CODES.invitationFailed,
  subject: 'Invitation',
});

const INVITATION_SELECT = [
  'id',
  'tenantId',
  'email',
  'role',
  'invitedBy',
  'expiresAt',
  'acceptedAt',
  'createdAt',
] as const;

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

/** A stored role this code no longer knows makes the invitation unusable, never a broader one. */
function toInvitation(record: InvitationRecord): Invitation | null {
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

const invitations = () => db.orm.public.Invitation.select(...INVITATION_SELECT);

/**
 * Prisma 8 repository for invitations. Only the hash of an emailed token is
 * ever stored or compared. `claim` is one conditional UPDATE, so two requests
 * with the same link cannot both succeed.
 */
export class PrismaInvitationRepository implements InvitationRepository {
  create(invitation: NewInvitation): AppResultAsync<Invitation, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        invitations().create({
          tenantId: invitation.tenantId,
          email: invitation.email,
          role: invitation.role,
          invitedBy: invitation.invitedBy,
          tokenHash: invitation.tokenHash,
          expiresAt: dateToInstant(invitation.expiresAt),
        }),
      failures.infraOnly('create'),
    ).andThen((record) => {
      const mapped = toInvitation(record);
      return mapped === null
        ? errAsync(invitationFailed('the stored invitation could not be read back'))
        : okAsync(mapped);
    });
  }

  findByTokenHash(tokenHash: string): AppResultAsync<Invitation | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => invitations().where({ tokenHash }).first(),
      failures.infraOnly('findByTokenHash'),
    ).map((record) => (record === null ? null : toInvitation(record)));
  }

  claim(id: InvitationId, now: Date): AppResultAsync<boolean, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.Invitation.where({ id })
          .where((invitation) => invitation.acceptedAt.isNull())
          .where((invitation) => invitation.expiresAt.gt(dateToInstant(now)))
          .updateAndCount({ acceptedAt: dateToInstant(now) }),
      failures.infraOnly('claim'),
    ).map((count) => count === 1);
  }

  release(id: InvitationId): AppResultAsync<void, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => db.orm.public.Invitation.where({ id }).updateAndCount({ acceptedAt: null }),
      failures.infraOnly('release'),
    ).map(() => undefined);
  }

  listOpen(
    tenantId: TenantId,
    now: Date,
    page: PageRequest,
  ): AppResultAsync<Page<Invitation>, InfrastructureAppError> {
    return fromThrowableAsync(async () => {
      const open = () =>
        db.orm.public.Invitation.where({ tenantId })
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
      toPage(
        rows
          .map(toInvitation)
          .filter((invitation): invitation is Invitation => invitation !== null),
        total,
        page,
      ),
    );
  }

  revoke(id: InvitationId, tenantId: TenantId): AppResultAsync<void, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => db.orm.public.Invitation.where({ id, tenantId }).deleteAndCount(),
      failures.infraOnly('revoke'),
    ).map(() => undefined);
  }
}
