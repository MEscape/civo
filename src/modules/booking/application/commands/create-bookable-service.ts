import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { createBookableServiceDraft } from '../../domain/models/bookable-service';
import { parseWebsiteId } from '../../domain/models/ids';
import { toServiceView } from '../booking-view-mappers';
import { checkServiceFitsLocations } from '../services/hours-fit-checks';
import { checkServiceReference } from '../services/reference-checks';
import { requireBookableWhenActive } from '../services/require-bookable-when-active';

import type { BookingDependencies } from '../booking-dependencies';
import type { CreateBookableServiceInput } from '../contracts/booking-inputs';
import type { ServiceView } from '../contracts/setup-views';

/** Adds a bookable service: what it is, how long it takes, what it needs, where and under which rules. */
export class CreateBookableService {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    input: CreateBookableServiceInput,
  ): AppResultAsync<
    ServiceView,
    AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError
  > {
    const { authorization, services, audit } = this.deps;

    return authorization.requireInTenant('booking.configure').andThen((actor) =>
      parseWebsiteId(input.websiteId)
        .andThen((websiteId) => createBookableServiceDraft({ ...input, websiteId }))
        .asyncAndThen((draft) =>
          checkServiceReference(
            this.deps,
            { tenantId: actor.tenantId, websiteId: draft.websiteId },
            draft,
          ),
        )
        .andThen((draft) =>
          checkServiceFitsLocations(
            this.deps,
            { tenantId: actor.tenantId, websiteId: draft.websiteId },
            draft,
          ),
        )
        .andThen((draft) =>
          requireBookableWhenActive(
            this.deps,
            { tenantId: actor.tenantId, websiteId: draft.websiteId },
            { draft, serviceId: null },
          ),
        )
        .andThen((draft) => services.create({ tenantId: actor.tenantId, draft }))
        .map((service) => {
          audit.record({
            type: 'booking.service_created',
            actorId: actor.id,
            tenantId: actor.tenantId,
            websiteId: service.websiteId,
            serviceId: service.id,
          });
          return toServiceView(service);
        }),
    );
  }
}
