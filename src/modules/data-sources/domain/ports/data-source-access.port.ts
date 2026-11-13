import type { ActorId, AuthorizationError, Permission, TenantId } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { WebsiteId } from '../models/ids';

export type DataSourceAccessError =
  AuthorizationError | ValidationAppError | InfrastructureAppError;

export interface DataSourceScope {
  readonly actorId: ActorId;
  readonly tenantId: TenantId;
  readonly websiteId: WebsiteId;
}

/** Auth owns the decision, based on memberships in the target website. */
export interface DataSourceAccess {
  authorizeWebsite(
    permission: Permission,
    rawWebsiteId: unknown,
  ): AppResultAsync<DataSourceScope, DataSourceAccessError>;
}
