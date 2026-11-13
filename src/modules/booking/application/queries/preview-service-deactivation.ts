import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { loadServiceAtLocation } from '../services/load-service-at-location';
import { findServiceImpact, parseScope } from '../services/service-impact';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { ServiceAdminDependencies } from '../booking-dependencies';
import type { PreviewServiceDeactivationInput } from '../contracts/service-inputs';
import type { DeactivationImpactView } from '../contracts/service-views';

export type PreviewServiceDeactivationError =
  BookingAccessError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * Which confirmed bookings closing a service would reach, here or everywhere it is on, before
 * anything is changed. It reads and changes nothing: the answer is what the manager reviews, booking
 * by booking, before choosing to close the service. Needs `booking.configure`, like the change.
 */
export class PreviewServiceDeactivation {
  constructor(private readonly deps: ServiceAdminDependencies) {}

  execute(
    input: PreviewServiceDeactivationInput,
  ): AppResultAsync<DeactivationImpactView, PreviewServiceDeactivationError> {
    const now = currentInstant(this.deps.clock);

    return this.deps.access
      .authorizeWebsite('booking.configure', input.websiteId)
      .andThen(({ actor }) => {
        const scope = scopeOfActor(actor);
        return parseScope(input.scope).asyncAndThen((closing) =>
          loadServiceAtLocation(this.deps, scope, input).andThen(({ service, location }) =>
            findServiceImpact(this.deps, {
              scope,
              service,
              locationId: location.id,
              closing,
              now,
            }).map(({ view }) => view),
          ),
        );
      });
  }
}
