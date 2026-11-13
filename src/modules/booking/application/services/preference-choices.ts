import type { InfrastructureAppError } from '@lib/errors';
import { combineAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { keyBy } from '@lib/utils';

import { MAX_SERVICES_PER_LOCATION } from '../booking-limits';

import { loadLocations } from './employee-labels';

import type { BookingScope } from '../../domain/ports/booking.repository';
import type { EmployeeAreaDependencies } from '../booking-dependencies';
import type { PreferenceServiceOptionView } from '../contracts/employee-views';

export interface PreferenceOptions {
  /** By category, then name. */
  readonly services: readonly PreferenceServiceOptionView[];
}

const byCategoryThenName = (a: PreferenceServiceOptionView, b: PreferenceServiceOptionView) =>
  (a.category ?? '').localeCompare(b.category ?? '') || a.name.localeCompare(b.name);

/** What an employee can prefer: every service that runs at one of the website's locations (each once, wherever it runs). */
export function loadPreferenceOptions(
  deps: Pick<EmployeeAreaDependencies, 'locationAdmin' | 'serviceAdmin'>,
  scope: BookingScope,
): AppResultAsync<PreferenceOptions, InfrastructureAppError> {
  return loadLocations(deps, scope).andThen((locations) =>
    combineAsync(
      [...locations.values()].map((location) =>
        deps.serviceAdmin.listAtLocation(scope, location.id, MAX_SERVICES_PER_LOCATION),
      ),
    ).map((listings) => {
      const running = listings.flatMap(({ entries }) =>
        entries.filter((entry) => entry.isActive && entry.setting.isActive),
      );
      const services = [...keyBy(running, (entry) => entry.id).values()].map(
        ({ id, name, category }) => ({ id, name, category }),
      );
      return {
        services: services.sort(byCategoryThenName),
      };
    }),
  );
}
