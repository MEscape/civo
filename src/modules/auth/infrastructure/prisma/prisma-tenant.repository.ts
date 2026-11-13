import { createPersistenceFailures, db } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { AUTH_ERROR_CODES } from '../../domain/errors/auth-errors';
import { toTenantId } from '../../domain/models/ids';

import type { TenantId } from '../../domain/models/ids';
import type { TenantRepository } from '../../domain/ports/tenant.repository';

const failures = createPersistenceFailures({
  module: 'auth.tenant.persistence',
  code: AUTH_ERROR_CODES.membershipLookupFailed,
  subject: 'Website',
});

/** Auth reads only website existence or its public name; tenant configuration stays with its owning module. */
export class PrismaTenantRepository implements TenantRepository {
  /** @owner-scope platform The names of the websites the reader may reach (`null`: every website, for the platform administrator); the caller names the allowed ids. */
  listNames(
    tenantIds: readonly TenantId[] | null,
    limit: number,
  ): ReturnType<TenantRepository['listNames']> {
    if (tenantIds?.length === 0) {
      return okAsync({ websites: [], isTruncated: false });
    }
    return fromThrowableAsync(async () => {
      const query = db.orm.public.Website;
      return (tenantIds === null ? query : query.where((website) => website.id.in([...tenantIds])))
        .select('id', 'name')
        .orderBy([(website) => website.name.asc(), (website) => website.id.asc()])
        .limit(limit + 1)
        .all();
    }, failures.infraOnly('listNames')).map((rows) => ({
      websites: rows.slice(0, limit).map(({ id, name }) => ({ id: toTenantId(id), name })),
      isTruncated: rows.length > limit,
    }));
  }

  exists(tenantId: TenantId): AppResultAsync<boolean, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => db.orm.public.Website.where({ id: tenantId }).select('id').first(),
      failures.infraOnly('exists'),
    ).map((record) => record !== null);
  }

  findName(tenantId: TenantId): AppResultAsync<string | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => db.orm.public.Website.where({ id: tenantId }).select('name').first(),
      failures.infraOnly('findName'),
    ).map((record) => record?.name ?? null);
  }
}
