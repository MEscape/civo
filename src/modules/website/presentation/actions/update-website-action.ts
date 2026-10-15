'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { websiteCommands } from '../../composition';
import { toWebsiteDto } from '../dto/website-dto';
import { websiteRoutes } from '../routes';
import { parseWebsiteInput } from '../schemas/parse-website-input';
import { websiteEditSchema } from '../schemas/website-edit-schema';

import type { WebsiteDto } from '../dto/website-dto';

export async function updateWebsiteAction(input: unknown): Promise<ActionResult<WebsiteDto>> {
  const result = await parseWebsiteInput(websiteEditSchema, input).asyncAndThen((command) =>
    websiteCommands.updateWebsite.execute(command),
  );

  if (result.isOk()) {
    revalidatePath(websiteRoutes.list());
    // The name and details are part of what a publish would change.
    revalidatePath(websiteRoutes.detail(result.value.id), 'layout');
  }
  return toActionResult(result.map(toWebsiteDto));
}
