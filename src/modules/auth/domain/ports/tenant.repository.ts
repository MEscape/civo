import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { TenantId } from '../models/ids';

/**
 * Which tenants exist. A tenant is a website, which another module owns; this
 * only answers whether an id names one, so a platform administrator cannot
 * give someone access to a website that is not there.
 */
export interface TenantRepository {
  exists(tenantId: TenantId): AppResultAsync<boolean, InfrastructureAppError>;
}
