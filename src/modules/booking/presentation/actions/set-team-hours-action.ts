'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { bookingAdminCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { toResourceDto } from '../dto/setup-dto';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { teamHoursSchema } from '../schemas/team-hours-schema';

import type { ResourceDto } from '../dto/setup-dto';

/** Sets the working hours of one employee or of several. Requires `booking.manage`. */
export async function setTeamHoursAction(
  input: unknown,
): Promise<ActionResult<readonly ResourceDto[]>> {
  const parsed = parseBookingInput(teamHoursSchema, input);
  const result = await parsed.asyncAndThen(({ websiteId: _websiteId, ...change }) =>
    bookingAdminCommands.setTeamHours.execute(change),
  );
  if (result.isOk()) {
    const [first] = result.value;
    if (first !== undefined) {
      invalidateBookingAdmin(first.websiteId);
    }
  }
  return toActionResult(result.map((saved) => saved.map(toResourceDto)));
}
