'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getAuthCommands } from '../../composition';
import { ROOT_LAYOUT_PATH } from '../routes';
import { parseAuthInput } from '../schemas/parse-auth-input';
import { setUserAccessSchema } from '../schemas/user-admin-schema';

/** Framework adapter: validate, call the use case (which authorizes the platform administrator), refresh every list. */
export async function setUserAccessAction(input: unknown): Promise<ActionResult<void>> {
  const result = await parseAuthInput(setUserAccessSchema, input).asyncAndThen((command) =>
    getAuthCommands().setUserAccess.execute(command),
  );
  if (result.isOk()) {
    revalidatePath(ROOT_LAYOUT_PATH, 'layout');
  }
  return toActionResult(result);
}
