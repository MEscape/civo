'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getAuthCommands } from '../../composition';
import { ROOT_LAYOUT_PATH } from '../routes';
import { parseAuthInput } from '../schemas/parse-auth-input';
import { grantPlatformAdminSchema } from '../schemas/user-admin-schema';

/** Framework adapter: validate, call the use case (which authorizes `platform.admin.manage`), refresh the list. */
export async function grantPlatformAdminAction(input: unknown): Promise<ActionResult<void>> {
  const result = await parseAuthInput(grantPlatformAdminSchema, input).asyncAndThen(({ email }) =>
    getAuthCommands().grantPlatformAdmin.execute(email),
  );
  if (result.isOk()) {
    revalidatePath(ROOT_LAYOUT_PATH, 'layout');
  }
  return toActionResult(result);
}
