import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { toServiceView } from '../booking-view-mappers';
import { loadAuthorizedService } from '../load-authorized-service';
import { replaceService } from '../services/replace-service';

import type { BookingDependencies } from '../booking-dependencies';
import type { UpdateBookableServiceInput } from '../contracts/booking-inputs';
import type { ServiceView } from '../contracts/setup-views';
import type { LoadServiceError } from '../load-authorized-service';

/**
 * Replaces a service's configuration. Bookings already made keep the times
 * they were made for; only bookings made afterwards follow the new rules.
 * The website is fixed.
 */
export class UpdateBookableService {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    input: UpdateBookableServiceInput,
  ): AppResultAsync<
    ServiceView,
    LoadServiceError | ValidationAppError | NotFoundAppError | InfrastructureAppError
  > {
    const { audit } = this.deps;

    return loadAuthorizedService(this.deps, input.id, 'booking.configure').andThen((loaded) =>
      replaceService(this.deps, loaded, input).map((updated) => {
        audit.record({
          type: 'booking.service_updated',
          actorId: loaded.actor.id,
          tenantId: loaded.actor.tenantId,
          websiteId: updated.websiteId,
          serviceId: updated.id,
        });
        return toServiceView(updated);
      }),
    );
  }
}
