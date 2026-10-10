import type { TenantId } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { BookableResource, BookableResourceDraft } from '../models/bookable-resource';
import type { BookableResourceId, WebsiteId } from '../models/ids';

/** Persistence for resources (employees, rooms, pitches, equipment). Tenant-scoped like every repository here. */
export interface BookableResourceRepository {
  findById(
    id: BookableResourceId,
    tenantId: TenantId,
  ): AppResultAsync<BookableResource | null, InfrastructureAppError>;

  /** Bounded: never more than `limit` items. */
  listByWebsite(
    websiteId: WebsiteId,
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<readonly BookableResource[], InfrastructureAppError>;

  /** Fails with "not found" when the website does not exist in this tenant. */
  create(input: {
    readonly tenantId: TenantId;
    readonly draft: BookableResourceDraft;
  }): AppResultAsync<BookableResource, NotFoundAppError | InfrastructureAppError>;

  update(
    id: BookableResourceId,
    tenantId: TenantId,
    draft: BookableResourceDraft,
  ): AppResultAsync<BookableResource, NotFoundAppError | InfrastructureAppError>;
}
