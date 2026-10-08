'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getAuthCommands } from '../../composition';
import { parseAuthInput } from '../schemas/parse-auth-input';
import { signUpSchema } from '../schemas/sign-up-schema';

/** Succeeds identically for new and already-registered addresses (enumeration protection). */
export async function signUpAction(input: unknown): Promise<ActionResult<void>> {
  const result = await parseAuthInput(signUpSchema, input).asyncAndThen(
    ({ name, email, password }) => getAuthCommands().signUp.execute({ name, email, password }),
  );

  return toActionResult(result);
}
