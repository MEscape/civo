import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { serviceNotFound } from '../../domain/errors/booking-errors';
import { SERVICE_LIMITS } from '../contracts/booking-constraints';

import { countFutureServiceBookings } from './service-bookings';
import { loadLocationNames } from './service-names';
import { loadResourcesServing } from './service-resources';
import { toServiceView } from './service-views';

import type { ServiceAtLocation } from './load-service-at-location';
import type { StoredService } from '../../domain/models/stored-service';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type { StoredLocation } from '../../domain/ports/location-admin.repository';
import type { Instant } from '../../domain/time/instant';
import type { ServiceAdminDependencies } from '../booking-dependencies';
import type { ServiceView } from '../contracts/service-views';

/**
 * A service at a location made into the view its forms and overview read: the names of the other
 * locations and of the resources it uses, how many services use each, and the bookings it has ahead
 * here and everywhere. Shared by every use case that answers with a service, so they all describe it
 * the same way.
 */
export function loadServiceView(
  deps: ServiceAdminDependencies,
  request: {
    readonly scope: BookingScope;
    readonly found: ServiceAtLocation;
    readonly now: Instant;
  },
): AppResultAsync<ServiceView, InfrastructureAppError> {
  const { scope, found, now } = request;
  const { service, location } = found;
  const count = (locationId?: typeof location.id) =>
    countFutureServiceBookings(deps, {
      scope,
      serviceId: service.id,
      ...(locationId === undefined ? {} : { locationId }),
      now,
    });

  return loadLocationNames(deps, scope).andThen((names) =>
    loadResourcesServing(deps, scope, location.id).andThen((resources) =>
      deps.services.countResourceUse(scope, SERVICE_LIMITS.listMax).andThen((use) =>
        count(location.id).andThen((here) =>
          count().map((all) =>
            toServiceView({
              websiteId: scope.websiteId,
              found,
              names,
              resources,
              use: use.counts,
              futureBookingCount: here,
              futureBookingCountAll: all,
            }),
          ),
        ),
      ),
    ),
  );
}

/** The view of a service that was just stored, at the location it was stored for. */
export function loadSavedServiceView(
  deps: ServiceAdminDependencies,
  request: {
    readonly scope: BookingScope;
    readonly service: StoredService;
    readonly location: StoredLocation;
    readonly now: Instant;
  },
): AppResultAsync<ServiceView, InfrastructureAppError | NotFoundAppError> {
  const { scope, service, location, now } = request;
  const setting = service.locations.find((part) => part.locationId === location.id);
  return setting === undefined
    ? errAsync(serviceNotFound())
    : loadServiceView(deps, { scope, found: { service, location, setting }, now });
}
