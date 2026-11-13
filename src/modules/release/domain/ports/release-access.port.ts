import type { Actor, AuthorizationError, Permission } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { WebsiteId } from '../models/ids';

export type ReleaseAccessError = AuthorizationError | ValidationAppError | InfrastructureAppError;

/** Auth has checked this target against current memberships, independently of the open website. */
export interface ReleaseScope {
  readonly actor: Actor;
  readonly websiteId: WebsiteId;
}

export interface ReleaseAccess {
  authorizeWebsite(
    permission: Permission,
    rawWebsiteId: unknown,
  ): AppResultAsync<ReleaseScope, ReleaseAccessError>;
}
