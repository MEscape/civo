'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBookingQueries } from '../../composition';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { previewTeamMemberChangeSchema } from '../schemas/team-schema';

import type { ResourceImpactDto } from '../dto/resource-dto';

/**
 * Which bookings a manager's change of an employee's calendar would leave without them. A read, so nothing is invalidated. A thin adapter: it validates the request, hands it to the use case, which authorizes and
 * applies every rule, and returns the typed result with stable error codes, never a message.
 */
export async function previewTeamMemberChangeAction(
  input: unknown,
): Promise<ActionResult<ResourceImpactDto>> {
  const result = await parseBookingInput(previewTeamMemberChangeSchema, input).asyncAndThen(
    (command) => getBookingQueries().previewTeamMemberChange.execute(command),
  );
  return toActionResult(result);
}
