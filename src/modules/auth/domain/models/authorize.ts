import { isDefined } from '@lib/utils';

import { permissionsForRole } from './role';

import type { Actor } from './actor';
import type { TenantId } from './ids';
import type { Permission } from './permission';

/**
 * What the actor is trying to touch. `tenantId` is the tenant the RESOURCE
 * belongs to, taken from the loaded resource, never from a request field.
 * That is what makes cross-tenant access a comparison rather than trust.
 */
export interface ResourceScope {
  readonly tenantId: TenantId;
}

/**
 * Why access was refused. Internal only: it feeds the audit log and must
 * never reach a client, because telling the two apart discloses whether a
 * resource exists in another tenant.
 */
export type DenialReason = 'tenant_mismatch' | 'permission_missing';

export type AuthorizationDecision =
  { readonly isAllowed: true } | { readonly isAllowed: false; readonly reason: DenialReason };

/**
 * Whether the actor holds `permission` through any of their roles. This is
 * a union over roles, computed here rather than delegated, so the result
 * cannot change because a provider changes how it combines roles.
 */
export function actorHasPermission(actor: Actor, permission: Permission): boolean {
  return actor.roles.some((role) => permissionsForRole(role).includes(permission));
}

/**
 * The authorization decision. Order matters and is fail-closed:
 *
 *  1. Tenant first. A resource in another tenant is denied before roles are
 *     even consulted, so a powerful role in tenant A grants nothing in B.
 *  2. Then the permission, through the actor's roles.
 *
 * `scope` present means the operation targets a specific resource. Absent
 * means it is tenant-wide (create, or list within the actor's own tenant).
 * The application layer exposes these as two distinct calls so a caller
 * cannot drop the scope by accident.
 */
export function decide(
  actor: Actor,
  permission: Permission,
  scope?: ResourceScope,
): AuthorizationDecision {
  if (isDefined(scope) && scope.tenantId !== actor.tenantId) {
    return { isAllowed: false, reason: 'tenant_mismatch' };
  }
  if (!actorHasPermission(actor, permission)) {
    return { isAllowed: false, reason: 'permission_missing' };
  }
  return { isAllowed: true };
}
