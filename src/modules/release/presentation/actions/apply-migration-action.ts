'use server';

import { revalidatePath } from 'next/cache';

import { builderRoutes } from '@modules/builder/client';
import { websiteRoutes } from '@modules/website/client';

import { revalidateLocalizedPath } from '@i18n/server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getReleaseCommands } from '../../composition';
import { toApplyMigrationResultDto } from '../dto/migration-dto';
import { applyMigrationSchema } from '../schemas/apply-migration-schema';
import { parseReleaseInput } from '../schemas/parse-release-input';

import type { ApplyMigrationResultDto } from '../dto/migration-dto';

/**
 * Writes migrated page drafts and never touches the live release.
 * Revalidates the builder so it loads the migrated drafts immediately, and
 * the history so the new status shows. An incomplete apply may still have
 * written some pages, so any successful result revalidates.
 */
export async function applyMigrationAction(
  input: unknown,
): Promise<ActionResult<ApplyMigrationResultDto>> {
  const result = await parseReleaseInput(applyMigrationSchema, input).asyncAndThen((command) =>
    getReleaseCommands().applyMigration.execute(command),
  );

  if (result.isOk()) {
    revalidateLocalizedPath(builderRoutes.pages(result.value.websiteId));
    // The overview and the bar above it count the drafts this just wrote as unpublished changes.
    revalidatePath(websiteRoutes.layout, 'layout');
  }
  return toActionResult(result.map(toApplyMigrationResultDto));
}
