import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { toLocationView } from '../booking-view-mappers';
import { loadAuthorizedLocation } from '../load-authorized-location';
import { replaceLocation } from '../services/replace-location';

import type { BookingDependencies } from '../booking-dependencies';
import type { SetStaffHoursInput } from '../contracts/booking-inputs';
import type { LocationView } from '../contracts/setup-views';
import type { LoadLocationError } from '../load-authorized-location';

/**
 * Sets the hours employees may work at a location, for those who manage the
 * bookings: narrower than the opening hours, or `null` for whenever it is
 * open. Nothing else about the location changes. Employees already there
 * whose week reaches beyond are cut to fit and told so on their own calendar.
 */
export class SetStaffHours {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    input: SetStaffHoursInput,
  ): AppResultAsync<
    LocationView,
    LoadLocationError | ValidationAppError | NotFoundAppError | InfrastructureAppError
  > {
    const { audit } = this.deps;

    return loadAuthorizedLocation(this.deps, input.locationId, 'booking.manage').andThen(
      ({ actor, location }) => {
        const current = toLocationView(location);
        return replaceLocation(
          this.deps,
          { actor, location },
          {
            name: current.name,
            address: current.address,
            timeZone: current.timeZone,
            openingHours: current.openingHours,
            isActive: current.isActive,
            staffHours: input.staffHours,
          },
        ).map((updated) => {
          audit.record({
            type: 'booking.location_updated',
            actorId: actor.id,
            tenantId: actor.tenantId,
            websiteId: updated.websiteId,
            locationId: updated.id,
          });
          return toLocationView(updated);
        });
      },
    );
  }
}
