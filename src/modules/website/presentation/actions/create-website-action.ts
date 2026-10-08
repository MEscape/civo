'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { websiteCommands } from '../../composition';
import { toWebsiteDto } from '../dto/website-dto';
import { websiteRoutes } from '../routes';
import { newWebsiteSchema } from '../schemas/new-website-schema';
import { parseWebsiteInput } from '../schemas/parse-website-input';

import type { WebsiteDto } from '../dto/website-dto';

/**
 * Framework adapter: validate, call the use case, invalidate. The use case
 * itself authenticates and authorizes, so there is no path around it.
 */
export async function createWebsiteAction(input: unknown): Promise<ActionResult<WebsiteDto>> {
  const result = await parseWebsiteInput(newWebsiteSchema, input).asyncAndThen((command) =>
    websiteCommands.createWebsite.execute(command),
  );

  if (result.isOk()) {
    revalidatePath(websiteRoutes.list());
  }
  return toActionResult(result.map(toWebsiteDto));
}
