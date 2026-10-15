import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { createBookableResourceDraft } from '../../domain/models/bookable-resource';
import { parseWebsiteId } from '../../domain/models/ids';
import { toResourceView } from '../booking-view-mappers';
import { refuseEmployeeResource } from '../services/employee-resources';
import { checkResourceFitsLocation } from '../services/hours-fit-checks';
import { checkLocationReference } from '../services/reference-checks';

import type { BookingDependencies } from '../booking-dependencies';
import type { CreateBookableResourceInput } from '../contracts/booking-inputs';
import type { ResourceView } from '../contracts/setup-views';

/** Adds something that can be booked: a room, a pitch, equipment. Employees add themselves (`SaveOwnProfile`). */
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
      refuseEmployeeResource(input)
        .andThen(() => parseWebsiteId(input.websiteId))
        .andThen((websiteId) => createBookableResourceDraft({ ...input, websiteId }))
        .asyncAndThen((draft) =>
          checkLocationReference(
            this.deps,
            { tenantId: actor.tenantId, websiteId: draft.websiteId },
            draft,
          ),
        )
        .andThen((draft) =>
          checkResourceFitsLocation(
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
