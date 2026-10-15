import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { hasBookings, resourceInUse, resourceNotFound } from '../../domain/errors/booking-errors';
import { MAX_SERVICES_PER_WEBSITE } from '../booking-limits';
import { loadAuthorizedResource } from '../load-authorized-resource';

import type { BookingDependencies } from '../booking-dependencies';
import type { LoadResourceError } from '../load-authorized-resource';

/**
 * Removes a room or piece of equipment that was never booked and that no
 * service asks for by name. An employee's calendar is theirs and is never
 * removed from here: for anyone else it does not exist.
 */
export class DeleteBookableResource {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    resourceId: string,
  ): AppResultAsync<
    void,
    | LoadResourceError
    | ConflictAppError
    | ValidationAppError
    | NotFoundAppError
    | InfrastructureAppError
  > {
    const { bookings, resources, services, audit } = this.deps;

    return loadAuthorizedResource(this.deps, resourceId, 'booking.configure').andThen(
      ({ actor, resource }) => {
        if (resource.type === 'employee') {
          return errAsync(resourceNotFound());
        }
        return services
          .listByWebsite(resource.websiteId, actor.tenantId, MAX_SERVICES_PER_WEBSITE)
          .andThen((stored) =>
            stored.some((service) =>
              service.requirements.some((requirement) =>
                requirement.resourceIds?.includes(resource.id),
              ),
            )
              ? errAsync(resourceInUse())
              : okAsync(undefined),
          )
          .andThen(() =>
            bookings.isReferenced({ kind: 'resource', id: resource.id }, actor.tenantId),
          )
          .andThen((isReferenced) => (isReferenced ? errAsync(hasBookings()) : okAsync(undefined)))
          .andThen(() => resources.deleteById(resource.id, actor.tenantId))
          .map(() => {
            audit.record({
              type: 'booking.resource_deleted',
              actorId: actor.id,
              tenantId: actor.tenantId,
              websiteId: resource.websiteId,
              resourceId: resource.id,
            });
          });
      },
    );
  }
}
