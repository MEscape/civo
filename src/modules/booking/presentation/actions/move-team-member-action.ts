'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBookingCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { moveTeamMemberSchema } from '../schemas/team-schema';

import type { TeamMemberDto } from '../dto/team-dto';

/**
 * A manager moves a member to the team of another location: the old calendar is taken out of its team and
 * the member gets a new one there. A thin adapter: it validates the request, hands it to the use case,
 * which authorizes and applies every rule, and returns the typed result with stable error codes, never a message.
 */
export async function moveTeamMemberAction(input: unknown): Promise<ActionResult<TeamMemberDto>> {
  const result = await parseBookingInput(moveTeamMemberSchema, input).asyncAndThen((command) =>
    getBookingCommands().moveTeamMember.execute(command),
  );
  if (result.isOk()) {
    invalidateBookingAdmin(result.value.websiteId);
  }
  return toActionResult(result);
}
