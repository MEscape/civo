import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { createBookingLocationDraft } from '../../domain/models/booking-location';
import { toLocationView } from '../booking-view-mappers';
import { loadAuthorizedLocation } from '../load-authorized-location';

import type { BookingDependencies } from '../booking-dependencies';
import type { UpdateBookingLocationInput } from '../contracts/booking-inputs';
import type { LocationView } from '../contracts/setup-views';
import type { LoadLocationError } from '../load-authorized-location';

/**
 * Replaces a location's configuration. The website is fixed: a location
 * never moves between websites. Existing bookings keep their stored times;
 * only bookings made afterwards follow the new hours and zone.
 */
export class UpdateBookingLocation {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    input: UpdateBookingLocationInput,
  ): AppResultAsync<
    LocationView,
    LoadLocationError | ValidationAppError | NotFoundAppError | InfrastructureAppError
  > {
    const { locations, audit } = this.deps;

    return loadAuthorizedLocation(this.deps, input.id, 'booking.configure').andThen(
      ({ actor, location }) =>
        createBookingLocationDraft({ ...input, websiteId: location.websiteId })
          .asyncAndThen((draft) => locations.update(location.id, actor.tenantId, draft))
          .map((updated) => {
            audit.record({
              type: 'booking.location_updated',
              actorId: actor.id,
              tenantId: actor.tenantId,
              websiteId: updated.websiteId,
              locationId: updated.id,
            });
            return toLocationView(updated);
          }),
    );
  }
}
