import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { createBookableResourceDraft } from '../../domain/models/bookable-resource';
import { parseWebsiteId } from '../../domain/models/ids';
import { toResourceView } from '../booking-view-mappers';
import { checkLocationReference } from '../services/reference-checks';

import type { BookingDependencies } from '../booking-dependencies';
import type { CreateBookableResourceInput } from '../contracts/booking-inputs';
import type { ResourceView } from '../contracts/setup-views';

/** Adds something that can be booked or that staffs a booking: an employee, a room, a pitch. */
export class CreateBookableResource {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    input: CreateBookableResourceInput,
  ): AppResultAsync<
    ResourceView,
    AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError
  > {
    const { authorization, resources, audit } = this.deps;

    return authorization.requireInTenant('booking.configure').andThen((actor) =>
      parseWebsiteId(input.websiteId)
        .andThen((websiteId) => createBookableResourceDraft({ ...input, websiteId }))
        .asyncAndThen((draft) =>
          checkLocationReference(
            this.deps,
            { tenantId: actor.tenantId, websiteId: draft.websiteId },
            draft,
          ),
        )
        .andThen((draft) => resources.create({ tenantId: actor.tenantId, draft }))
        .map((resource) => {
          audit.record({
            type: 'booking.resource_created',
            actorId: actor.id,
            tenantId: actor.tenantId,
            websiteId: resource.websiteId,
            resourceId: resource.id,
          });
          return toResourceView(resource);
        }),
    );
  }
}
