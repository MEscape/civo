'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getWebsiteCommands } from '../../composition';
import { toWebsiteDto } from '../dto/website-dto';
import { websiteRoutes } from '../routes';
import { parseWebsiteInput } from '../schemas/parse-website-input';
import { themeUpdateSchema } from '../schemas/theme-update-schema';

import type { WebsiteDto } from '../dto/website-dto';

export async function updateWebsiteThemeAction(input: unknown): Promise<ActionResult<WebsiteDto>> {
  const result = await parseWebsiteInput(themeUpdateSchema, input).asyncAndThen((command) =>
    getWebsiteCommands().updateWebsiteTheme.execute(command),
  );

  if (result.isOk()) {
    // The theme is part of what a publish would change, and the builder previews it.
    revalidatePath(websiteRoutes.layout, 'layout');
  }
  return toActionResult(result.map(toWebsiteDto));
}
