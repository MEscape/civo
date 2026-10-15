'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { bookingAdminCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { toLocationDto } from '../dto/setup-dto';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { staffHoursSchema } from '../schemas/staff-hours-schema';

import type { LocationDto } from '../dto/setup-dto';

/** Sets when employees may work at a location. Requires `booking.manage`. */
export async function setStaffHoursAction(input: unknown): Promise<ActionResult<LocationDto>> {
  const result = await parseBookingInput(staffHoursSchema, input).asyncAndThen(
    ({ websiteId: _websiteId, ...change }) => bookingAdminCommands.setStaffHours.execute(change),
  );
  if (result.isOk()) {
    invalidateBookingAdmin(result.value.websiteId);
  }
  return toActionResult(result.map(toLocationDto));
}
