import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { ActorId, TenantId } from '../models/ids';
import type { Role } from '../models/role';

/**
 * The application's own record of who holds which roles in which tenant.
 * This, not the authentication provider, is the source of truth for
 * authorization: the provider only proves who someone is.
 *
 * Returns an empty list (not an error) when the actor has no membership in
 * the tenant. "No roles" is a normal outcome that authorization then
 * denies, which keeps the fail-closed path in one place. Roles the code
 * does not know are discarded by the adapter, never granted.
 */
export interface MembershipRepository {
  findRoles(
    actorId: ActorId,
    tenantId: TenantId,
  ): AppResultAsync<readonly Role[], InfrastructureAppError>;
}
