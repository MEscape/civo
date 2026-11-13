'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBookingCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { setUpTeamMemberSchema } from '../schemas/team-schema';

import type { TeamMemberDto } from '../dto/team-dto';

/**
 * A manager gives a member their calendar at a location. A thin adapter: it validates the request, hands it to the use case, which authorizes and
 * applies every rule, and returns the typed result with stable error codes, never a message.
 */
export async function setUpTeamMemberAction(input: unknown): Promise<ActionResult<TeamMemberDto>> {
  const result = await parseBookingInput(setUpTeamMemberSchema, input).asyncAndThen((command) =>
    getBookingCommands().setUpTeamMember.execute(command),
  );
  if (result.isOk()) {
    invalidateBookingAdmin(result.value.websiteId);
  }
  return toActionResult(result);
}
