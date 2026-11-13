import { toJsonValue } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { arrayOf, isString } from '@lib/utils';

import { bookingDataInvalid } from '../../domain/errors/booking-errors';
import { toBookableServiceId } from '../../domain/models/ids';
import { createTimeRange } from '../../domain/scheduling/weekly-hours';

import type { EmployeePreferences } from '../../domain/models/employee-preferences';

export const PREFERENCE_SELECT = ['resourceId', 'serviceIds', 'windowStart', 'windowEnd'] as const;

export interface PreferenceRecord {
  readonly resourceId: string;
  readonly serviceIds: unknown;
  readonly windowStart: number | null;
  readonly windowEnd: number | null;
}

const isTextList = arrayOf(isString);

/** A stored row as the ranking reads it; a row in another shape is a failure, never a guess. */
export function toPreferences(
  record: PreferenceRecord,
): AppResult<EmployeePreferences, InfrastructureAppError> {
  const { serviceIds, windowStart, windowEnd } = record;
  const window =
    windowStart === null || windowEnd === null ? null : createTimeRange(windowStart, windowEnd);
  if (!isTextList(serviceIds) || (windowStart !== null && !window)) {
    return err(bookingDataInvalid('preferences'));
  }
  return ok({
    serviceIds: serviceIds.map(toBookableServiceId),
    window,
  });
}

/** What a save writes: the services as JSON, the window as two minute columns (both or neither). */
export const toPreferenceColumns = ({ serviceIds, window }: EmployeePreferences) => ({
  serviceIds: toJsonValue([...serviceIds]),
  windowStart: window?.startMinute ?? null,
  windowEnd: window?.endMinute ?? null,
});
