import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { locationNotFound } from '../../domain/errors/booking-errors';
import { parseBookingLocationId } from '../../domain/models/ids';
import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { findNewlyAffected } from '../services/location-impact';
import { parseLocationInput } from '../services/parse-location-input';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { LocationAdminDependencies } from '../booking-dependencies';
import type { PreviewLocationChangeInput } from '../contracts/location-inputs';
import type { LocationImpactView } from '../contracts/location-views';

export type PreviewLocationChangeError =
  BookingAccessError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * Which existing bookings a change of a location's opening hours would leave outside them, before
 * anything is saved. It changes nothing and reads only: the same answer decides, in
 * `UpdateBookingLocation`, whether the change may be saved without the manager's say. Needs
 * `booking.configure`, like the change itself.
 */
export class PreviewLocationChange {
  constructor(private readonly deps: LocationAdminDependencies) {}

  execute(
    input: PreviewLocationChangeInput,
  ): AppResultAsync<LocationImpactView, PreviewLocationChangeError> {
    const { access, locations, clock } = this.deps;
    const now = currentInstant(clock);

    return access.authorizeWebsite('booking.configure', input.websiteId).andThen(({ actor }) => {
      const scope = scopeOfActor(actor);
      return parseBookingLocationId(input.locationId)
        .andThen((id) => parseLocationInput(input.location).map((next) => ({ id, next })))
        .asyncAndThen(({ id, next }) =>
          locations.findById(scope, id).andThen((location) =>
            location === null
              ? errAsync(locationNotFound())
              : findNewlyAffected(this.deps, {
                  scope,
                  location,
                  nextPlan: next.openingHours,
                  nextZone: next.zone,
                  now,
                }),
          ),
        );
    });
  }
}
