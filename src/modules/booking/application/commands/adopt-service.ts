import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { err, errAsync, ok } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import {
  BOOKING_VALIDATION_CODES as CODES,
  fieldValidationFailed,
  serviceAlreadyOffered,
  serviceNotFound,
} from '../../domain/errors/booking-errors';
import { parseBookableServiceId, parseBookingLocationId } from '../../domain/models/ids';
import { ADOPT_MODES } from '../contracts/booking-constraints';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { withinActorLimit } from '../services/limit-actor';
import { loadLocation } from '../services/load-service-at-location';
import { loadSavedServiceView } from '../services/load-service-view';
import { copyOf } from '../services/service-definition';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { ServiceAdminDependencies } from '../booking-dependencies';
import type { AdoptMode } from '../contracts/booking-constraints';
import type { AdoptServiceInput } from '../contracts/service-inputs';
import type { ServiceView } from '../contracts/service-views';
import type { ActorLimitError } from '../services/limit-actor';

export type AdoptServiceError =
  | BookingAccessError
  | ActorLimitError
  | ValidationAppError
  | NotFoundAppError
  | ConflictAppError
  | InfrastructureAppError;

function parseMode(raw: string): AppResult<AdoptMode, ValidationAppError> {
  const mode = ADOPT_MODES.find((candidate) => candidate === raw);
  return mode === undefined ? err(fieldValidationFailed('mode', CODES.adoptModeInvalid)) : ok(mode);
}

/**
 * A manager takes over a service another location offers, as an independent copy or as a link.
 * A copy is a new service from the moment it is made: the same description, length, buffers,
 * deadlines and documents, nothing shared afterwards, the internal note left behind, and a plain
 * reference to where it came from. A link switches the very same service on here: changes to its
 * shared definition reach both places, and only whether it runs here, whether it takes online
 * bookings and which resources it uses are this location's own. Either way no resource is created or
 * assigned, and the service starts closed to online bookings: it is opened once the resources are
 * set. A service that is already on here, is off as a whole, or is not on at the place it was picked
 * from cannot be adopted. Needs `booking.configure`.
 */
export class AdoptService {
  constructor(private readonly deps: ServiceAdminDependencies) {}

  execute(input: AdoptServiceInput): AppResultAsync<ServiceView, AdoptServiceError> {
    const { access, services, audit, clock } = this.deps;
    const now = currentInstant(clock);

    return access
      .authorizeWebsite('booking.configure', input.websiteId)
      .andThen(({ actor }) => withinActorLimit(this.deps, BOOKING_RATE_LIMITS.staffActor, actor))
      .andThen((actor) => {
        const scope = scopeOfActor(actor);
        return parseMode(input.mode)
          .andThen((mode) =>
            parseBookableServiceId(input.serviceId).andThen((serviceId) =>
              parseBookingLocationId(input.sourceLocationId).map((sourceId) => ({
                mode,
                serviceId,
                sourceId,
              })),
            ),
          )
          .asyncAndThen(({ mode, serviceId, sourceId }) =>
            loadLocation(this.deps, scope, input.locationId).andThen((location) =>
              services.findById(scope, serviceId).andThen((service) => {
                if (service?.isActive !== true) {
                  return errAsync(serviceNotFound());
                }
                if (service.locations.some((part) => part.locationId === location.id)) {
                  return errAsync(serviceAlreadyOffered());
                }
                if (!service.locations.some((part) => part.locationId === sourceId)) {
                  return errAsync(serviceNotFound());
                }
                const setting = { isActive: true, isOnlineBookable: false, resources: [] };
                const adopted =
                  mode === 'link'
                    ? services.enable(scope, {
                        serviceId: service.id,
                        setting: { locationId: location.id, ...setting },
                        now,
                      })
                    : services.create(
                        scope,
                        {
                          service: copyOf(service, {
                            homeLocationId: location.id,
                            copiedFromLocationId: sourceId,
                          }),
                          locationId: location.id,
                          setting,
                        },
                        now,
                      );
                return adopted.andThen((stored) => {
                  audit.record({
                    type: 'booking.service_adopted',
                    tenantId: scope.tenantId,
                    websiteId: scope.websiteId,
                    actorId: actor.id,
                    serviceId: stored.id,
                    locationId: location.id,
                    how: mode,
                  });
                  return loadSavedServiceView(this.deps, {
                    scope,
                    service: stored,
                    location,
                    now,
                  });
                });
              }),
            ),
          );
      });
  }
}
