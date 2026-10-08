'use server';

import { revalidatePath } from 'next/cache';

import { builderRoutes } from '@modules/builder/client';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { websiteCommands } from '../../composition';
import { toWebsiteDto } from '../dto/website-dto';
import { websiteRoutes } from '../routes';
import { parseWebsiteInput } from '../schemas/parse-website-input';
import { themeUpdateSchema } from '../schemas/theme-update-schema';

import type { WebsiteDto } from '../dto/website-dto';

export async function updateWebsiteThemeAction(input: unknown): Promise<ActionResult<WebsiteDto>> {
  const result = await parseWebsiteInput(themeUpdateSchema, input).asyncAndThen((command) =>
    websiteCommands.updateWebsiteTheme.execute(command),
  );

  if (result.isOk()) {
    revalidatePath(websiteRoutes.detail(result.value.id));
    revalidatePath(websiteRoutes.settings(result.value.id));
    revalidatePath(builderRoutes.pages(result.value.id));
  }
  return toActionResult(result.map(toWebsiteDto));
}
