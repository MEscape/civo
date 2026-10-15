'use server';

import { revalidatePath } from 'next/cache';

import { websiteRoutes } from '@modules/website/client';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { releaseCommands } from '../../composition';
import { toReleaseSummaryDto } from '../dto/release-dto';
import { parseReleaseInput } from '../schemas/parse-release-input';
import { rollbackReleaseSchema } from '../schemas/rollback-release-schema';

import type { ReleaseSummaryDto } from '../dto/release-dto';

/**
 * Revalidates the builder and the public site so the restored version is
 * live immediately.
 */
export async function rollbackReleaseAction(
  input: unknown,
): Promise<ActionResult<ReleaseSummaryDto>> {
  const result = await parseReleaseInput(rollbackReleaseSchema, input).asyncAndThen((command) =>
    releaseCommands.rollbackRelease.execute(command),
  );

  if (result.isOk()) {
    // The website's pages, the release screen and the bar above them all show what is live.
    revalidatePath(websiteRoutes.detail(result.value.websiteId), 'layout');
  }
  return toActionResult(result.map(toReleaseSummaryDto));
}
