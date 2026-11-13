'use server';

import { revalidatePath } from 'next/cache';

import { getLocale } from '@i18n/server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getAuthCommands } from '../../composition';
import { ROOT_LAYOUT_PATH } from '../routes';
import { parseAuthInput } from '../schemas/parse-auth-input';
import { inviteUserSchema } from '../schemas/user-admin-schema';

/** Framework adapter: validate, call the use case (which authorizes the scope's permission), refresh the lists. */
export async function inviteUserAction(input: unknown): Promise<ActionResult<void>> {
  const locale = await getLocale();
  const result = await parseAuthInput(inviteUserSchema, input).asyncAndThen(
    ({ email, ...invitation }) =>
      getAuthCommands().inviteUser.execute({
        email,
        locale,
        scope:
          invitation.scope === 'platform'
            ? { kind: 'platform' }
            : { kind: 'website', role: invitation.role, tenantId: invitation.tenantId },
      }),
  );
  if (result.isOk()) {
    revalidatePath(ROOT_LAYOUT_PATH, 'layout');
  }
  return toActionResult(result);
}
