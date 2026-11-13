import type { ActorId, AuthorizationError, Permission, TenantId } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { WebsiteId } from '../models/ids';

export type WebsiteAccessError = AuthorizationError | ValidationAppError | InfrastructureAppError;

/** A target authorized from current memberships, independently of the website open in the request. */
export interface WebsiteScope {
  readonly actorId: ActorId;
  readonly websiteId: WebsiteId;
  readonly tenantId: TenantId;
}

/** Null means platform-wide authority; a partial allowlist is always reported to the screen. */
export interface ReadableWebsites {
  readonly websiteIds: readonly WebsiteId[] | null;
  readonly isTruncated: boolean;
}

/** Auth owns permission decisions; website use cases receive only the authorized persistence scope. */
export interface WebsiteAccess {
  listReadableWebsites(): AppResultAsync<ReadableWebsites, WebsiteAccessError>;
  authorizeWebsite(
    permission: Permission,
    rawWebsiteId: unknown,
  ): AppResultAsync<WebsiteScope, WebsiteAccessError>;
}
