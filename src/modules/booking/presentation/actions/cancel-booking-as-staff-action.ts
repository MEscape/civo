'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { bookingAdminCommands } from '../../composition';
import { toStaffChangeDto } from '../dto/calendar-dto';
import { staffBookingSchema } from '../schemas/operations-calendar-schema';
import { parseBookingInput } from '../schemas/parse-booking-input';

import type { StaffChangeDto } from '../dto/calendar-dto';

/** Cancels any booking on behalf of the staff. Requires `booking.manage`. */
export async function cancelBookingAsStaffAction(
  input: unknown,
): Promise<ActionResult<StaffChangeDto>> {
  const result = await parseBookingInput(staffBookingSchema, input).asyncAndThen((request) =>
    bookingAdminCommands.cancelBookingAsStaff.execute(request),
  );
  return toActionResult(result.map(toStaffChangeDto));
}
