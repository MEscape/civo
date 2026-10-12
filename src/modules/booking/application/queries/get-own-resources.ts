import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { parseWebsiteId } from '../../domain/models/ids';
import { MAX_RESOURCES_PER_WEBSITE } from '../booking-limits';
import { toResourceView } from '../booking-view-mappers';

import type { BookingDependencies } from '../booking-dependencies';
import type { ResourceView } from '../contracts/setup-views';

/**
 * The resources assigned to the signed-in person on one website, with their
 * working hours: what an employee sees of the configuration, and nothing of
 * the others'. The assignment is compared on the server against the actor,
 * never against a value the request carries.
 */
export class GetOwnResources {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    rawWebsiteId: string,
  ): AppResultAsync<
    readonly ResourceView[],
    AuthorizationError | ValidationAppError | InfrastructureAppError
  > {
    const { authorization, resources } = this.deps;

    return authorization.requireInTenant('booking.read.own').andThen((actor) => {
      const websiteId = parseWebsiteId(rawWebsiteId);
      if (websiteId.isErr()) {
        return errAsync(websiteId.error);
      }
      return resources
        .listByWebsite(websiteId.value, actor.tenantId, MAX_RESOURCES_PER_WEBSITE)
        .map((stored) =>
          stored.filter((resource) => resource.assignedActorId === actor.id).map(toResourceView),
        );
    });
  }
}
