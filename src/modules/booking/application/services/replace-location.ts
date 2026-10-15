import type { Actor } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { createBookingLocationDraft } from '../../domain/models/booking-location';

import { checkLocationKeepsDependents } from './hours-fit-checks';
import { retargetEmployees } from './retarget-employees';

import type { BookingLocation, BookingLocationInput } from '../../domain/models/booking-location';
import type { BookingDependencies } from '../booking-dependencies';

/**
 * Replaces the configuration of a location: the one path every change to a
 * stored location takes, so the whole form and a change of one part are held
 * to the same rules. New opening hours must still contain the hours of
 * everything placed at the location, and the employees there follow the hours
 * employees may work (`retargetEmployees`). Bookings already made keep their
 * stored times. The caller records what it did.
 */
export function replaceLocation(
  deps: BookingDependencies,
  subject: { readonly actor: Actor; readonly location: BookingLocation },
  input: Omit<BookingLocationInput, 'websiteId'>,
): AppResultAsync<BookingLocation, ValidationAppError | NotFoundAppError | InfrastructureAppError> {
  const { actor, location } = subject;
  const scope = { tenantId: actor.tenantId, websiteId: location.websiteId };

  return createBookingLocationDraft({ ...input, websiteId: location.websiteId })
    .asyncAndThen((draft) =>
      checkLocationKeepsDependents(deps, scope, { locationId: location.id, draft }),
    )
    .andThen((draft) => deps.locations.update(location.id, actor.tenantId, draft))
    .andThen((updated) =>
      retargetEmployees(deps, { tenantId: actor.tenantId, location: updated }).map(() => updated),
    );
}
