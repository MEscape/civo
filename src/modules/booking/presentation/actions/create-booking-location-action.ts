'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBookingCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { createLocationSchema } from '../schemas/location-schema';
import { parseBookingInput } from '../schemas/parse-booking-input';

import type { LocationDto } from '../dto/location-dto';

/**
 * A manager adds a location. A thin adapter: it validates the request, hands it to the use case, which authorizes and
 * applies every rule, and returns the typed result with stable error codes, never a message.
 */
export async function createBookingLocationAction(
  input: unknown,
): Promise<ActionResult<LocationDto>> {
  const result = await parseBookingInput(createLocationSchema, input).asyncAndThen((command) =>
    getBookingCommands().createBookingLocation.execute(command),
  );
  if (result.isOk()) {
    invalidateBookingAdmin(result.value.websiteId);
  }
  return toActionResult(result);
}
