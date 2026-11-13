'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBookingQueries } from '../../composition';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { previewOwnProfileChangeSchema } from '../schemas/team-schema';

import type { ResourceImpactDto } from '../dto/resource-dto';

/**
 * Which of their bookings an employee's change of their own calendar would leave without them. A read, so nothing is invalidated. A thin adapter: it validates the request, hands it to the use case, which authorizes and
 * applies every rule, and returns the typed result with stable error codes, never a message.
 */
export async function previewOwnProfileChangeAction(
  input: unknown,
): Promise<ActionResult<ResourceImpactDto>> {
  const result = await parseBookingInput(previewOwnProfileChangeSchema, input).asyncAndThen(
    (command) => getBookingQueries().previewOwnProfileChange.execute(command),
  );
  return toActionResult(result);
}
