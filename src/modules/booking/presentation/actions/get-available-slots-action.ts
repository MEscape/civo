'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBookingQueries } from '../../composition';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { availableSlotsSchema } from '../schemas/public-booking-schema';

import type { AvailableSlotsDto } from '../dto/booking-dto';

/**
 * The start times a visitor can book. A read, so nothing is invalidated. A thin adapter: it validates the request, hands it to the use case, which authorizes and
 * applies every rule, and returns the typed result with stable error codes, never a message.
 */
export async function getAvailableSlotsAction(
  input: unknown,
): Promise<ActionResult<AvailableSlotsDto>> {
  const result = await parseBookingInput(availableSlotsSchema, input).asyncAndThen((command) =>
    getBookingQueries().getAvailableSlots.execute(command),
  );
  return toActionResult(result);
}
