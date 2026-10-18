import type { ActorId, TenantId } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { WebsiteScope } from './booking.repository';
import type { BookableResource, BookableResourceDraft } from '../models/bookable-resource';
import type { BookableResourceId, WebsiteId } from '../models/ids';

/** Persistence for resources (employees, rooms, pitches, equipment). Tenant-scoped like every repository here. */
export interface BookableResourceRepository {
  findById(
    id: BookableResourceId,
    tenantId: TenantId,
  ): AppResultAsync<BookableResource | null, InfrastructureAppError>;

  /** The names of those of `ids` that are resources of the website; nothing else is read. */
  findNames(
    websiteId: WebsiteId,
    tenantId: TenantId,
    ids: readonly BookableResourceId[],
  ): AppResultAsync<
    ReadonlyArray<{ readonly id: BookableResourceId; readonly name: string }>,
    InfrastructureAppError
  >;

  /** Bounded: never more than `limit` items. */
  listByWebsite(
    websiteId: WebsiteId,
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<readonly BookableResource[], InfrastructureAppError>;

  /**
   * The resources assigned to this person, selected in the store: what an
   * employee reads of the configuration never includes a colleague's
   * calendar. Bounded: never more than `limit` items.
   */
  listAssignedTo(
    scope: WebsiteScope,
    actorId: ActorId,
    limit: number,
  ): AppResultAsync<readonly BookableResource[], InfrastructureAppError>;

  /** Fails with "not found" when the website does not exist in this tenant. */
  create(input: {
    readonly tenantId: TenantId;
    readonly draft: BookableResourceDraft;
  }): AppResultAsync<BookableResource, NotFoundAppError | InfrastructureAppError>;

  /** Idempotent. The caller has checked that no booking refers to the resource. */
  deleteById(
    id: BookableResourceId,
    tenantId: TenantId,
  ): AppResultAsync<void, InfrastructureAppError>;

  update(
    id: BookableResourceId,
    tenantId: TenantId,
    draft: BookableResourceDraft,
  ): AppResultAsync<BookableResource, NotFoundAppError | InfrastructureAppError>;
}
