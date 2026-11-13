'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getAuthCommands } from '../../composition';
import { acceptInvitationSchema } from '../schemas/accept-invitation-schema';
import { parseAuthInput } from '../schemas/parse-auth-input';

import type { AcceptInvitationOutcome } from '../../application/contracts/invitation-views';

/**
 * Framework adapter: validate, then hand the single-use token to the use
 * case, which decides everything else (the address belongs to the invitation,
 * never to this request).
 */
export async function acceptInvitationAction(
  input: unknown,
): Promise<ActionResult<AcceptInvitationOutcome>> {
  const result = await parseAuthInput(acceptInvitationSchema, input).asyncAndThen((values) =>
    getAuthCommands().acceptInvitation.execute(values),
  );

  return toActionResult(result);
}
