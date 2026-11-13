'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBookingQueries } from '../../composition';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { staffSlotsSchema } from '../schemas/staff-booking-schema';

import type { AvailableSlotsDto } from '../dto/booking-dto';

/**
 * The free starts of one day for a manager's slot picker (a new booking, or moving one). A thin
 * adapter: it validates the request, hands it to the use case, which authorizes and applies every
 * rule, and returns the typed result with stable error codes, never a message.
 */
export async function getStaffSlotsAction(
  input: unknown,
): Promise<ActionResult<AvailableSlotsDto>> {
  const result = await parseBookingInput(staffSlotsSchema, input).asyncAndThen((query) =>
    getBookingQueries().getStaffSlots.execute(query),
  );
  return toActionResult(result);
}
