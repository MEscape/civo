import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import {
  BOOKING_VALIDATION_CODES as CODES,
  createBookingErrorBag,
} from '../../domain/errors/booking-errors';
import { parseTimeZone } from '../../domain/time/time-zone';
import { LOCATION_LIMITS as LIMITS } from '../contracts/booking-constraints';

import { parseExceptions } from './parse-exceptions';
import { parseWeek } from './parse-hours';

import type { AvailabilityPlan } from '../../domain/scheduling/availability-plan';
import type { TimeZone } from '../../domain/time/time-zone';
import type { LocationInput } from '../contracts/location-inputs';

/** A location as the rules hold it, read from what a form sent. */
export interface ParsedLocation {
  readonly name: string;
  readonly address: string | null;
  readonly zone: TimeZone;
  readonly isActive: boolean;
  readonly openingHours: AvailabilityPlan;
}

/**
 * Reads what a form sent into what the rules hold, or says which field is wrong, all of them at
 * once, by the same dotted path the form uses for it. What the engine and the storage rely on is
 * decided here: ranges are whole minutes, in order and not overlapping, a break lies inside open
 * hours, an exception names real days and (unless it closes) real hours. Ranges and exceptions come
 * out in a fixed order, so two requests that mean the same hours are equal.
 */
export function parseLocationInput(
  input: LocationInput,
): AppResult<ParsedLocation, ValidationAppError> {
  const bag = createBookingErrorBag();
  const name = input.name.trim();
  const address = input.address.trim();
  const zone = parseTimeZone(input.timeZone);

  bag.expect(name.length >= 1 && name.length <= LIMITS.nameMax, 'name', CODES.nameInvalid);
  bag.expect(address.length <= LIMITS.addressMax, 'address', CODES.addressInvalid);
  bag.expect(zone !== null, 'timeZone', CODES.timeZoneInvalid);
  const weekly = parseWeek(input.openingHours.weekly, bag);
  const exceptions = parseExceptions(input.openingHours.exceptions, bag);

  if (bag.hasErrors || zone === null || weekly === null) {
    return err(bag.toError());
  }
  return ok({
    name,
    address: address === '' ? null : address,
    zone,
    isActive: input.isActive,
    openingHours: { weekly, exceptions },
  });
}
