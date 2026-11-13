import type { ActorId, AuthorizationError, Permission, TenantId } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

export type BuilderAccessError = AuthorizationError | ValidationAppError | InfrastructureAppError;

/**
 * A website whose pages the actor may use, checked against the actor's current memberships and
 * independently of the website open in the session. Its tenant is the only one a use case reads
 * or writes.
 */
export interface BuilderScope {
  readonly actorId: ActorId;
  readonly tenantId: TenantId;
}

/** Auth owns permission decisions; builder use cases receive only the authorized scope. */
export interface BuilderAccess {
  authorizeWebsite(
    permission: Permission,
    rawWebsiteId: unknown,
  ): AppResultAsync<BuilderScope, BuilderAccessError>;
  /** Whether the actor holds the permission in the website; a refusal is `false`, not an error. */
  mayInWebsite(
    permission: Permission,
    rawWebsiteId: unknown,
  ): AppResultAsync<boolean, BuilderAccessError>;
}
