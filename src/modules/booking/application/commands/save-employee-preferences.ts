import type { ConflictAppError, InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { BOOKING_ERROR_CODES as CODES, bookingConflict } from '../../domain/errors/booking-errors';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { scopeOfActor } from '../services/booking-scope';
import { withinActorLimit } from '../services/limit-actor';
import { parsePreferences } from '../services/parse-preferences';
import { loadPreferenceOptions } from '../services/preference-choices';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { EmployeeAreaDependencies } from '../booking-dependencies';
import type { SavePreferencesInput } from '../contracts/employee-inputs';
import type { SavedPreferencesView } from '../contracts/employee-views';
import type { ActorLimitError } from '../services/limit-actor';

export type SaveEmployeePreferencesError =
  | BookingAccessError
  | ActorLimitError
  | ValidationAppError
  | ConflictAppError
  | InfrastructureAppError;

/**
 * The signed-in employee says where, what and when they would like to work. It only sorts what
 * they and the managers are offered (BD-07); nothing becomes ineligible. It is theirs alone: the
 * calendar is the signed-in person's, never an id from the request. No message is written for it
 * (BD-11: it is not news to the person who did it).
 */
export class SaveEmployeePreferences {
  constructor(private readonly deps: EmployeeAreaDependencies) {}

  execute(
    input: SavePreferencesInput,
  ): AppResultAsync<SavedPreferencesView, SaveEmployeePreferencesError> {
    const { access, resources, preferences, audit } = this.deps;

    return access
      .authorizeWebsite('booking.claim.own', input.websiteId)
      .andThen(({ actor }) => withinActorLimit(this.deps, BOOKING_RATE_LIMITS.employeeActor, actor))
      .andThen((actor) => {
        const scope = scopeOfActor(actor);
        return resources.findEmployeeOf(scope, actor.id).andThen((own) =>
          own === null
            ? errAsync(bookingConflict(CODES.notEligible, 'You have no calendar to prefer for.'))
            : loadPreferenceOptions(this.deps, scope).andThen((options) =>
                parsePreferences(input, {
                  serviceIds: new Set(options.services.map(({ id }) => id)),
                })
                  .asyncAndThen((parsed) => preferences.save(scope, own.id, parsed))
                  .map((saved) => {
                    audit.record({
                      type: 'booking.preferences_saved',
                      tenantId: scope.tenantId,
                      websiteId: scope.websiteId,
                      actorId: actor.id,
                      resourceId: own.id,
                    });
                    return { websiteId: scope.websiteId, ...saved };
                  }),
              ),
        );
      });
  }
}
