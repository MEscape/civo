'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBookingCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { updateLocationSchema } from '../schemas/location-schema';
import { parseBookingInput } from '../schemas/parse-booking-input';

import type { LocationDto } from '../dto/location-dto';

/**
 * A manager changes a location, from the version they read. A thin adapter: it validates the request, hands it to the use case, which authorizes and
 * applies every rule, and returns the typed result with stable error codes, never a message.
 */
export async function updateBookingLocationAction(
  input: unknown,
): Promise<ActionResult<LocationDto>> {
  const result = await parseBookingInput(updateLocationSchema, input).asyncAndThen((command) =>
    getBookingCommands().updateBookingLocation.execute(command),
  );
  if (result.isOk()) {
    invalidateBookingAdmin(result.value.websiteId);
  }
  return toActionResult(result);
}
