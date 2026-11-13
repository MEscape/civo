import type { ActorId, AuthorizationError, Permission, TenantId } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

export type MediaAccessError = AuthorizationError | ValidationAppError | InfrastructureAppError;

/**
 * A website whose files the actor may use, checked against the actor's current memberships and
 * independently of the website open in the session. Its tenant is the only one a use case reads or
 * writes; nothing else the request says about a website reaches a query.
 */
export interface MediaScope {
  readonly actorId: ActorId;
  readonly tenantId: TenantId;
}

/** Auth owns permission decisions; media use cases receive only the authorized scope. */
export interface MediaAccess {
  authorizeWebsite(
    permission: Permission,
    rawWebsiteId: unknown,
  ): AppResultAsync<MediaScope, MediaAccessError>;
}
