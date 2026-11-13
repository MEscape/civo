import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { loadServiceAtLocation } from '../services/load-service-at-location';
import { loadServiceView } from '../services/load-service-view';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { ServiceAdminDependencies } from '../booking-dependencies';
import type { GetServiceInput } from '../contracts/service-inputs';
import type { ServiceView } from '../contracts/service-views';

export type GetServiceError =
  BookingAccessError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * One service as it is at one location, in the shape its forms edit: the shared definition, this
 * location's part, the version of each, where it came from, which other locations it reaches, and how
 * many confirmed bookings it has ahead. A service that is not on at the location is "not found",
 * whatever the reason. Needs `booking.read`.
 */
export class GetService {
  constructor(private readonly deps: ServiceAdminDependencies) {}

  execute(input: GetServiceInput): AppResultAsync<ServiceView, GetServiceError> {
    const { access, clock } = this.deps;
    const now = currentInstant(clock);

    return access.authorizeWebsite('booking.read', input.websiteId).andThen(({ actor }) => {
      const scope = scopeOfActor(actor);
      return loadServiceAtLocation(this.deps, scope, input).andThen((found) =>
        loadServiceView(this.deps, { scope, found, now }),
      );
    });
  }
}
