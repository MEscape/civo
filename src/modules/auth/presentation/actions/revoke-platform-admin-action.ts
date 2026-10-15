'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getAuthCommands } from '../../composition';
import { ROOT_LAYOUT_PATH } from '../routes';
import { parseAuthInput } from '../schemas/parse-auth-input';
import { removeUserSchema } from '../schemas/user-admin-schema';

/** Framework adapter: validate, call the use case (which authorizes `platform.admin.manage`), refresh the list. */
export async function revokePlatformAdminAction(input: unknown): Promise<ActionResult<void>> {
  const result = await parseAuthInput(removeUserSchema, input).asyncAndThen(({ userId }) =>
    getAuthCommands().revokePlatformAdmin.execute(userId),
  );
  if (result.isOk()) {
    revalidatePath(ROOT_LAYOUT_PATH, 'layout');
  }
  return toActionResult(result);
}
