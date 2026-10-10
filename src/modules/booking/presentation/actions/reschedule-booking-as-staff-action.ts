'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { bookingAdminCommands } from '../../composition';
import { toStaffChangeDto } from '../dto/calendar-dto';
import { staffRescheduleSchema } from '../schemas/operations-calendar-schema';
import { parseBookingInput } from '../schemas/parse-booking-input';

import type { StaffChangeDto } from '../dto/calendar-dto';

/** Moves any booking to another start time on behalf of the staff. Requires `booking.manage`. */
export async function rescheduleBookingAsStaffAction(
  input: unknown,
): Promise<ActionResult<StaffChangeDto>> {
  const result = await parseBookingInput(staffRescheduleSchema, input).asyncAndThen((request) =>
    bookingAdminCommands.rescheduleBookingAsStaff.execute(request),
  );
  return toActionResult(result.map(toStaffChangeDto));
}
