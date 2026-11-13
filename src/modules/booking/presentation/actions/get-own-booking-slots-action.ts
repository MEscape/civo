'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBookingQueries } from '../../composition';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { ownBookingSlotsSchema } from '../schemas/public-booking-schema';

import type { AvailableSlotsDto } from '../dto/booking-dto';

/**
 * The times a visitor can move their own booking to, reached by reference and address. A read, so nothing is invalidated. A thin adapter: it validates the request, hands it to the use case, which authorizes and
 * applies every rule, and returns the typed result with stable error codes, never a message.
 */
export async function getOwnBookingSlotsAction(
  input: unknown,
): Promise<ActionResult<AvailableSlotsDto>> {
  const result = await parseBookingInput(ownBookingSlotsSchema, input).asyncAndThen((command) =>
    getBookingQueries().getOwnBookingSlots.execute(command),
  );
  return toActionResult(result);
}
