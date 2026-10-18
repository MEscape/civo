import { createPersistenceFailures, db } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { fromThrowableAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { AUTH_ERROR_CODES } from '../../domain/errors/auth-errors';

import type { TenantId } from '../../domain/models/ids';
import type { TenantRepository } from '../../domain/ports/tenant.repository';

const failures = createPersistenceFailures({
  module: 'auth.tenant.persistence',
  code: AUTH_ERROR_CODES.membershipLookupFailed,
  subject: 'Website',
});

/** Whether an id names a website: a tenant is its website, so the one column of its table is the whole question. */
export class PrismaTenantRepository implements TenantRepository {
  exists(tenantId: TenantId): AppResultAsync<boolean, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => db.orm.public.Website.where({ id: tenantId }).select('id').first(),
      failures.infraOnly('exists'),
    ).map((record) => record !== null);
  }
}
