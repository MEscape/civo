import type { ActorId, TenantId } from './ids';
import type { Role } from './role';

/**
 * Who is acting, and in what capacity within one tenant. Nothing here comes
 * from an authentication library: a provider session type in this file
 * would tie the whole application to that provider.
 *
 * `roles` is already resolved for `tenantId`, so an Actor is only
 * meaningful for the tenant it carries and must never be reused for
 * another.
 */
export interface Actor {
  readonly id: ActorId;
  readonly tenantId: TenantId;
  readonly roles: readonly Role[];
}
