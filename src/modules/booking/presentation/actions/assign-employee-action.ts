'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBookingCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { assignEmployeeSchema } from '../schemas/staff-booking-schema';

import type { BookingDto } from '../dto/booking-dto';

/**
 * A manager gives a booking to an employee. A thin adapter: it validates the request, hands it to the use case, which authorizes and
 * applies every rule, and returns the typed result with stable error codes, never a message.
 */
export async function assignEmployeeAction(input: unknown): Promise<ActionResult<BookingDto>> {
  const result = await parseBookingInput(assignEmployeeSchema, input).asyncAndThen((command) =>
    getBookingCommands().assignEmployee.execute(command),
  );
  if (result.isOk()) {
    invalidateBookingAdmin(result.value.websiteId);
  }
  return toActionResult(result);
}
