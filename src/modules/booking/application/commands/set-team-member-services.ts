import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  BOOKING_VALIDATION_CODES,
  fieldValidationFailed,
  resourceNotFound,
} from '../../domain/errors/booking-errors';
import { draftOfResource, withManagerChange } from '../../domain/models/bookable-resource';
import { offeredServiceIdsOf, withOfferedServices } from '../../domain/models/service-skill';
import { MAX_SERVICES_PER_WEBSITE } from '../booking-limits';
import { toResourceView } from '../booking-view-mappers';
import { loadAuthorizedResource } from '../load-authorized-resource';

import type { BookingDependencies } from '../booking-dependencies';
import type { SetTeamMemberServicesInput } from '../contracts/booking-inputs';
import type { ResourceView } from '../contracts/setup-views';
import type { LoadResourceError } from '../load-authorized-resource';

/**
 * Sets which services an employee offers, for those who manage the bookings:
 * the way to put someone on a service that has nobody yet, without waiting for
 * them to do it. Only services offered where the employee works can be chosen.
 * The employee keeps what is theirs (name, hours, location) and is told on
 * their own calendar that somebody else changed their services.
 */
export class SetTeamMemberServices {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    input: SetTeamMemberServicesInput,
  ): AppResultAsync<
    ResourceView,
    LoadResourceError | ValidationAppError | NotFoundAppError | InfrastructureAppError
  > {
    const { resources, services, audit, clock } = this.deps;

    return loadAuthorizedResource(this.deps, input.resourceId, 'booking.manage').andThen(
      ({ actor, resource }) => {
        if (resource.type !== 'employee') {
          return errAsync(resourceNotFound());
        }
        return services
          .listByWebsite(resource.websiteId, actor.tenantId, MAX_SERVICES_PER_WEBSITE)
          .andThen((stored) => {
            const offerable = new Set(
              stored
                .filter((service) => service.locationIds.some((id) => id === resource.locationId))
                .map((service) => service.id as string),
            );
            if (!input.offeredServiceIds.every((id) => offerable.has(id))) {
              return errAsync(
                fieldValidationFailed('offeredServiceIds', BOOKING_VALIDATION_CODES.idInvalid),
              );
            }
            const current = new Set(offeredServiceIdsOf(resource.skills));
            const isUnchanged =
              current.size === new Set(input.offeredServiceIds).size &&
              input.offeredServiceIds.every((id) => current.has(id));
            return resources
              .update(resource.id, actor.tenantId, {
                ...draftOfResource(resource),
                skills: withOfferedServices(resource.skills, input.offeredServiceIds),
                managerChange: isUnchanged
                  ? resource.managerChange
                  : withManagerChange(resource.managerChange, {
                      kind: 'services',
                      at: clock.now(),
                    }),
              })
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
          });
      },
    );
  }
}
