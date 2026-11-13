'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBookingCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { removeTeamMemberSchema } from '../schemas/team-schema';

import type { TeamLeftDto } from '../dto/team-dto';

/**
 * A manager takes a member out of their team, from the version they read: the bookings that have not
 * begun are open again. A thin adapter: it validates the request, hands it to the use case, which
 * authorizes and applies every rule, and returns the typed result with stable error codes, never a message.
 */
export async function removeTeamMemberAction(input: unknown): Promise<ActionResult<TeamLeftDto>> {
  const result = await parseBookingInput(removeTeamMemberSchema, input).asyncAndThen((command) =>
    getBookingCommands().removeTeamMember.execute(command),
  );
  if (result.isOk()) {
    invalidateBookingAdmin(result.value.websiteId);
  }
  return toActionResult(result);
}
