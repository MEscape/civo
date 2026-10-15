'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { bookingAdminCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { toResourceDto } from '../dto/setup-dto';
import { ownProfileSchema } from '../schemas/own-profile-schema';
import { parseBookingInput } from '../schemas/parse-booking-input';

import type { ResourceDto } from '../dto/setup-dto';

/** An employee sets up their own calendar. Requires `booking.profile.own`; it can only ever be their own. */
export async function saveOwnProfileAction(input: unknown): Promise<ActionResult<ResourceDto>> {
  const result = await parseBookingInput(ownProfileSchema, input).asyncAndThen((command) =>
    bookingAdminCommands.saveOwnProfile.execute(command),
  );
  if (result.isOk()) {
    invalidateBookingAdmin(result.value.websiteId);
  }
  return toActionResult(result.map(toResourceDto));
}
