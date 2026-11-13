'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBookingQueries } from '../../composition';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { previewTeamMemberRemovalSchema } from '../schemas/team-schema';

import type { ResourceImpactDto } from '../dto/resource-dto';

/**
 * Which bookings are open again when a member leaves their team or moves to another. A read, so nothing is
 * invalidated. A thin adapter: it validates the request, hands it to the use case, which authorizes and
 * applies every rule, and returns the typed result with stable error codes, never a message.
 */
export async function previewTeamMemberRemovalAction(
  input: unknown,
): Promise<ActionResult<ResourceImpactDto>> {
  const result = await parseBookingInput(previewTeamMemberRemovalSchema, input).asyncAndThen(
    (command) => getBookingQueries().previewTeamMemberRemoval.execute(command),
  );
  return toActionResult(result);
}
