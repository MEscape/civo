'use server';

import { revalidatePath } from 'next/cache';

import { revalidateLocalizedPath } from '@i18n/server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getWebsiteCommands } from '../../composition';
import { toWebsiteDto } from '../dto/website-dto';
import { websiteRoutes } from '../routes';
import { parseWebsiteInput } from '../schemas/parse-website-input';
import { websiteEditSchema } from '../schemas/website-edit-schema';

import type { WebsiteDto } from '../dto/website-dto';

export async function updateWebsiteAction(input: unknown): Promise<ActionResult<WebsiteDto>> {
  const result = await parseWebsiteInput(websiteEditSchema, input).asyncAndThen((command) =>
    getWebsiteCommands().updateWebsite.execute(command),
  );

  if (result.isOk()) {
    revalidateLocalizedPath(websiteRoutes.list());
    // The name and details are part of what a publish would change.
    revalidatePath(websiteRoutes.layout, 'layout');
  }
  return toActionResult(result.map(toWebsiteDto));
}
