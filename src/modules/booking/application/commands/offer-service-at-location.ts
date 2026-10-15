import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { toServiceView } from '../booking-view-mappers';
import { loadAuthorizedService } from '../load-authorized-service';
import { replaceService } from '../services/replace-service';

import type { BookingDependencies } from '../booking-dependencies';
import type { OfferServiceAtLocationInput } from '../contracts/booking-inputs';
import type { ServiceView } from '../contracts/setup-views';
import type { LoadServiceError } from '../load-authorized-service';

/**
 * Offers an existing service at one more location, or stops offering it
 * there, leaving everything else about it as it is. One service at several
 * places is still one service, so this is how a new location reuses what the
 * others already have instead of making it again. The new set of locations is
 * worked out from the stored service, not sent by the caller, and goes through
 * the same rules as any other change: the location must exist, and at least
 * one must remain.
 */
export class OfferServiceAtLocation {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    input: OfferServiceAtLocationInput,
  ): AppResultAsync<
    ServiceView,
    LoadServiceError | ValidationAppError | NotFoundAppError | InfrastructureAppError
  > {
    const { audit } = this.deps;

    return loadAuthorizedService(this.deps, input.serviceId, 'booking.configure').andThen(
      (loaded) => {
        const others = loaded.service.locationIds.filter((id) => id !== input.locationId);
        return replaceService(this.deps, loaded, {
          ...toServiceView(loaded.service),
          locationIds: input.isOffered ? [...others, input.locationId] : others,
        }).map((updated) => {
          audit.record({
            type: 'booking.service_updated',
            actorId: loaded.actor.id,
            tenantId: loaded.actor.tenantId,
            websiteId: updated.websiteId,
            serviceId: updated.id,
          });
          return toServiceView(updated);
        });
      },
    );
  }
}
