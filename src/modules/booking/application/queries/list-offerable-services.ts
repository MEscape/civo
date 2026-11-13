import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { SERVICE_LIMITS } from '../contracts/booking-constraints';
import { toAdoptableView } from '../services/adoptable-view';
import { scopeOfActor } from '../services/booking-scope';
import { loadLocationNames } from '../services/service-names';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { ServiceAdminDependencies } from '../booking-dependencies';
import type { ListOfferableServicesInput } from '../contracts/service-inputs';
import type { OfferableServicesView } from '../contracts/service-views';

export type ListOfferableServicesError =
  BookingAccessError | ValidationAppError | InfrastructureAppError;

/**
 * The services a location that is not made yet could start with: every service that is on at some
 * location and not switched off as a whole, by name, each once. The new-location wizard offers them
 * as a step, only when there are any. Needs `booking.configure`.
 */
export class ListOfferableServices {
  constructor(private readonly deps: ServiceAdminDependencies) {}

  execute(
    input: ListOfferableServicesInput,
  ): AppResultAsync<OfferableServicesView, ListOfferableServicesError> {
    const { access, services } = this.deps;

    return access.authorizeWebsite('booking.configure', input.websiteId).andThen(({ actor }) => {
      const scope = scopeOfActor(actor);
      return services.listAdoptable(scope, null, SERVICE_LIMITS.listMax).andThen((found) =>
        loadLocationNames(this.deps, scope).map((names): OfferableServicesView => ({
          items: found.services
            .map((service) => toAdoptableView(service, names))
            .sort((a, b) => a.name.localeCompare(b.name)),
          isTruncated: found.isTruncated,
        })),
      );
    });
  }
}
