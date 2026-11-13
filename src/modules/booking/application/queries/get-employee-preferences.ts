import type { InfrastructureAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { scopeOfActor } from '../services/booking-scope';
import { loadPreferenceOptions } from '../services/preference-choices';

import type { EmployeePreferences } from '../../domain/models/employee-preferences';
import type { BookableResourceId } from '../../domain/models/ids';
import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { EmployeeAreaDependencies } from '../booking-dependencies';
import type { WebsiteTargetInput } from '../contracts/booking-inputs';
import type { PreferencesView } from '../contracts/employee-views';

export type GetEmployeePreferencesError = BookingAccessError | InfrastructureAppError;

/**
 * What the signed-in employee said they would like (services, a part of the day), with what they can choose from. Someone without a calendar has nothing to prefer for.
 */
export class GetEmployeePreferences {
  constructor(private readonly deps: EmployeeAreaDependencies) {}

  execute(input: WebsiteTargetInput): AppResultAsync<PreferencesView, GetEmployeePreferencesError> {
    const { access, resources, preferences } = this.deps;

    return access.authorizeWebsite('booking.claim.own', input.websiteId).andThen(({ actor }) => {
      const scope = scopeOfActor(actor);
      return resources.findEmployeeOf(scope, actor.id).andThen((own) =>
        loadPreferenceOptions(this.deps, scope).andThen((options) =>
          (own === null
            ? okAsync(new Map<BookableResourceId, EmployeePreferences>())
            : preferences.findMany(scope, [own.id])
          ).map((saved): PreferencesView => {
            const mine = own === null ? undefined : saved.get(own.id);
            return {
              hasCalendar: own !== null,
              serviceIds: mine?.serviceIds ?? [],
              window: mine?.window ?? null,
              ...options,
            };
          }),
        ),
      );
    });
  }
}
