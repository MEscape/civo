'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBookingCommands } from '../../composition';
import { invalidateBookingAdmin } from '../cache/invalidate';
import { parseBookingInput } from '../schemas/parse-booking-input';
import { saveOwnProfileSchema } from '../schemas/team-schema';

import type { TeamMemberDto } from '../dto/team-dto';

/**
 * An employee changes their own week and absences. A thin adapter: it validates the request, hands it to the use case, which authorizes and
 * applies every rule, and returns the typed result with stable error codes, never a message.
 */
export async function saveOwnProfileAction(input: unknown): Promise<ActionResult<TeamMemberDto>> {
  const result = await parseBookingInput(saveOwnProfileSchema, input).asyncAndThen((command) =>
    getBookingCommands().saveOwnProfile.execute(command),
  );
  if (result.isOk()) {
    invalidateBookingAdmin(result.value.websiteId);
  }
  return toActionResult(result);
}
