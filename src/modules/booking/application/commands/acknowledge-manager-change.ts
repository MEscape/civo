import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { resourceNotFound } from '../../domain/errors/booking-errors';
import { draftOfResource } from '../../domain/models/bookable-resource';
import { parseWebsiteId } from '../../domain/models/ids';

import type { BookingDependencies } from '../booking-dependencies';

/**
 * An employee has seen what a manager changed on their calendar. Only their
 * own calendar is found, by the person and never by an id from the request.
 */
export class AcknowledgeManagerChange {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    rawWebsiteId: string,
  ): AppResultAsync<
    void,
    AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError
  > {
    const { authorization, resources, audit } = this.deps;

    return authorization.requireInTenant('booking.profile.own').andThen((actor) => {
      const parsed = parseWebsiteId(rawWebsiteId);
      if (parsed.isErr()) {
        return errAsync(parsed.error);
      }
      return resources
        .listAssignedTo({ websiteId: parsed.value, tenantId: actor.tenantId }, actor.id, 1)
        .andThen(([own]) => {
          if (own === undefined) {
            return errAsync(resourceNotFound());
          }
          if (own.managerChange === null) {
            return okAsync(undefined);
          }
          return resources
            .update(own.id, actor.tenantId, { ...draftOfResource(own), managerChange: null })
            .map((updated) => {
              audit.record({
                type: 'booking.manager_change_acknowledged',
                actorId: actor.id,
                tenantId: actor.tenantId,
                websiteId: updated.websiteId,
                resourceId: updated.id,
              });
            });
        });
    });
  }
}
