import type { TenantId } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { BookingLocation, BookingLocationDraft } from '../models/booking-location';
import type { BookingLocationId, WebsiteId } from '../models/ids';

/**
 * Persistence for locations. Every read and write takes the tenant and
 * matches on it, so another tenant's id behaves like an id that does not
 * exist. Finders return `null` for "absent"; whether that is an error is the
 * use case's decision.
 */
export interface BookingLocationRepository {
  findById(
    id: BookingLocationId,
    tenantId: TenantId,
  ): AppResultAsync<BookingLocation | null, InfrastructureAppError>;

  /** Bounded: never more than `limit` items. */
  listByWebsite(
    websiteId: WebsiteId,
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<readonly BookingLocation[], InfrastructureAppError>;

  /** Fails with "not found" when the website does not exist in this tenant. */
  create(input: {
    readonly tenantId: TenantId;
    readonly draft: BookingLocationDraft;
  }): AppResultAsync<BookingLocation, NotFoundAppError | InfrastructureAppError>;

  update(
    id: BookingLocationId,
    tenantId: TenantId,
    draft: BookingLocationDraft,
  ): AppResultAsync<BookingLocation, NotFoundAppError | InfrastructureAppError>;
}
