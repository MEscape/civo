import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { loadClampedPage, offsetOf, resolvePageRequest, toPage } from '@lib/pagination';
import type { PageRequest } from '@lib/pagination';
import { err, ok } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import {
  BOOKING_VALIDATION_CODES as CODES,
  fieldValidationFailed,
} from '../../domain/errors/booking-errors';
import { parseBookingLocationId } from '../../domain/models/ids';
import { RESOURCE_PAGE_LIMITS } from '../booking-limits';
import { RESOURCE_LIMITS } from '../contracts/booking-constraints';
import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { parsePhysicalKind } from '../services/parse-resource-input';
import { loadResourceContext } from '../services/resource-context';
import { toResourceSummary } from '../services/resource-views';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type {
  PhysicalResourceKind,
  ResourceAdminListQuery,
} from '../../domain/ports/resource-admin.repository';
import type { ResourceAdminDependencies } from '../booking-dependencies';
import type { ListResourcesInput } from '../contracts/resource-inputs';
import type { ResourcePageView } from '../contracts/resource-views';

export type ListResourcesError =
  BookingAccessError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

function parseKindFilter(
  text: string | undefined,
): AppResult<PhysicalResourceKind | undefined, ValidationAppError> {
  if (text === undefined) {
    return ok(undefined);
  }
  const kind = parsePhysicalKind(text);
  return kind === null ? err(fieldValidationFailed('type', CODES.resourceTypeInvalid)) : ok(kind);
}

/**
 * The physical resources of one location, a page at a time, each with the services that use it and
 * how it is used today on the location's clock. Filtering, counting and paging are the database's.
 * Another website's location is "not found". Needs `booking.read`.
 */
export class ListResources {
  constructor(private readonly deps: ResourceAdminDependencies) {}

  execute(input: ListResourcesInput): AppResultAsync<ResourcePageView, ListResourcesError> {
    const { access, resources, clock } = this.deps;
    const now = currentInstant(clock);

    return access.authorizeWebsite('booking.read', input.websiteId).andThen(({ actor }) => {
      const scope = scopeOfActor(actor);
      return parseBookingLocationId(input.locationId)
        .andThen((locationId) => parseKindFilter(input.type).map((type) => ({ locationId, type })))
        .asyncAndThen(({ locationId, type }) =>
          loadResourceContext(this.deps, { scope, locationId, now }).andThen((context) => {
            const requested = resolvePageRequest(input.page, RESOURCE_PAGE_LIMITS);
            const search = input.search?.trim().slice(0, RESOURCE_LIMITS.searchMax);
            const query = (request: PageRequest): ResourceAdminListQuery => ({
              locationId,
              search,
              type,
              limit: request.pageSize,
              offset: offsetOf(request),
            });
            return loadClampedPage(requested, (request) =>
              resources
                .count(scope, query(request))
                .andThen((total) =>
                  resources
                    .list(scope, query(request))
                    .map((items) => toPage(items, total, request)),
                ),
            ).map((page) => ({
              location: { id: context.location.id, name: context.location.name },
              items: page.items.map((resource) => toResourceSummary(resource, context)),
              page: page.page,
              pageSize: page.pageSize,
              total: page.total,
              pageCount: page.pageCount,
            }));
          }),
        );
    });
  }
}
