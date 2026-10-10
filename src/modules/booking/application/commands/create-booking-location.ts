import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { createBookingLocationDraft } from '../../domain/models/booking-location';
import { parseWebsiteId } from '../../domain/models/ids';
import { toLocationView } from '../booking-view-mappers';

import type { BookingDependencies } from '../booking-dependencies';
import type { CreateBookingLocationInput } from '../contracts/booking-inputs';
import type { LocationView } from '../contracts/setup-views';

/** Adds a place where services are offered, with its time zone and opening hours. */
export class CreateBookingLocation {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    input: CreateBookingLocationInput,
  ): AppResultAsync<
    LocationView,
    AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError
  > {
    const { authorization, locations, audit } = this.deps;

    return authorization.requireInTenant('booking.configure').andThen((actor) =>
      parseWebsiteId(input.websiteId)
        .andThen((websiteId) => createBookingLocationDraft({ ...input, websiteId }))
        .asyncAndThen((draft) => locations.create({ tenantId: actor.tenantId, draft }))
        .map((location) => {
          audit.record({
            type: 'booking.location_created',
            actorId: actor.id,
            tenantId: actor.tenantId,
            websiteId: location.websiteId,
            locationId: location.id,
          });
          return toLocationView(location);
        }),
    );
  }
}
