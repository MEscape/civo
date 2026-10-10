import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { createBookableResourceDraft } from '../../domain/models/bookable-resource';
import { toResourceView } from '../booking-view-mappers';
import { loadAuthorizedResource } from '../load-authorized-resource';
import { checkLocationReference } from '../services/reference-checks';

import type { BookingDependencies } from '../booking-dependencies';
import type { UpdateBookableResourceInput } from '../contracts/booking-inputs';
import type { ResourceView } from '../contracts/setup-views';
import type { LoadResourceError } from '../load-authorized-resource';

/** Replaces a resource's configuration: schedule, breaks, absences, skills, capacity. The website is fixed. */
export class UpdateBookableResource {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    input: UpdateBookableResourceInput,
  ): AppResultAsync<
    ResourceView,
    LoadResourceError | ValidationAppError | NotFoundAppError | InfrastructureAppError
  > {
    const { resources, audit } = this.deps;

    return loadAuthorizedResource(this.deps, input.id, 'booking.configure').andThen(
      ({ actor, resource }) =>
        createBookableResourceDraft({ ...input, websiteId: resource.websiteId })
          .asyncAndThen((draft) =>
            checkLocationReference(
              this.deps,
              { tenantId: actor.tenantId, websiteId: resource.websiteId },
              draft,
            ),
          )
          .andThen((draft) => resources.update(resource.id, actor.tenantId, draft))
          .map((updated) => {
            audit.record({
              type: 'booking.resource_updated',
              actorId: actor.id,
              tenantId: actor.tenantId,
              websiteId: updated.websiteId,
              resourceId: updated.id,
            });
            return toResourceView(updated);
          }),
    );
  }
}
