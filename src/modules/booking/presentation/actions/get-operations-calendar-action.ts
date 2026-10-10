'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { bookingAdminQueries } from '../../composition';
import { toOperationsCalendarDto } from '../dto/calendar-dto';
import { operationsCalendarSchema } from '../schemas/operations-calendar-schema';
import { parseBookingInput } from '../schemas/parse-booking-input';

import type { OperationsCalendarDto } from '../dto/calendar-dto';

/** The bookings of the visible calendar range. Requires `booking.read`; never cached. */
export async function getOperationsCalendarAction(
  input: unknown,
): Promise<ActionResult<OperationsCalendarDto>> {
  const result = await parseBookingInput(operationsCalendarSchema, input).asyncAndThen((query) =>
    bookingAdminQueries.getOperationsCalendar.execute(query),
  );
  return toActionResult(result.map(toOperationsCalendarDto));
}
