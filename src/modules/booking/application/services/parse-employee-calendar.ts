import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { unique } from '@lib/utils';

import {
  BOOKING_VALIDATION_CODES as CODES,
  createBookingErrorBag,
  fieldValidationFailed,
} from '../../domain/errors/booking-errors';
import { daysOutsideLocation } from '../../domain/models/employee-calendar';
import { WEEKDAYS } from '../../domain/scheduling/weekly-hours';
import { SERVICE_LIMITS } from '../contracts/booking-constraints';

import { parseExceptions } from './parse-exceptions';
import { parseWeek } from './parse-hours';

import type { ResourceBlock } from '../../domain/models/resource-availability';
import type { WeeklyHours } from '../../domain/scheduling/weekly-hours';
import type { EmployeeCalendarInput } from '../contracts/team-inputs';

/** An employee's week and absences as the rules hold them. */
export interface ParsedCalendar {
  readonly weekly: WeeklyHours;
  readonly absences: readonly ResourceBlock[];
}

/** Most qualifications one person holds. */
const MAX_QUALIFICATIONS = 20;

/**
 * Reads an employee's week and absences, or says which field is wrong, by the path the form uses.
 * The same parsers as a location's hours; an absence is a closed day range and nothing else.
 */
export function parseEmployeeCalendar(
  input: EmployeeCalendarInput,
): AppResult<ParsedCalendar, ValidationAppError> {
  const bag = createBookingErrorBag();
  const weekly = parseWeek(input.openingHours.weekly, bag);
  const absences = parseExceptions(input.openingHours.exceptions, bag).filter(
    (exception): exception is ResourceBlock => {
      const isAbsence = exception.kind === 'closed';
      bag.expect(isAbsence, 'openingHours.exceptions', CODES.exceptionInvalid);
      return isAbsence;
    },
  );
  return bag.hasErrors || weekly === null ? err(bag.toError()) : ok({ weekly, absences });
}

/** The week must lie inside the location's hours: a refusal names each day that does not. */
export function checkInsideLocation(
  weekly: WeeklyHours,
  location: WeeklyHours,
): AppResult<WeeklyHours, ValidationAppError> {
  const outside = daysOutsideLocation(weekly, location);
  if (outside.length === 0) {
    return ok(weekly);
  }
  const bag = createBookingErrorBag();
  for (const weekday of outside) {
    bag.add(
      `openingHours.weekly.${WEEKDAYS.indexOf(weekday)}.intervals`,
      CODES.hoursOutsideLocation,
    );
  }
  return err(bag.toError());
}

/** Qualification keys as a manager typed them: trimmed, each once, in name order. */
export function parseQualifications(
  list: readonly string[],
): AppResult<string[], ValidationAppError> {
  const keys = unique(list.map((key) => key.trim())).sort((a, b) => a.localeCompare(b));
  const isValid =
    keys.length <= MAX_QUALIFICATIONS &&
    keys.every((key) => key.length >= 1 && key.length <= SERVICE_LIMITS.qualificationMax);
  return isValid
    ? ok(keys)
    : err(fieldValidationFailed('qualifications', CODES.qualificationInvalid));
}
