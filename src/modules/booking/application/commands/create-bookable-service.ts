import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  BOOKING_VALIDATION_CODES as CODES,
  fieldValidationFailed,
} from '../../domain/errors/booking-errors';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { withinActorLimit } from '../services/limit-actor';
import { loadLocation } from '../services/load-service-at-location';
import { loadSavedServiceView } from '../services/load-service-view';
import { parseServiceInput } from '../services/parse-service-input';
import { definitionOf, newBase } from '../services/service-definition';
import { linksFor, loadResourcesServing } from '../services/service-resources';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { ServiceAdminDependencies } from '../booking-dependencies';
import type { CreateServiceInput } from '../contracts/service-inputs';
import type { ServiceView } from '../contracts/service-views';
import type { ActorLimitError } from '../services/limit-actor';

export type CreateBookableServiceError =
  | BookingAccessError
  | ActorLimitError
  | ValidationAppError
  | NotFoundAppError
  | InfrastructureAppError;

/**
 * A manager defines a new service at a location: what it is called, how long it takes, what it
 * needs, who may change a booking and until when. It is the location's own: nothing else has it,
 * and it is independent of every other service. What the form sent is read into the rules' own types
 * first (every field problem is reported at once, by path); the website and the person come from the
 * session. The resources named must be ones that serve this location. Needs `booking.configure`.
 */
export class CreateBookableService {
  constructor(private readonly deps: ServiceAdminDependencies) {}

  execute(input: CreateServiceInput): AppResultAsync<ServiceView, CreateBookableServiceError> {
    const { access, services, audit, clock } = this.deps;
    const now = currentInstant(clock);

    return access
      .authorizeWebsite('booking.configure', input.websiteId)
      .andThen(({ actor }) => withinActorLimit(this.deps, BOOKING_RATE_LIMITS.staffActor, actor))
      .andThen((actor) => {
        const scope = scopeOfActor(actor);
        return loadLocation(this.deps, scope, input.locationId).andThen((location) =>
          parseServiceInput(input).asyncAndThen((parsed) =>
            loadResourcesServing(this.deps, scope, location.id).andThen((serving) =>
              linksFor(parsed.local.resources, serving).asyncAndThen(
                (links): AppResultAsync<ServiceView, CreateBookableServiceError> => {
                  const definition = definitionOf(
                    parsed.shared,
                    newBase({ homeLocationId: location.id, copiedFromLocationId: null }),
                  );
                  if (definition === null) {
                    return errAsync(
                      fieldValidationFailed('durationMinutes', CODES.durationInvalid),
                    );
                  }
                  return services
                    .create(
                      scope,
                      {
                        service: definition,
                        locationId: location.id,
                        setting: {
                          isActive: parsed.local.isActive,
                          isOnlineBookable: parsed.local.isOnlineBookable,
                          resources: links,
                        },
                      },
                      now,
                    )
                    .andThen((created) => {
                      audit.record({
                        type: 'booking.service_created',
                        tenantId: scope.tenantId,
                        websiteId: scope.websiteId,
                        actorId: actor.id,
                        serviceId: created.id,
                        locationId: location.id,
                      });
                      return loadSavedServiceView(this.deps, {
                        scope,
                        service: created,
                        location,
                        now,
                      });
                    });
                },
              ),
            ),
          ),
        );
      });
  }
}
