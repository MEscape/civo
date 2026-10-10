import type { TenantId } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { BookableService, BookableServiceDraft } from '../models/bookable-service';
import type { BookableServiceId, WebsiteId } from '../models/ids';

/** Persistence for bookable services. Tenant-scoped like every repository here. */
export interface BookableServiceRepository {
  findById(
    id: BookableServiceId,
    tenantId: TenantId,
  ): AppResultAsync<BookableService | null, InfrastructureAppError>;

  /** Bounded: never more than `limit` items. */
  listByWebsite(
    websiteId: WebsiteId,
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<readonly BookableService[], InfrastructureAppError>;

  /** Fails with "not found" when the website does not exist in this tenant. */
  create(input: {
    readonly tenantId: TenantId;
    readonly draft: BookableServiceDraft;
  }): AppResultAsync<BookableService, NotFoundAppError | InfrastructureAppError>;

  update(
    id: BookableServiceId,
    tenantId: TenantId,
    draft: BookableServiceDraft,
  ): AppResultAsync<BookableService, NotFoundAppError | InfrastructureAppError>;
}
