import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { resourceNotFound } from '../../domain/errors/booking-errors';
import { createBookableResourceDraft } from '../../domain/models/bookable-resource';
import { toResourceView } from '../booking-view-mappers';
import { loadAuthorizedResource } from '../load-authorized-resource';

import type { BookingDependencies } from '../booking-dependencies';
import type { UpdateOwnAvailabilityInput } from '../contracts/booking-inputs';
import type { ResourceView } from '../contracts/setup-views';
import type { LoadResourceError } from '../load-authorized-resource';

/**
 * Lets an employee change the working hours of their OWN calendar, and only
 * that. It needs `booking.availability.own`, the resource must be assigned
 * to the actor, and an editor must have allowed it on the resource
 * (`employeeMayEditHours`). Anything else answers "not found", so a person
 * learns nothing about calendars that are not theirs. Every other property of
 * the resource is kept exactly as an editor configured it.
 */
export class UpdateOwnAvailability {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    input: UpdateOwnAvailabilityInput,
  ): AppResultAsync<
    ResourceView,
    LoadResourceError | ValidationAppError | NotFoundAppError | InfrastructureAppError
  > {
    const { resources, audit } = this.deps;

    return loadAuthorizedResource(this.deps, input.resourceId, 'booking.availability.own').andThen(
      ({ actor, resource }) => {
        if (resource.assignedActorId !== actor.id || !resource.employeeMayEditHours) {
          return errAsync(resourceNotFound());
        }
        return createBookableResourceDraft({
          websiteId: resource.websiteId,
          locationId: resource.locationId,
          name: resource.name,
          type: resource.type,
          skills: resource.skills,
          capacity: resource.capacity,
          availability: input.availability,
          isActive: resource.isActive,
          assignedActorId: resource.assignedActorId,
          employeeMayEditHours: resource.employeeMayEditHours,
        })
          .asyncAndThen((draft) => resources.update(resource.id, actor.tenantId, draft))
          .map((updated) => {
            audit.record({
              type: 'booking.resource_updated',
              actorId: actor.id,
              tenantId: actor.tenantId,
              websiteId: updated.websiteId,
              resourceId: updated.id,
            });
            return toResourceView(updated);
          });
      },
    );
  }
}
