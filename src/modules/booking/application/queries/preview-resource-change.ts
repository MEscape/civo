import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { resourceNotFound } from '../../domain/errors/booking-errors';
import { parseBookableResourceId } from '../../domain/models/ids';
import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { parseResourceInput } from '../services/parse-resource-input';
import { impactOfChange } from '../services/resource-impact';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { ResourceAdminDependencies } from '../booking-dependencies';
import type { PreviewResourceChangeInput } from '../contracts/resource-inputs';
import type { ResourceImpactView } from '../contracts/resource-views';

export type PreviewResourceChangeError =
  BookingAccessError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * Which existing bookings a change of a resource (when it can be used, a block, fewer places) would
 * leave without it, before anything is saved. It reads only: the same answer decides, in
 * `UpdateBookableResource`, whether the change may be saved without the manager's say. Needs
 * `booking.configure`, like the change itself.
 */
export class PreviewResourceChange {
  constructor(private readonly deps: ResourceAdminDependencies) {}

  execute(
    input: PreviewResourceChangeInput,
  ): AppResultAsync<ResourceImpactView, PreviewResourceChangeError> {
    const { access, resources, clock } = this.deps;
    const now = currentInstant(clock);

    return access.authorizeWebsite('booking.configure', input.websiteId).andThen(({ actor }) => {
      const scope = scopeOfActor(actor);
      return parseBookableResourceId(input.resourceId)
        .andThen((id) => parseResourceInput(input.resource).map((next) => ({ id, next })))
        .asyncAndThen(({ id, next }) =>
          resources
            .findById(scope, id)
            .andThen((resource) =>
              resource === null
                ? errAsync(resourceNotFound())
                : impactOfChange(this.deps, { scope, resource, next, now }),
            ),
        );
    });
  }
}
