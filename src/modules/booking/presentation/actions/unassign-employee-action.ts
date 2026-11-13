'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBookingCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { unassignEmployeeSchema } from '../schemas/staff-booking-schema';

import type { BookingDto } from '../dto/booking-dto';

/**
 * A manager takes an employee off a booking. A thin adapter: it validates the request, hands it to the use case, which authorizes and
 * applies every rule, and returns the typed result with stable error codes, never a message.
 */
export async function unassignEmployeeAction(input: unknown): Promise<ActionResult<BookingDto>> {
  const result = await parseBookingInput(unassignEmployeeSchema, input).asyncAndThen((command) =>
    getBookingCommands().unassignEmployee.execute(command),
  );
  if (result.isOk()) {
    invalidateBookingAdmin(result.value.websiteId);
  }
  return toActionResult(result);
}
