import type { ForbiddenAppError, InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { err, errAsync, ok, okAsync } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import { permissionDenied, tenantInvalid } from '../../domain/errors/auth-errors';
import { actorHasPermission } from '../../domain/models/authorize';
import { rolesWithPermission } from '../../domain/models/role';
import { PLATFORM_TENANT_ID, parseTenantHint } from '../../domain/models/tenant';
import { MAX_WEBSITE_OPTIONS } from '../auth-limits';

import type { Actor } from '../../domain/models/actor';
import type { TenantId } from '../../domain/models/ids';
import type { Permission } from '../../domain/models/permission';
import type { Role } from '../../domain/models/role';
import type { TenantRepository } from '../../domain/ports/tenant.repository';
import type { UserAdministrationDependencies } from '../auth-dependencies';
import type { AuthorizationError } from '../authorization-service';
import type { WebsiteOptions } from '../contracts/user-views';

type Dependencies = Pick<UserAdministrationDependencies, 'authorization' | 'members'>;

/** What every loader and scope query of user administration can fail with. */
export type ScopeError = AuthorizationError | InfrastructureAppError | ValidationAppError;

/** The websites an actor reaches. `tenantIds` is `null` for platform authority: every website. */
export interface TenantReach {
  readonly tenantIds: readonly TenantId[] | null;
  /** True when the actor reaches more websites than one read lists; `tenantIds` is then its first part. */
  readonly isTruncated: boolean;
}

/** A manager always receives an explicit website allowlist; only platform authority gets `null`. */
export interface UserManagementScope extends TenantReach {
  readonly actor: Actor;
}

/** An actor and the one scope they are authorized in: a website, or the platform's own. */
export interface AuthorizedScope {
  readonly actor: Actor;
  readonly tenantId: TenantId;
}

/** The one place that answers "is this actor the platform's administrator" for scoping decisions. */
export function hasPlatformAuthority(actor: Actor): boolean {
  return actorHasPermission(actor, 'platform.admin.manage');
}

/** Authority over the platform's own scope, for what no website owns (its offers and their revocation). */
export function loadAuthorizedPlatform(
  deps: Pick<Dependencies, 'authorization'>,
): AppResultAsync<AuthorizedScope, AuthorizationError> {
  return deps.authorization
    .requireInTenant('platform.admin.manage')
    .map((actor) => ({ actor, tenantId: PLATFORM_TENANT_ID }));
}

/**
 * The websites where the actor holds `permission`, from the actor's own memberships and the role
 * table, never from a request. Holding it nowhere is a denial.
 */
function findAuthorizedTenantIds(
  deps: Pick<Dependencies, 'members'>,
  actor: Actor,
  permission: Permission,
): AppResultAsync<TenantReach, ScopeError> {
  return deps.members
    .findTenantIdsWithRoles(actor.id, rolesWithPermission(permission), MAX_WEBSITE_OPTIONS)
    .andThen(({ tenantIds, isTruncated }): AppResultAsync<TenantReach, ScopeError> =>
      tenantIds.length === 0 ? errAsync(permissionDenied()) : okAsync({ tenantIds, isTruncated }),
    );
}

/**
 * The single answer to "which websites does this actor reach through `permission`": platform
 * authority that holds it reaches every website (`tenantIds: null`); everyone else reaches the
 * websites their own memberships grant it in, and is denied when there are none.
 */
export function resolveTenantReach(
  deps: Pick<Dependencies, 'members'>,
  actor: Actor,
  permission: Permission,
): AppResultAsync<TenantReach, ScopeError> {
  if (hasPlatformAuthority(actor) && actorHasPermission(actor, permission)) {
    return okAsync({ tenantIds: null, isTruncated: false });
  }
  return findAuthorizedTenantIds(deps, actor, permission);
}

/** The public names of the websites a reach lists; truncated when the reach or the name lookup was. */
export function nameReachedWebsites(
  tenants: TenantRepository,
  { tenantIds, isTruncated }: TenantReach,
): AppResultAsync<WebsiteOptions, InfrastructureAppError> {
  return tenants.listNames(tenantIds, MAX_WEBSITE_OPTIONS).map((names) => ({
    websites: names.websites,
    isTruncated: isTruncated || names.isTruncated,
  }));
}

/** The website a request names, provided it lies within `tenantIds` (`null`: every website). */
export function selectWebsiteInScope(
  tenantIds: readonly TenantId[] | null,
  rawTenantId: string,
): AppResult<TenantId, ValidationAppError | ForbiddenAppError> {
  const selected = parseTenantHint(rawTenantId);
  if (selected === null) {
    return err(tenantInvalid());
  }
  if (tenantIds !== null && !tenantIds.includes(selected)) {
    return err(permissionDenied());
  }
  return ok(selected);
}

/** Resolve every managed website from the acting person's own memberships, never the subject's. */
export function loadAuthorizedUserManagementScope(
  deps: Dependencies,
): AppResultAsync<UserManagementScope, ScopeError> {
  return deps.authorization
    .requireActor()
    .andThen((actor): AppResultAsync<UserManagementScope, ScopeError> =>
      resolveTenantReach(deps, actor, 'user.manage').map((reach) => ({ actor, ...reach })),
    );
}

/** Platform authority carries its own roles into every website; anyone else holds what their membership there grants. */
function rolesInWebsite(
  deps: Pick<Dependencies, 'members'>,
  actor: Actor,
  tenantId: TenantId,
): AppResultAsync<readonly Role[], InfrastructureAppError> {
  return hasPlatformAuthority(actor)
    ? okAsync(actor.roles)
    : deps.members.findRoles(actor.id, tenantId);
}

/** Resolve an actor in the requested website before applying that website's permission vocabulary. */
export function loadAuthorizedWebsite(
  deps: Dependencies,
  options: { readonly permission: Permission; readonly tenantId?: string | undefined },
): AppResultAsync<AuthorizedScope, ScopeError> {
  return deps.authorization
    .requireActor()
    .andThen((actor): AppResultAsync<AuthorizedScope, ScopeError> => {
      const tenantId = parseTenantHint(options.tenantId ?? actor.tenantId);
      if (tenantId === null) {
        return errAsync(tenantInvalid());
      }
      return rolesInWebsite(deps, actor, tenantId).andThen((roles) => {
        const actorInWebsite = { ...actor, tenantId, roles };
        return actorHasPermission(actorInWebsite, options.permission)
          ? okAsync({ actor: actorInWebsite, tenantId })
          : errAsync(permissionDenied());
      });
    });
}

/** Authorize an explicit mutation target independently of the currently viewed website. */
export function loadAuthorizedManagedWebsite(
  deps: Dependencies,
  rawTenantId?: string,
): AppResultAsync<AuthorizedScope, ScopeError> {
  return loadAuthorizedWebsite(deps, { permission: 'user.manage', tenantId: rawTenantId });
}
