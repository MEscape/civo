'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBookingQueries } from '../../composition';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { publicBookingKeySchema } from '../schemas/public-booking-schema';

import type { PublicBookingDto } from '../dto/booking-dto';

/**
 * A visitor looks their booking up by its reference and address. A thin adapter: it validates the request, hands it to the use case, which authorizes and
 * applies every rule, and returns the typed result with stable error codes, never a message.
 */
export async function findBookingAction(input: unknown): Promise<ActionResult<PublicBookingDto>> {
  const result = await parseBookingInput(publicBookingKeySchema, input).asyncAndThen((command) =>
    getBookingQueries().getPublicBooking.execute(command),
  );
  return toActionResult(result);
}
