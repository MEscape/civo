'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBookingCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { publicBookingKeySchema } from '../schemas/public-booking-schema';

import type { PublicBookingDto } from '../dto/booking-dto';

/**
 * A visitor cancels their booking. A thin adapter: it validates the request, hands it to the use case, which authorizes and
 * applies every rule, and returns the typed result with stable error codes, never a message.
 */
export async function cancelOwnBookingAction(
  input: unknown,
): Promise<ActionResult<PublicBookingDto>> {
  const result = await parseBookingInput(publicBookingKeySchema, input).asyncAndThen((command) =>
    getBookingCommands().cancelOwnBooking.execute(command),
  );
  if (result.isOk()) {
    invalidateBookingAdmin(result.value.websiteId);
  }
  return toActionResult(result);
}
