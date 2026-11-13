import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { unique } from '@lib/utils';

import {
  BOOKING_VALIDATION_CODES as CODES,
  createBookingErrorBag,
} from '../../domain/errors/booking-errors';
import { toBookableServiceId } from '../../domain/models/ids';
import { createTimeRange } from '../../domain/scheduling/weekly-hours';
import { MAX_PREFERRED_SERVICES } from '../booking-limits';

import type { EmployeePreferences } from '../../domain/models/employee-preferences';
import type { SavePreferencesInput } from '../contracts/employee-inputs';

/** What can be preferred: the services the website offers, by id. */
export interface PreferenceChoices {
  readonly serviceIds: ReadonlySet<string>;
}

/**
 * Reads what the preferences form sent, or says which field is wrong, all at once. Every service
 * must be one the website offers; a repeated one counts once.
 * The part of the day is whole minutes of one day, start before end.
 */
export function parsePreferences(
  input: SavePreferencesInput,
  choices: PreferenceChoices,
): AppResult<EmployeePreferences, ValidationAppError> {
  const bag = createBookingErrorBag();
  const serviceIds = unique(input.serviceIds);
  const window =
    input.window === null
      ? null
      : createTimeRange(input.window.startMinute, input.window.endMinute);

  bag.expect(serviceIds.length <= MAX_PREFERRED_SERVICES, 'serviceIds', CODES.tooMany);
  bag.expect(
    serviceIds.every((id) => choices.serviceIds.has(id)),
    'serviceIds',
    CODES.serviceInvalid,
  );
  bag.expect(input.window === null || window !== null, 'window', CODES.timeRangeInvalid);

  if (bag.hasErrors) {
    return err(bag.toError());
  }
  return ok({
    serviceIds: serviceIds.map(toBookableServiceId),
    window,
  });
}
