'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getAuthCommands } from '../../composition';
import { acceptInvitationSchema } from '../schemas/accept-invitation-schema';
import { parseAuthInput } from '../schemas/parse-auth-input';

/**
 * Framework adapter: validate, then hand the single-use token to the use
 * case, which decides everything else (the address belongs to the invitation,
 * never to this request).
 */
export async function acceptInvitationAction(input: unknown): Promise<ActionResult<void>> {
  const result = await parseAuthInput(acceptInvitationSchema, input).asyncAndThen(
    ({ token, name, password }) =>
      getAuthCommands().acceptInvitation.execute({ token, name, password }),
  );

  return toActionResult(result);
}
