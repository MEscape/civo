'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBookingQueries } from '../../composition';
import { previewLocationChangeSchema } from '../schemas/location-schema';
import { parseBookingInput } from '../schemas/parse-booking-input';

import type { LocationImpactDto } from '../dto/location-dto';

/**
 * Which bookings a change of a location's hours would leave outside them. A read, so nothing is invalidated. A thin adapter: it validates the request, hands it to the use case, which authorizes and
 * applies every rule, and returns the typed result with stable error codes, never a message.
 */
export async function previewLocationChangeAction(
  input: unknown,
): Promise<ActionResult<LocationImpactDto>> {
  const result = await parseBookingInput(previewLocationChangeSchema, input).asyncAndThen(
    (command) => getBookingQueries().previewLocationChange.execute(command),
  );
  return toActionResult(result);
}
