import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { clampToLastPage, offsetOf, pageCountOf, resolvePageRequest } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import { ADOPTABLE_PAGE_LIMITS } from '../booking-limits';
import { SERVICE_LIMITS } from '../contracts/booking-constraints';
import { toAdoptableView } from '../services/adoptable-view';
import { scopeOfActor } from '../services/booking-scope';
import { loadLocation } from '../services/load-service-at-location';
import { loadLocationNames, nameView } from '../services/service-names';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { ServiceAdminDependencies } from '../booking-dependencies';
import type { ListAdoptableServicesInput } from '../contracts/service-inputs';
import type { AdoptablePageView } from '../contracts/service-views';

export type ListAdoptableServicesError =
  BookingAccessError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * The services another location offers and this one does not yet, a page at a time, by name,
 * narrowed by a name or by the location they come from. A service already on here, or switched off as
 * a whole, is not offered for adoption. Needs `booking.configure`.
 */
export class ListAdoptableServices {
  constructor(private readonly deps: ServiceAdminDependencies) {}

  execute(
    input: ListAdoptableServicesInput,
  ): AppResultAsync<AdoptablePageView, ListAdoptableServicesError> {
    const { access, services } = this.deps;

    return access.authorizeWebsite('booking.configure', input.websiteId).andThen(({ actor }) => {
      const scope = scopeOfActor(actor);
      return loadLocation(this.deps, scope, input.locationId).andThen((location) =>
        services.listAdoptable(scope, location.id, SERVICE_LIMITS.listMax).andThen((found) =>
          loadLocationNames(this.deps, scope).map((names): AdoptablePageView => {
            const search = input.search?.trim().toLowerCase() ?? '';
            const matching = found.services
              .filter(
                (service) =>
                  (search === '' || service.name.toLowerCase().includes(search)) &&
                  (input.sourceLocationId === undefined ||
                    input.sourceLocationId === '' ||
                    service.offeredAt.some((id) => id === input.sourceLocationId)),
              )
              .map((service) => toAdoptableView(service, names))
              .sort((a, b) => a.name.localeCompare(b.name));
            const paging = clampToLastPage(
              resolvePageRequest(input.page, ADOPTABLE_PAGE_LIMITS),
              matching.length,
            );
            const start = offsetOf(paging);
            const sourceIds = new Set(found.services.flatMap((service) => service.offeredAt));
            return {
              location: { id: location.id, name: location.name },
              items: matching.slice(start, start + paging.pageSize),
              page: paging.page,
              pageSize: paging.pageSize,
              total: matching.length,
              pageCount: pageCountOf(matching.length, paging.pageSize),
              sources: [...sourceIds].flatMap((id) => nameView(id, names) ?? []),
              isTruncated: found.isTruncated,
            };
          }),
        ),
      );
    });
  }
}
