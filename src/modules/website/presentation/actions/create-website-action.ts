'use server';

import { revalidateLocalizedPath } from '@i18n/server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getWebsiteCommands } from '../../composition';
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
    getWebsiteCommands().createWebsite.execute(command),
  );

  if (result.isOk()) {
    revalidateLocalizedPath(websiteRoutes.list());
  }
  return toActionResult(result.map(toWebsiteDto));
}
