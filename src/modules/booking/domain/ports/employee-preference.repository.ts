import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { BookingScope } from './booking.repository';
import type { EmployeePreferences } from '../models/employee-preferences';
import type { BookableResourceId } from '../models/ids';

/**
 * The preferences of the employees of a website, by their calendar. An employee who never saved any
 * is absent (no preference, BD-07); another website's calendar finds nothing.
 */
export interface EmployeePreferenceRepository {
  findMany(
    scope: BookingScope,
    resourceIds: readonly BookableResourceId[],
  ): AppResultAsync<ReadonlyMap<BookableResourceId, EmployeePreferences>, InfrastructureAppError>;

  /** Replaces what the employee said before. The calendar must be one of this website. */
  save(
    scope: BookingScope,
    resourceId: BookableResourceId,
    preferences: EmployeePreferences,
  ): AppResultAsync<EmployeePreferences, InfrastructureAppError>;
}
