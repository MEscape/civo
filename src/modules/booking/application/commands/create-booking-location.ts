import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { withinActorLimit } from '../services/limit-actor';
import { toLocationView } from '../services/location-views';
import { parseLocationInput } from '../services/parse-location-input';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { LocationAdminDependencies } from '../booking-dependencies';
import type { CreateLocationInput } from '../contracts/location-inputs';
import type { LocationView } from '../contracts/location-views';
import type { ActorLimitError } from '../services/limit-actor';

export type CreateBookingLocationError =
  BookingAccessError | ActorLimitError | ValidationAppError | InfrastructureAppError;

/**
 * A manager adds a location. What the form sent is read into the rules' own types first (every
 * field problem is reported at once, by path); the website and the person come from the session. A
 * new location has no bookings, so there is nothing for the change to affect. Needs `booking.configure`.
 */
export class CreateBookingLocation {
  constructor(private readonly deps: LocationAdminDependencies) {}

  execute(input: CreateLocationInput): AppResultAsync<LocationView, CreateBookingLocationError> {
    const { access, locations, audit, clock } = this.deps;
    const now = currentInstant(clock);

    return access
      .authorizeWebsite('booking.configure', input.websiteId)
      .andThen(({ actor }) => withinActorLimit(this.deps, BOOKING_RATE_LIMITS.staffActor, actor))
      .andThen((actor) => {
        const scope = scopeOfActor(actor);
        return parseLocationInput(input)
          .asyncAndThen((parsed) => locations.create(scope, parsed, now))
          .map((created) => {
            audit.record({
              type: 'booking.location_created',
              tenantId: scope.tenantId,
              websiteId: scope.websiteId,
              actorId: actor.id,
              locationId: created.id,
            });
            return toLocationView(created, scope.websiteId, 0);
          });
      });
  }
}
