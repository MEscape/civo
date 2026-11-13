'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBookingQueries } from '../../composition';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { previewServiceDeactivationSchema } from '../schemas/service-schema';

import type { DeactivationImpactDto } from '../dto/service-dto';

/**
 * Which bookings closing a service would reach. A read, so nothing is invalidated. A thin adapter: it
 * validates the request, hands it to the use case, which authorizes and applies every rule, and
 * returns the typed result with stable error codes, never a message.
 */
export async function previewServiceDeactivationAction(
  input: unknown,
): Promise<ActionResult<DeactivationImpactDto>> {
  const result = await parseBookingInput(previewServiceDeactivationSchema, input).asyncAndThen(
    (command) => getBookingQueries().previewServiceDeactivation.execute(command),
  );
  return toActionResult(result);
}
