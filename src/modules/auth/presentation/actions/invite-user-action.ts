'use server';

import { revalidatePath } from 'next/cache';

import { getLocale } from '@i18n/server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getAuthCommands } from '../../composition';
import { ROOT_LAYOUT_PATH } from '../routes';
import { parseAuthInput } from '../schemas/parse-auth-input';
import { inviteUserSchema } from '../schemas/user-admin-schema';

import type { InviteOutcome } from '../../application/contracts/user-views';

/** Framework adapter: validate, call the use case (which authorizes user.manage), refresh the lists. */
export async function inviteUserAction(input: unknown): Promise<ActionResult<InviteOutcome>> {
  const locale = await getLocale();
  const result = await parseAuthInput(inviteUserSchema, input).asyncAndThen((invitation) =>
    getAuthCommands().inviteUser.execute({ ...invitation, locale }),
  );
  if (result.isOk()) {
    revalidatePath(ROOT_LAYOUT_PATH, 'layout');
  }
  return toActionResult(result);
}
