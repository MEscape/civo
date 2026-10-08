'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { builderCommands } from '../../composition';
import { toSavedRevisionDto } from '../dto/page-dto';
import { builderRoutes } from '../routes';
import { parseBuilderInput } from '../schemas/parse-builder-input';
import { savePageConfigSchema } from '../schemas/save-page-config-schema';

import type { SavedRevisionDto } from '../dto/page-dto';

/**
 * Framework adapter: validate, call the use case, invalidate. The use case
 * itself authenticates, authorizes and enforces the editor's scope, so
 * there is no path around it. Only the page list is revalidated (it shows
 * `updatedAt`): the editor route is dynamic and always reads fresh data,
 * and the public site is served from release snapshots, not from drafts.
 */
export async function savePageConfigAction(
  input: unknown,
): Promise<ActionResult<SavedRevisionDto>> {
  const result = await parseBuilderInput(savePageConfigSchema, input).asyncAndThen((command) =>
    builderCommands.savePageConfig.execute(command),
  );

  if (result.isOk()) {
    revalidatePath(builderRoutes.pages(result.value.websiteId));
  }
  return toActionResult(result.map(toSavedRevisionDto));
}
