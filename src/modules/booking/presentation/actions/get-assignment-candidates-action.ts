'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBookingQueries } from '../../composition';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { assignmentCandidatesSchema } from '../schemas/staff-booking-schema';

import type { AssignmentCandidatesDto } from '../dto/booking-dto';

/**
 * The resources that can fill a requirement of a booking, for the assignment dialog. A thin adapter: it validates the request, hands it to the use case, which authorizes and
 * applies every rule, and returns the typed result with stable error codes, never a message.
 */
export async function getAssignmentCandidatesAction(
  input: unknown,
): Promise<ActionResult<AssignmentCandidatesDto>> {
  const result = await parseBookingInput(assignmentCandidatesSchema, input).asyncAndThen(
    (command) => getBookingQueries().getAssignmentCandidates.execute(command),
  );
  return toActionResult(result);
}
