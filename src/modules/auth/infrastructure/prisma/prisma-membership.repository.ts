import { createPersistenceFailures, db } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { logger } from '@lib/logger';
import { fromThrowableAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { AUTH_ERROR_CODES } from '../../domain/errors/auth-errors';

import { MAX_MEMBERSHIP_ROWS, MEMBERSHIP_SELECT, toRoles } from './membership-record-mapper';

import type { ActorId, TenantId } from '../../domain/models/ids';
import type { Role } from '../../domain/models/role';
import type { MembershipRepository } from '../../domain/ports/membership.repository';

const membershipLogger = logger.withContext({ module: 'auth.membership' });

const failures = createPersistenceFailures({
  module: 'auth.membership.persistence',
  code: AUTH_ERROR_CODES.membershipLookupFailed,
  subject: 'Membership',
});

/**
 * Prisma 8 repository for memberships: the application's own record of who
 * holds which roles in which tenant. This, not the authentication provider,
 * is the source of truth for authorization.
 *
 * - Query results are awaitable but not `Promise`s, so the thunk is `async`
 *   and returns the query directly: the async wrapper awaits it.
 * - Read-only, so the only failure convention needed is `infraOnly`.
 *
 * `actorId` has no foreign key to Better Auth's user table: the two live in
 * different databases/roles by design. See migrations/app/0001_membership.sql.
 */
export class PrismaMembershipRepository implements MembershipRepository {
  findRoles(
    actorId: ActorId,
    tenantId: TenantId,
  ): AppResultAsync<readonly Role[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.Membership.where({ actorId, tenantId })
          .select(...MEMBERSHIP_SELECT)
          // Stable order, so the same actor always resolves to the same list.
          .orderBy([(membership) => membership.role.asc()])
          .limit(MAX_MEMBERSHIP_ROWS)
          .all(),
      failures.infraOnly('findRoles'),
    ).map((records) => {
      const roles = toRoles(records);
      if (roles.length !== records.length) {
        membershipLogger.warn('auth.membership_unknown_role_ignored', {
          ignoredCount: records.length - roles.length,
        });
      }
      return roles;
    });
  }
}
