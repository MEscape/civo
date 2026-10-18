'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getAuthCommands } from '../../composition';
import { ROOT_LAYOUT_PATH } from '../routes';
import { parseAuthInput } from '../schemas/parse-auth-input';
import { removeUserAccessSchema } from '../schemas/user-admin-schema';

/** Framework adapter: validate, call the use case (which authorizes the platform administrator), refresh every list. */
export async function removeUserAccessAction(input: unknown): Promise<ActionResult<void>> {
  const result = await parseAuthInput(removeUserAccessSchema, input).asyncAndThen((command) =>
    getAuthCommands().removeUserAccess.execute(command),
  );
  if (result.isOk()) {
    revalidatePath(ROOT_LAYOUT_PATH, 'layout');
  }
  return toActionResult(result);
}
