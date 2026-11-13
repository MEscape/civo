import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { resourceNotFound } from '../../domain/errors/booking-errors';
import { parseBookableResourceId } from '../../domain/models/ids';
import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { loadResourceContext } from '../services/resource-context';
import { toResourceView } from '../services/resource-views';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { ResourceAdminDependencies } from '../booking-dependencies';
import type { GetResourceInput } from '../contracts/resource-inputs';
import type { ResourceView } from '../contracts/resource-views';

export type GetResourceError =
  BookingAccessError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * One physical resource in the shape its forms edit, with the services that use it, how it is used
 * today and the version a change must name. An employee or another website's resource is "not
 * found". Needs `booking.read`.
 */
export class GetResource {
  constructor(private readonly deps: ResourceAdminDependencies) {}

  execute(input: GetResourceInput): AppResultAsync<ResourceView, GetResourceError> {
    const { access, resources, clock } = this.deps;
    const now = currentInstant(clock);

    return access.authorizeWebsite('booking.read', input.websiteId).andThen(({ actor }) => {
      const scope = scopeOfActor(actor);
      return parseBookableResourceId(input.resourceId).asyncAndThen((id) =>
        resources
          .findById(scope, id)
          .andThen((resource) =>
            resource === null
              ? errAsync(resourceNotFound())
              : loadResourceContext(this.deps, { scope, locationId: resource.locationId, now }).map(
                  (context) => toResourceView(resource, { ...context, websiteId: scope.websiteId }),
                ),
          ),
      );
    });
  }
}
