'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { bookingAdminCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { toResourceDto } from '../dto/setup-dto';
import { ownAvailabilitySchema } from '../schemas/own-availability-schema';
import { parseBookingInput } from '../schemas/parse-booking-input';

import type { ResourceDto } from '../dto/setup-dto';

/** An employee changes their own working hours. Requires `booking.availability.own` and an editor's permission on the calendar. */
export async function updateOwnAvailabilityAction(
  input: unknown,
): Promise<ActionResult<ResourceDto>> {
  const result = await parseBookingInput(ownAvailabilitySchema, input).asyncAndThen((command) =>
    bookingAdminCommands.updateOwnAvailability.execute(command),
  );
  if (result.isOk()) {
    invalidateBookingAdmin(result.value.websiteId);
  }
  return toActionResult(result.map(toResourceDto));
}
