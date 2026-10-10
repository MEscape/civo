'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { bookingAdminCommands } from '../../composition';
import { toStaffChangeDto } from '../dto/calendar-dto';
import { staffBookingSchema } from '../schemas/operations-calendar-schema';
import { parseBookingInput } from '../schemas/parse-booking-input';

import type { StaffChangeDto } from '../dto/calendar-dto';

/** Marks a booking whose appointment took place as completed. Requires `booking.manage`. */
export async function completeBookingAction(input: unknown): Promise<ActionResult<StaffChangeDto>> {
  const result = await parseBookingInput(staffBookingSchema, input).asyncAndThen((request) =>
    bookingAdminCommands.completeBooking.execute(request),
  );
  return toActionResult(result.map(toStaffChangeDto));
}
