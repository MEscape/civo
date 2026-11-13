'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBookingCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { createBookingAsStaffSchema } from '../schemas/staff-booking-schema';

import type { BookingDto } from '../dto/booking-dto';

/**
 * A manager books a service for a customer. A thin adapter: it validates the request, hands it to the use case, which authorizes and
 * applies every rule, and returns the typed result with stable error codes, never a message.
 */
export async function createBookingAsStaffAction(
  input: unknown,
): Promise<ActionResult<BookingDto>> {
  const result = await parseBookingInput(createBookingAsStaffSchema, input).asyncAndThen(
    (command) => getBookingCommands().createBookingAsStaff.execute(command),
  );
  if (result.isOk()) {
    invalidateBookingAdmin(result.value.websiteId);
  }
  return toActionResult(result);
}
