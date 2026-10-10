import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { createBookableServiceDraft } from '../../domain/models/bookable-service';
import { toServiceView } from '../booking-view-mappers';
import { loadAuthorizedService } from '../load-authorized-service';
import { checkServiceReference } from '../services/reference-checks';

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
    const { services, audit } = this.deps;

    return loadAuthorizedService(this.deps, input.id, 'booking.configure').andThen(
      ({ actor, service }) =>
        createBookableServiceDraft({ ...input, websiteId: service.websiteId })
          .asyncAndThen((draft) =>
            checkServiceReference(
              this.deps,
              { tenantId: actor.tenantId, websiteId: service.websiteId },
              draft,
            ),
          )
          .andThen((draft) => services.update(service.id, actor.tenantId, draft))
          .map((updated) => {
            audit.record({
              type: 'booking.service_updated',
              actorId: actor.id,
              tenantId: actor.tenantId,
              websiteId: updated.websiteId,
              serviceId: updated.id,
            });
            return toServiceView(updated);
          }),
    );
  }
}
