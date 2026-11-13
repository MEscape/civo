'use server';

import { revalidatePath } from 'next/cache';

import { revalidateLocalizedPath } from '@i18n/server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBuilderCommands } from '../../composition';
import { toSavedRevisionDto } from '../dto/page-dto';
import { builderRoutes } from '../routes';
import { parseBuilderInput } from '../schemas/parse-builder-input';
import { savePageConfigSchema } from '../schemas/save-page-config-schema';

import type { SavedRevisionDto } from '../dto/page-dto';

/**
 * Framework adapter: validate, call the use case, invalidate. The use case
 * itself authenticates, authorizes and enforces the editor's scope, so
 * there is no path around it. Refresh every locale's page list and the parent
 * layout so publication status and overview figures see the saved draft.
 * The public site is served from release snapshots, not from drafts.
 */
export async function savePageConfigAction(
  input: unknown,
): Promise<ActionResult<SavedRevisionDto>> {
  const result = await parseBuilderInput(savePageConfigSchema, input).asyncAndThen((command) =>
    getBuilderCommands().savePageConfig.execute(command),
  );

  if (result.isOk()) {
    revalidateLocalizedPath(builderRoutes.pages(result.value.websiteId));
    revalidatePath(builderRoutes.websiteLayout, 'layout');
  }
  return toActionResult(result.map(toSavedRevisionDto));
}
